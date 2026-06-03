import { NextResponse } from "next/server";
import { requireAdmin, getCurrentUser } from "@/lib/auth/current-user";
import {
  getDefaultModel,
  setDefaultModel,
  deleteDefaultModel,
} from "@/lib/default-model";
import { last4 } from "@/lib/api-keys-store";

export const dynamic = "force-dynamic";

function publicView(cfg: ReturnType<typeof getDefaultModel>, includeKey = false) {
  if (!cfg) return null;
  return {
    provider: cfg.provider,
    modelId: cfg.modelId,
    displayName: cfg.displayName,
    apiKeyLast4: last4(cfg.apiKey),
    hasApiKey: !!cfg.apiKey,
    apiKey: includeKey ? cfg.apiKey : undefined,
    updatedAt: cfg.updatedAt,
    updatedBy: cfg.updatedBy,
  };
}

// GET /api/admin/default-model
// admin 看到完整,普通用户看到脱敏
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ config: publicView(getDefaultModel()) }, { status: 200 });
    if (user.role !== "admin") {
      return NextResponse.json({ config: publicView(getDefaultModel()) }, { status: 200 });
    }
    return NextResponse.json({ config: publicView(getDefaultModel(), true) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/admin/default-model
// body: { provider, modelId, apiKey, displayName? }
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await req.json() as {
      provider?: string;
      modelId?: string;
      apiKey?: string;
      displayName?: string;
    };
    const cfg = setDefaultModel({
      provider: body.provider ?? "",
      modelId: body.modelId ?? "",
      apiKey: body.apiKey ?? "",
      displayName: body.displayName,
      updatedBy: admin.username,
    });
    return NextResponse.json({ success: true, config: publicView(cfg, true) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Not authenticated") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "Admin required") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// DELETE /api/admin/default-model
export async function DELETE() {
  try {
    await requireAdmin();
    deleteDefaultModel();
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Not authenticated") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "Admin required") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
