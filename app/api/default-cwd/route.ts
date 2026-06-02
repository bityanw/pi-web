import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { getUserWorkspaceDir } from "@/lib/user-workspace";

// POST /api/default-cwd
// 返回当前用户的默认工作目录,自动创建。
// 每人一个独立目录:$PI_CODING_AGENT_DIR/workspaces/<userId>/
export async function POST() {
  try {
    const user = await requireUser();
    const dir = getUserWorkspaceDir(user.id);
    return NextResponse.json({ cwd: dir });
  } catch (e) {
    if (e instanceof Error && e.message === "Not authenticated") {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
