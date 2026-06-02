import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { getUserWorkspaceDir } from "@/lib/user-workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ home: getUserWorkspaceDir(user.id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
