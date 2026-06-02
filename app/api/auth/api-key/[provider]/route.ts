import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { resolveApiKey, setUserKey, deleteUserKey } from "@/lib/api-keys-store";
import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ provider: string }> };

// GET /api/auth/api-key/[provider]
// 返回当前用户对该 provider 的 key 来源(user / default / none)
// 同时也透出 ModelRegistry 的状态(供前端 UI 用)
export async function GET(_req: Request, { params }: Params) {
  try {
    const { provider } = await params;
    const user = await requireUser();
    const resolved = resolveApiKey(user.id, provider);

    // 顺便返回 ModelRegistry 状态(模型列表、displayName)
    const authStorage = AuthStorage.create();
    const registry = ModelRegistry.create(authStorage);
    const status = registry.getProviderAuthStatus(provider);
    const displayName = registry.getProviderDisplayName(provider);
    const models = registry.getAll().filter((m) => m.provider === provider).length;

    return NextResponse.json({
      provider,
      displayName,
      models,
      registryConfigured: status.configured,
      registrySource: status.source,
      // 来自 pi-web 的多层覆盖
      userKey: false, // 总是 false(从不返回明文)
      effectiveSource: resolved.source,
      effectiveConfigured: resolved.source !== null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

// POST /api/auth/api-key/[provider]  body: { apiKey: string }
// 保存当前用户自己的 key(覆盖 admin default)
export async function POST(req: Request, { params }: Params) {
  try {
    const { provider } = await params;
    const user = await requireUser();
    const { apiKey } = await req.json() as { apiKey?: string };
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return NextResponse.json({ error: "apiKey 必填" }, { status: 400 });
    }
    setUserKey(user.id, provider, apiKey);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/auth/api-key/[provider]
// 删除当前用户自己的 key(回退到 admin default)
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { provider } = await params;
    const user = await requireUser();
    deleteUserKey(user.id, provider);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
