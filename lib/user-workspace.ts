import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

/**
 * 每个用户一个独立的工作空间目录。
 * 位置:$PI_CODING_AGENT_DIR/workspaces/<userId>/
 *
 * 之所以不用 homedir,是为了和 sessions 等数据放一起,备份/迁移方便。
 */
export function getUserWorkspaceDir(userId: string): string {
  const dir = join(getAgentDir(), "workspaces", userId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureUserWorkspace(userId: string): string {
  const dir = getUserWorkspaceDir(userId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}
