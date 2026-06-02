import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { hashPassword, verifyPassword } from "./password";

export type UserRole = "admin" | "user";

export interface UserRecord {
  id: string;
  username: string;            // 登录名,小写,唯一
  displayName: string;          // 显示名
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
  disabled: boolean;
}

interface UsersFile {
  version: 1;
  users: UserRecord[];
}

const USERS_FILE = "pi-web-users.json";
const FILE_LOCK = "pi-web-users.lock";

// ---------- 基础工具 ----------

function dataPath(): string {
  return join(getAgentDir(), USERS_FILE);
}

function readAll(): UsersFile {
  const p = dataPath();
  if (!existsSync(p)) return { version: 1, users: [] };
  try {
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as UsersFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.users)) {
      return { version: 1, users: [] };
    }
    return parsed;
  } catch {
    return { version: 1, users: [] };
  }
}

// 简单的文件级原子写(防止并发写损坏)
function writeAll(file: UsersFile): void {
  const p = dataPath();
  mkdirSync(join(p, ".."), { recursive: true });
  const tmp = p + ".tmp." + process.pid + "." + Date.now();
  writeFileSync(tmp, JSON.stringify(file, null, 2));
  // 原子替换
  const fs = require("fs") as typeof import("fs");
  fs.renameSync(tmp, p);
}

function genId(): string {
  return randomBytes(12).toString("hex");
}

function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

// ---------- 公共 API ----------

export function getUserById(id: string): UserRecord | null {
  return readAll().users.find((u) => u.id === id) ?? null;
}

export function getUserByUsername(username: string): UserRecord | null {
  const u = normalizeUsername(username);
  return readAll().users.find((x) => x.username === u) ?? null;
}

export function listUsers(): Omit<UserRecord, "passwordHash">[] {
  return readAll().users
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(({ passwordHash: _ph, ...rest }) => rest);
}

export function isFirstUser(): boolean {
  return readAll().users.length === 0;
}

/** 注册新用户。如果当前是第一个用户,自动获得 admin 角色。 */
export async function createUser(input: {
  username: string;
  displayName?: string;
  password: string;
  role?: UserRole;
}): Promise<UserRecord> {
  const username = normalizeUsername(input.username);
  if (!/^[a-z0-9_-]{3,32}$/.test(username)) {
    throw new Error("用户名必须是 3-32 位小写字母、数字、下划线或短横线");
  }
  if (!input.password || input.password.length < 6) {
    throw new Error("密码至少 6 位");
  }
  const file = readAll();
  if (file.users.some((u) => u.username === username)) {
    throw new Error("用户名已存在");
  }
  // 第一个用户自动 admin,除非显式指定
  const isFirst = file.users.length === 0;
  const role: UserRole = input.role ?? (isFirst ? "admin" : "user");
  const user: UserRecord = {
    id: genId(),
    username,
    displayName: input.displayName?.trim() || username,
    passwordHash: await hashPassword(input.password),
    role,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    disabled: false,
  };
  file.users.push(user);
  writeAll(file);
  return user;
}

export async function authenticate(username: string, password: string): Promise<UserRecord | null> {
  const user = getUserByUsername(username);
  if (!user || user.disabled) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  // 登录成功,更新 lastLoginAt
  const file = readAll();
  const u = file.users.find((x) => x.id === user.id);
  if (u) {
    u.lastLoginAt = new Date().toISOString();
    writeAll(file);
  }
  return user;
}

export function updateUser(id: string, patch: Partial<Pick<UserRecord, "displayName" | "role" | "disabled">>): UserRecord | null {
  const file = readAll();
  const u = file.users.find((x) => x.id === id);
  if (!u) return null;
  if (patch.displayName !== undefined) u.displayName = patch.displayName.trim() || u.username;
  if (patch.role !== undefined) u.role = patch.role;
  if (patch.disabled !== undefined) u.disabled = patch.disabled;
  writeAll(file);
  return u;
}

export async function changePassword(id: string, newPassword: string): Promise<boolean> {
  if (!newPassword || newPassword.length < 6) throw new Error("密码至少 6 位");
  const file = readAll();
  const u = file.users.find((x) => x.id === id);
  if (!u) return false;
  u.passwordHash = await hashPassword(newPassword);
  writeAll(file);
  return true;
}

export function deleteUser(id: string): boolean {
  const file = readAll();
  const idx = file.users.findIndex((x) => x.id === id);
  if (idx < 0) return false;
  // 防止删掉最后一个 admin
  const remaining = file.users.filter((_, i) => i !== idx);
  if (remaining.filter((u) => u.role === "admin" && !u.disabled).length === 0) {
    throw new Error("不能删除最后一个 admin");
  }
  file.users.splice(idx, 1);
  writeAll(file);
  return true;
}

export function toPublic(u: UserRecord): Omit<UserRecord, "passwordHash"> {
  const { passwordHash: _ph, ...rest } = u;
  return rest;
}
