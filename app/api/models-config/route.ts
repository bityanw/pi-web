import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

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

// GET /api/models-config - 共享的 models.json,所有登录用户可读
export async function GET() {
  try {
    return NextResponse.json(readModelsJson());
  } catch {
    return NextResponse.json({ providers: {} });
  }
}

// PUT /api/models-config - 共享的 models.json,所有登录用户可写(custom providers 是协作的)
export async function PUT(req: Request) {
  try {
    const { getCurrentUser } = await import("@/lib/auth/current-user");
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const body = await req.json() as Record<string, unknown>;
    writeModelsJson(body);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
