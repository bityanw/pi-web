import { NextResponse } from "next/server";
import { resolve as resolvePath } from "path";
import { resolveSessionPath } from "@/lib/session-reader";
import { startRpcSession, getRpcSession } from "@/lib/rpc-manager";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { requireUser } from "@/lib/auth/current-user";
import { getUserWorkspaceDir } from "@/lib/user-workspace";

// 验证 session 属于当前用户(session 的 cwd 必须在用户工作目录下)
function ensureSessionInUserHome(cwd: string, userHome: string): boolean {
  const n1 = resolvePath(cwd).replace(/\\/g, "/");
  const n2 = resolvePath(userHome).replace(/\\/g, "/").replace(/\/+$/, "");
  return n1 === n2 || n1.startsWith(n2 + "/");
}

// POST /api/agent/[id] - Send a command to an existing session
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireUser();
    const userHome = getUserWorkspaceDir(user.id);
    const body = await req.json() as { type: string; [key: string]: unknown };

    // Fast path: already-running session
    const existing = getRpcSession(id);
    if (existing?.isAlive()) {
      // 跨用户防护:在 in-memory 中也校验(从 session file 读 cwd)
      const filePath = await resolveSessionPath(id);
      if (filePath) {
        const cwd = SessionManager.open(filePath).getHeader()?.cwd ?? "";
        if (!ensureSessionInUserHome(cwd, userHome)) {
          return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }
      }
      const result = await existing.send(body);
      return NextResponse.json({ success: true, data: result });
    }

    const filePath = await resolveSessionPath(id);
    if (!filePath) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const cwd = SessionManager.open(filePath).getHeader()?.cwd ?? process.cwd();
    if (!ensureSessionInUserHome(cwd, userHome)) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { session } = await startRpcSession(id, filePath, cwd);
    const result = await session.send(body);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "Not authenticated") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/agent/[id] - Get current agent state
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireUser();
    const userHome = getUserWorkspaceDir(user.id);

    const session = getRpcSession(id);
    if (!session || !session.isAlive()) {
      // 检查磁盘上的 session 是否属于该用户
      const filePath = await resolveSessionPath(id);
      if (!filePath) return NextResponse.json({ running: false });
      const cwd = SessionManager.open(filePath).getHeader()?.cwd ?? "";
      if (!ensureSessionInUserHome(cwd, userHome)) {
        return NextResponse.json({ running: false });
      }
      return NextResponse.json({ running: false });
    }

    // 跨用户防护
    const filePath = await resolveSessionPath(id);
    if (filePath) {
      const cwd = SessionManager.open(filePath).getHeader()?.cwd ?? "";
      if (!ensureSessionInUserHome(cwd, userHome)) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
    }

    const state = await session.send({ type: "get_state" });
    return NextResponse.json({ running: true, state });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "Not authenticated") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
