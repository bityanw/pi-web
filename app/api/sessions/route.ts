import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { listAllSessions } from "@/lib/session-reader";
import { getUserWorkspaceDir } from "@/lib/user-workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    // 只返回当前用户工作目录下的 session
    const userHome = getUserWorkspaceDir(user.id);
    const sessions = await listAllSessions({ cwdPrefix: userHome });
    return NextResponse.json({ sessions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "Not authenticated" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
