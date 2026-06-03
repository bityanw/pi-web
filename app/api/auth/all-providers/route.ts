import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getUserKey, last4 } from "@/lib/api-keys-store";
import { getDefaultModelMeta, getDefaultModelKey } from "@/lib/default-model";

export const dynamic = "force-dynamic";

// Providers that use OAuth — handled separately via /api/auth/providers
const OAUTH_PROVIDER_IDS = new Set(["anthropic", "github-copilot", "openai-codex"]);

export async function GET() {
  const authStorage = AuthStorage.create();
  const registry = ModelRegistry.create(authStorage);
  const all = registry.getAll();

  // 拿当前用户(可能为 null,未登录场景兼容)
  const user = await getCurrentUser();

  // admin 的"默认 model"是所有用户唯一的 fallback key
  // 注入到 AuthStorage 让 getAvailable() 能识别
  const adminDefaultMeta = getDefaultModelMeta();
  const adminDefaultKey = getDefaultModelKey();
  if (adminDefaultMeta && adminDefaultKey) {
    authStorage.setRuntimeApiKey(adminDefaultMeta.provider, adminDefaultKey);
  }

  // Deduplicate by provider, skip OAuth-only providers and custom providers (source=models_json_key)
  const seen = new Set<string>();
  const result: {
    id: string;
    displayName: string;
    configured: boolean;
    source?: string;
    modelCount: number;
    // 多用户 key 覆盖
    effectiveSource?: "user" | "default" | null;
    effectiveLast4?: string | null;
    userHasKey?: boolean;
    userLast4?: string | null;
    defaultHasKey?: boolean;
    defaultLast4?: string | null;
  }[] = [];

  for (const m of all) {
    if (seen.has(m.provider)) continue;
    seen.add(m.provider);
    if (OAUTH_PROVIDER_IDS.has(m.provider)) continue;
    const status = registry.getProviderAuthStatus(m.provider);
    // Skip providers whose key comes from models.json (those are custom providers)
    if (status.source === "models_json_key") continue;
    const displayName = registry.getProviderDisplayName(m.provider);
    const modelCount = all.filter((x) => x.provider === m.provider).length;

    const item: typeof result[number] = {
      id: m.provider,
      displayName,
      configured: status.configured,
      source: status.source,
      modelCount,
    };

    // 登录用户才能看 user/default 的覆盖关系
    if (user) {
      const userKeyRaw = getUserKey(user.id, m.provider);
      // 该 provider 的 admin default key = admin 的 default model 用的 key
      const isAdminDefaultProvider = adminDefaultMeta?.provider === m.provider;
      const defaultKeyRaw = isAdminDefaultProvider ? adminDefaultKey : null;
      const effectiveSource: "user" | "default" | null = userKeyRaw
        ? "user"
        : defaultKeyRaw ? "default" : null;
      const effectiveKey = userKeyRaw ?? defaultKeyRaw;
      item.effectiveSource = effectiveSource;
      item.effectiveLast4 = last4(effectiveKey);
      item.userHasKey = userKeyRaw !== null;
      item.userLast4 = last4(userKeyRaw);
      item.defaultHasKey = defaultKeyRaw !== null;
      item.defaultLast4 = last4(defaultKeyRaw);
    }

    result.push(item);
  }

  return Response.json({ providers: result });
}
