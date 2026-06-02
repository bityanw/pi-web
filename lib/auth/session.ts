import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// 不再 import { getAgentDir } from "@earendil-works/pi-coding-agent"
// 原因:那个包有 node: 协议 import,会导致 middleware (proxy.ts) 打入 edge runtime 时失败
// 这里直接读 process.env.PI_CODING_AGENT_DIR,逻辑与 getAgentDir() 一致
function getAgentDir(): string {
  const envDir = process.env.PI_CODING_AGENT_DIR;
  if (envDir) return envDir;
  // 默认 ~/.pi/agent(与 getAgentDir 默认行为一致)
  return join(process.env.HOME || "/root", ".pi", "agent");
}

const COOKIE_NAME = "pi_web_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天
const SECRET_FILE = "pi-web-jwt-secret";

export interface SessionPayload {
  uid: string;       // user id
  uname: string;     // username
  role: "admin" | "user";
  iat?: number;
  exp?: number;
}

// ---------- JWT 密钥管理 ----------
// 第一次启动时生成,持久化到 agent dir,保证重启后 token 仍然有效

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const path = join(getAgentDir(), SECRET_FILE);
  if (existsSync(path)) {
    const hex = readFileSync(path, "utf8").trim();
    cachedSecret = Buffer.from(hex, "hex");
  } else {
    // 生成 32 字节随机密钥
    const buf = require("crypto").randomBytes(32);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, buf.toString("hex"), { mode: 0o600 });
    cachedSecret = new Uint8Array(buf);
  }
  return cachedSecret!;
}

// ---------- JWT 签发 / 验证 ----------

export async function signSession(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string" || typeof payload.uname !== "string") return null;
    if (payload.role !== "admin" && payload.role !== "user") return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ---------- Cookie 工具 ----------

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  // 默认:生产环境用 Secure(仅 HTTPS 发送)
  // 可通过 PI_COOKIE_SECURE=false 关闭,供纯 HTTP 部署使用(开发/内网测试)
  const secure =
    process.env.PI_COOKIE_SECURE === "false"
      ? false
      : process.env.PI_COOKIE_SECURE === "true"
        ? true
        : process.env.NODE_ENV === "production";
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export async function getSessionCookieValue(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}
