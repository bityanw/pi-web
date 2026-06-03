import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { requireAdmin } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

function getModelsPath(): string {
  return join(getAgentDir(), "models.json");
}

function readModelsJson(): Record<string, unknown> {
  const path = getModelsPath();
  if (!existsSync(path)) return { providers: {} };
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return { providers: {} };
  }
}

function writeModelsJson(data: Record<string, unknown>): void {
  const path = getModelsPath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

// GET /api/models-config
// admin 看到完整内容,普通用户看到空(他们不应该在 ModelsConfig 里编辑)
export async function GET() {
  try {
    const { getCurrentUser } = await import("@/lib/auth/current-user");
    const user = await getCurrentUser();
    if (user?.role === "admin") {
      return NextResponse.json(readModelsJson());
    }
    return NextResponse.json({ providers: {} });
  } catch (e) {
    return NextResponse.json({ providers: {} });
  }
}

// PUT /api/models-config
// admin 才能编辑
export async function PUT(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json() as Record<string, unknown>;
    writeModelsJson(body);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Not authenticated") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "Admin required") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
