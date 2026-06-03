import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { setUserKey, deleteUserKey, getUserKey, last4 } from "@/lib/api-keys-store";
import { getDefaultModelMeta, getDefaultModelKey } from "@/lib/default-model";
import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ provider: string }> };

// GET /api/auth/api-key/[provider]
// 返回当前用户对该 provider 的 key 来源 + 脱敏预览（last4）
// "admin 默认" = admin 在 ModelsConfig 里配的 default model + key
export async function GET(_req: Request, { params }: Params) {
  try {
    const { provider } = await params;
    const user = await requireUser();

    // 该 provider 的 admin default key = admin 的 default model 用的 key
    const adminDefaultMeta = getDefaultModelMeta();
    const adminDefaultKey = getDefaultModelKey();
    const isAdminDefaultProvider = adminDefaultMeta?.provider === provider;
    const defaultKeyRaw = isAdminDefaultProvider ? adminDefaultKey : null;
    const userKeyRaw = getUserKey(user.id, provider);
    const effectiveSource: "user" | "default" | null = userKeyRaw
      ? "user"
      : defaultKeyRaw ? "default" : null;
    const effectiveKey = userKeyRaw ?? defaultKeyRaw;

    // 顺便返回 ModelRegistry 状态（模型列表、displayName）
    const authStorage = AuthStorage.create();
    if (defaultKeyRaw) {
      authStorage.setRuntimeApiKey(provider, defaultKeyRaw);
    }
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
      // 当前生效
      effectiveConfigured: effectiveSource !== null,
      effectiveSource,                          // "user" | "default" | null
      effectiveLast4: last4(effectiveKey),      // 脱敏：仅后 4 位
      // 用户自己的 key
      userHasKey: userKeyRaw !== null,
      userLast4: last4(userKeyRaw),
      // admin 默认 key
      defaultHasKey: defaultKeyRaw !== null,
      defaultLast4: last4(defaultKeyRaw),
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
