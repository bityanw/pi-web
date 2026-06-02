import { NextResponse } from "next/server";
import { authenticate, toPublic } from "@/lib/auth/users";
import { signSession, setSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

interface Body {
  username?: string;
  password?: string;
}

// POST /api/auth/login
export async function POST(req: Request) {
  try {
    const { username, password } = (await req.json()) as Body;
    if (!username || !password) {
      return NextResponse.json({ error: "用户名和密码必填" }, { status: 400 });
    }
    const user = await authenticate(username, password);
    if (!user) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }
    const token = await signSession({ uid: user.id, uname: user.username, role: user.role });
    await setSessionCookie(token);
    return NextResponse.json({ success: true, user: toPublic(user) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
