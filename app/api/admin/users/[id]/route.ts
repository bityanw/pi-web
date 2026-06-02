import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/current-user";
import { updateUser, deleteUser, toPublic } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json() as { displayName?: string; role?: "admin" | "user"; disabled?: boolean };
    const u = updateUser(id, body);
    if (!u) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    return NextResponse.json({ success: true, user: toPublic(u) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("不能删除") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("不能删除") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
