import { AuthStorage, ModelRegistry, SettingsManager, getAgentDir } from "@earendil-works/pi-coding-agent";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { getDefaultModelMeta, getDefaultModelKey } from "@/lib/default-model";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const nameMap = new Map<string, string>();
  let modelList: { id: string; name: string; provider: string }[] = [];
  let defaultModel: { provider: string; modelId: string } | null = null;
  const thinkingLevels: Record<string, string[]> = {};
  const thinkingLevelMaps: Record<string, Record<string, string | null>> = {};

  try {
    const agentDir = getAgentDir();
    const authStorage = AuthStorage.create();
    // 注入 admin 默认 model 的 key,让 getAvailable() 能识别该 provider
    const adminDefaultMeta = getDefaultModelMeta();
    const adminDefaultKey = getDefaultModelKey();
    if (adminDefaultMeta && adminDefaultKey) {
      authStorage.setRuntimeApiKey(adminDefaultMeta.provider, adminDefaultKey);
    }
    const registry = ModelRegistry.create(authStorage);
    const available = registry.getAvailable();
    const all = registry.getAll();
    modelList = available.map((m: { id: string; name: string; provider: string }) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
    }));
    for (const m of available) {
      const key = `${m.provider}:${m.id}`;
      nameMap.set(key, m.name);
      thinkingLevels[key] = getSupportedThinkingLevels(m);
      if (m.thinkingLevelMap) thinkingLevelMaps[key] = m.thinkingLevelMap;
    }

    // 优先级：admin 在 pi-web 配的默认 model > 用户自己 settings.json 里的默认值 > 首个可用 model
    // (注意：SettingsManager 读的是共享的 ~/.pi/agent/settings.json，在多用户环境下 admin 默认应优先)
    if (adminDefaultMeta && available.some((m: { id: string; provider: string }) =>
      m.provider === adminDefaultMeta.provider && m.id === adminDefaultMeta.modelId)) {
      defaultModel = { provider: adminDefaultMeta.provider, modelId: adminDefaultMeta.modelId };
    } else {
      const settings = SettingsManager.create(process.cwd(), agentDir);
      const provider = settings.getDefaultProvider();
      const modelId = settings.getDefaultModel();
      if (provider) {
        defaultModel = { provider, modelId: modelId ?? available[0]?.id ?? "" };
      }
    }

    // 权限：普通用户只能看到 admin 默认 model，不能选别的
    // - admin 看到全部 available
    // - regular user 只看到 default model 一个
    const user = await getCurrentUser();
    const isAdmin = user?.role === "admin";
    if (!isAdmin && defaultModel) {
      const isDefaultInAvailable = modelList.some(
        (m) => m.provider === defaultModel!.provider && m.id === defaultModel!.modelId
      );
      if (isDefaultInAvailable) {
        // 只保留 default model
        modelList = modelList.filter(
          (m) => m.provider === defaultModel!.provider && m.id === defaultModel!.modelId
        );
        // 同步 thinking levels 也要只保留 default model 的
        const defaultKey = `${defaultModel.provider}:${defaultModel.modelId}`;
        for (const k of Object.keys(thinkingLevels)) {
          if (k !== defaultKey) delete thinkingLevels[k];
        }
        for (const k of Object.keys(thinkingLevelMaps)) {
          if (k !== defaultKey) delete thinkingLevelMaps[k];
        }
        for (const k of Object.keys(nameMap)) {
          if (k !== defaultKey) nameMap.delete(k);
        }
      } else {
        // default 不可用,清空 list(用户根本不能用)
        modelList = [];
        Object.keys(thinkingLevels).forEach((k) => delete thinkingLevels[k]);
        Object.keys(thinkingLevelMaps).forEach((k) => delete thinkingLevelMaps[k]);
        nameMap.clear();
      }
    }
  } catch { /* return empty */ }

  return Response.json({ models: Object.fromEntries(nameMap), modelList, defaultModel, thinkingLevels, thinkingLevelMaps });
}
