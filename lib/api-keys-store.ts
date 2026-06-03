import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * 用户级别 API Key 存储
 *
 * 数据布局($PI_CODING_AGENT_DIR/):
 *   pi-web-user-keys.json      - 用户自己的 key(覆盖 admin 的 default model key)
 *                                { "<userId>": { "anthropic": "sk-zzz" } }
 *
 * 简单加密:用机器特定的密钥(随机生成,持久化)做 AES-256-GCM
 * 目的:不是防 root,是防 git 误提交 / 容器 layer 泄露
 *
 * 老的"per-provider admin default keys"已经废弃,统一用 lib/default-model.ts 的单 model 设计
 */

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

/** 从 key 中提取后 4 位(用于 UI 脱敏预览) */
export function last4(key: string | null): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}
