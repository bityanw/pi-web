/**
 * Admin "默认模型" 配置
 *
 * 数据布局($PI_CODING_AGENT_DIR/):
 *   pi-web-default-model.json   - { provider, modelId, apiKey(明文) }
 *
 * 这是给所有用户的"系统默认"模型 + key。
 * 优先级:用户自己的 override > admin 默认 > 环境变量 / models.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

const FILE = "pi-web-default-model.json";

export interface DefaultModelConfig {
  provider: string;
  modelId: string;
  apiKey: string; // 明文存储(AES 加密会增加复杂度;这是 admin 信任的,跟 models.json 一致)
  displayName?: string;
  updatedAt: string;
  updatedBy?: string; // admin username
}

function dataPath(): string {
  return join(getAgentDir(), FILE);
}

function readAll(): DefaultModelConfig | null {
  const p = dataPath();
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as DefaultModelConfig;
    if (!parsed.provider || !parsed.modelId || !parsed.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAll(cfg: DefaultModelConfig): void {
  const p = dataPath();
  mkdirSync(join(p, ".."), { recursive: true });
  const tmp = p + ".tmp";
  writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  const fs = require("fs") as typeof import("fs");
  fs.renameSync(tmp, p);
}

export function getDefaultModel(): DefaultModelConfig | null {
  return readAll();
}

export function setDefaultModel(input: {
  provider: string;
  modelId: string;
  apiKey: string;
  displayName?: string;
  updatedBy?: string;
}): DefaultModelConfig {
  if (!input.provider || !input.modelId || !input.apiKey?.trim()) {
    throw new Error("provider / modelId / apiKey 都必填");
  }
  const cfg: DefaultModelConfig = {
    provider: input.provider,
    modelId: input.modelId,
    apiKey: input.apiKey.trim(),
    displayName: input.displayName,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };
  writeAll(cfg);
  return cfg;
}

export function deleteDefaultModel(): boolean {
  const p = dataPath();
  if (!existsSync(p)) return false;
  const fs = require("fs") as typeof import("fs");
  fs.unlinkSync(p);
  return true;
}

/** 取 admin 默认 model 的 apiKey(供 resolve 时使用) */
export function getDefaultModelKey(): string | null {
  const cfg = readAll();
  return cfg?.apiKey ?? null;
}

/** 取 admin 默认 model 的 provider/modelId 元数据 */
export function getDefaultModelMeta(): { provider: string; modelId: string; displayName?: string } | null {
  const cfg = readAll();
  if (!cfg) return null;
  return { provider: cfg.provider, modelId: cfg.modelId, displayName: cfg.displayName };
}
