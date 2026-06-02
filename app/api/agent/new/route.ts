import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { resolve as resolvePath } from "path";
import { startRpcSession } from "@/lib/rpc-manager";
import { requireUser } from "@/lib/auth/current-user";
import { getUserWorkspaceDir } from "@/lib/user-workspace";

// POST /api/agent/new  body: { cwd: string; type: string; message: string; ... }
// Spawns a brand-new pi session and immediately sends the first command.
// Returns { sessionId, data } where sessionId is pi's real session id.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json() as { cwd?: string; [key: string]: unknown };
    const { cwd, ...command } = body;

    if (!cwd || typeof cwd !== "string") {
      return NextResponse.json({ error: "cwd is required" }, { status: 400 });
    }
    if (!existsSync(cwd)) {
      return NextResponse.json({ error: `Directory does not exist: ${cwd}` }, { status: 400 });
    }

    // 多用户隔离:只允许用户在自己工作目录或其子目录下创建 session
    const userHome = getUserWorkspaceDir(user.id);
    const normalizedCwd = resolvePath(cwd).replace(/\\/g, "/");
    const normalizedHome = resolvePath(userHome).replace(/\\/g, "/").replace(/\/+$/, "");
    if (!normalizedCwd.startsWith(normalizedHome + "/") && normalizedCwd !== normalizedHome) {
      return NextResponse.json({ error: "无权在该目录下创建 session" }, { status: 403 });
    }

    // Use a one-time key so startRpcSession's lock doesn't conflict with real session ids
    const { provider, modelId, toolNames, thinkingLevel, ...promptCommand } = command as { provider?: string; modelId?: string; toolNames?: string[]; thinkingLevel?: string; [key: string]: unknown };

    const tempKey = `__new__${Date.now()}`;
    const { session, realSessionId } = await startRpcSession(tempKey, "", cwd, toolNames);

    // Keep the files-route allowed-roots cache (see app/api/files/[...path]/route.ts)
    // in sync so the new cwd is immediately readable via /api/files. Without this,
    // a file request under a brand-new cwd would 403 for up to the cache TTL.
    const cache = globalThis.__piAllowedRootsCache?.get(user.id);
    if (cache) cache.roots.add(cwd);

    // Apply pre-selected model before sending the prompt
    if (provider && modelId) {
      await session.send({ type: "set_model", provider, modelId });
    }

    // Apply pre-selected thinking level before sending the prompt
    if (thinkingLevel) {
      await session.send({ type: "set_thinking_level", level: thinkingLevel });
    }

    const result = await session.send(promptCommand);

    return NextResponse.json({ success: true, sessionId: realSessionId, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "Not authenticated") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
