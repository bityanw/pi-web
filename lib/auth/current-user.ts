import { cookies } from "next/headers";
import { getSessionCookieValue, verifySession, type SessionPayload } from "./session";
import { getUserById, type UserRecord, toPublic } from "./users";

const COOKIE_NAME = "pi_web_session";

/**
 * 在 Server Component / Route Handler 里获取当前登录用户。
 * 找不到或 token 无效返回 null。
 */
export async function getCurrentUser(): Promise<UserRecord | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = getUserById(payload.uid);
  if (!user || user.disabled) return null;
  return user;
}

export async function getCurrentUserPublic() {
  const u = await getCurrentUser();
  return u ? toPublic(u) : null;
}

export async function requireUser(): Promise<UserRecord> {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "Not authenticated");
  return u;
}

export async function requireAdmin(): Promise<UserRecord> {
  const u = await requireUser();
  if (u.role !== "admin") throw new HttpError(403, "Admin required");
  return u;
}

// 用于在普通函数里抛 HTTP 错误
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type { SessionPayload };
