import { NextResponse } from "next/server";
import { createUser, isFirstUser, toPublic } from "@/lib/auth/users";
import { signSession, setSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

interface Body {
  username?: string;
  displayName?: string;
  password?: string;
}

// POST /api/auth/register
// 第一个注册的用户自动成为 admin,后续注册的都是 user。
// 注册成功立刻登录。
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const username = (body.username ?? "").trim();
    const password = body.password ?? "";
    const displayName = body.displayName?.trim() || username;
    const user = await createUser({ username, password, displayName });
    // 签发 JWT cookie
    const token = await signSession({ uid: user.id, uname: user.username, role: user.role });
    await setSessionCookie(token);
    return NextResponse.json({
      success: true,
      user: toPublic(user),
      isFirstUser: isFirstUser(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("已存在") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

// GET /api/auth/register - 返回当前是否还能注册(无 user 时允许)
export async function GET() {
  return NextResponse.json({ allowRegister: isFirstUser() || (process.env.PI_ALLOW_REGISTER !== "false") });
}
