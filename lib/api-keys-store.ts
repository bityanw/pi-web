import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * API Key 存储
 *
 * 数据布局($PI_CODING_AGENT_DIR/):
 *   pi-web-default-keys.json   - admin 配的全局默认 key
 *                                { "anthropic": "sk-xxx", "openai": "sk-yyy" }
 *   pi-web-user-keys.json      - 用户自己的 key(覆盖 default)
 *                                { "<userId>": { "anthropic": "sk-zzz" } }
 *
 * 简单加密:用机器特定的密钥(随机生成,持久化)做 AES-256-GCM
 * 目的:不是防 root,是防 git 误提交 / 容器 layer 泄露
 */

const DEFAULT_KEYS_FILE = "pi-web-default-keys.json";
const USER_KEYS_FILE = "pi-web-user-keys.json";
const ENC_KEY_FILE = "pi-web-enc-key";

type KeysMap = Record<string, string>;

// ---------- 加密 ----------

let cachedEncKey: Buffer | null = null;

function getEncKey(): Buffer {
  if (cachedEncKey) return cachedEncKey;
  const path = join(getAgentDir(), ENC_KEY_FILE);
  if (existsSync(path)) {
    cachedEncKey = Buffer.from(readFileSync(path, "utf8").trim(), "hex");
  } else {
    const buf = randomBytes(32);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, buf.toString("hex"), { mode: 0o600 });
    cachedEncKey = buf;
  }
  return cachedEncKey;
}

function enc(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1$${iv.toString("base64url")}$${tag.toString("base64url")}$${enc.toString("base64url")}`;
}

function dec(payload: string): string {
  const parts = payload.split("$");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Invalid key format");
  const iv = Buffer.from(parts[1]!, "base64url");
  const tag = Buffer.from(parts[2]!, "base64url");
  const data = Buffer.from(parts[3]!, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", getEncKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

// ---------- 文件读写 ----------

function readJson<T>(file: string, fallback: T): T {
  const path = join(getAgentDir(), file);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  const path = join(getAgentDir(), file);
  mkdirSync(join(path, ".."), { recursive: true });
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  const fs = require("fs") as typeof import("fs");
  fs.renameSync(tmp, path);
}

// ---------- 默认 keys (admin) ----------

export function getDefaultKeys(): Record<string, { configured: boolean; source: "default" | "user" | null }> {
  const map = readJson<KeysMap>(DEFAULT_KEYS_FILE, {});
  const result: Record<string, { configured: boolean; source: "default" | "user" | null }> = {};
  for (const provider of Object.keys(map)) {
    result[provider] = { configured: true, source: "default" };
  }
  return result;
}

export function getDefaultKey(provider: string): string | null {
  const map = readJson<KeysMap>(DEFAULT_KEYS_FILE, {});
  const v = map[provider];
  if (!v) return null;
  try { return dec(v); } catch { return null; }
}

export function setDefaultKey(provider: string, apiKey: string): void {
  const map = readJson<KeysMap>(DEFAULT_KEYS_FILE, {});
  map[provider] = enc(apiKey.trim());
  writeJson(DEFAULT_KEYS_FILE, map);
}

export function deleteDefaultKey(provider: string): void {
  const map = readJson<KeysMap>(DEFAULT_KEYS_FILE, {});
  delete map[provider];
  writeJson(DEFAULT_KEYS_FILE, map);
}

// ---------- 用户 keys (override) ----------

export function getUserKey(userId: string, provider: string): string | null {
  const map = readJson<Record<string, KeysMap>>(USER_KEYS_FILE, {});
  const v = map[userId]?.[provider];
  if (!v) return null;
  try { return dec(v); } catch { return null; }
}

export function setUserKey(userId: string, provider: string, apiKey: string): void {
  const map = readJson<Record<string, KeysMap>>(USER_KEYS_FILE, {});
  if (!map[userId]) map[userId] = {};
  map[userId][provider] = enc(apiKey.trim());
  writeJson(USER_KEYS_FILE, map);
}

export function deleteUserKey(userId: string, provider: string): void {
  const map = readJson<Record<string, KeysMap>>(USER_KEYS_FILE, {});
  if (map[userId]) {
    delete map[userId][provider];
    if (Object.keys(map[userId]).length === 0) delete map[userId];
    writeJson(USER_KEYS_FILE, map);
  }
}

/** 解析一个用户最终用哪个 key:用户自己的 > admin 默认 */
export function resolveApiKey(userId: string, provider: string): { key: string | null; source: "user" | "default" | null } {
  const userKey = getUserKey(userId, provider);
  if (userKey) return { key: userKey, source: "user" };
  const defaultKey = getDefaultKey(provider);
  if (defaultKey) return { key: defaultKey, source: "default" };
  return { key: null, source: null };
}
