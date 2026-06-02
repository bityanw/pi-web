import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/current-user";
import { listUsers, createUser, toPublic } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ users: listUsers() });
  } catch (e) {
    if (e instanceof Error && e.message === "Not authenticated") {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    if (e instanceof Error && e.message === "Admin required") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { username, displayName, password, role } = await req.json() as { username?: string; displayName?: string; password?: string; role?: "admin" | "user" };
    if (!username || !password) return NextResponse.json({ error: "用户名和密码必填" }, { status: 400 });
    const user = await createUser({ username, displayName, password, role });
    return NextResponse.json({ success: true, user: toPublic(user) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
