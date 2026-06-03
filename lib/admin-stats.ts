/**
 * Admin 统计(server-only)
 *
 * 暴露给 admin 端的全局统计信息：
 * - 用户/活跃用户/总 session
 * - 用户工作空间占用
 *
 * 客户端组件请从 @/lib/admin-stats-types 导入类型与 formatBytes
 */

import { statSync, readdirSync } from "fs";
import { join } from "path";
import { listAllSessions } from "@/lib/session-reader";
import { listUsers } from "@/lib/auth/users";
import { getUserWorkspaceDir } from "@/lib/user-workspace";
import { getDefaultModelMeta } from "@/lib/default-model";
import type { AdminStats, PerUserStat } from "@/lib/admin-stats-types";

// 重导出类型 + 工具,保持向后兼容
export type { AdminStats, PerUserStat } from "@/lib/admin-stats-types";
export { formatBytes } from "@/lib/admin-stats-types";

const ACTIVE_DAYS = 3; // 3 天内有 session 算活跃

// 目录大小(递归,跳过常见大文件/构建产物)
const SKIP_NAMES = new Set([
  "node_modules", ".git", ".next", "dist", "build", "__pycache__",
  ".turbo", ".cache", "coverage", ".pytest_cache", ".mypy_cache",
  "target", "vendor",
]);

function dirSize(p: string): number {
  let total = 0;
  let entries: string[];
  try {
    entries = readdirSync(p);
  } catch {
    return 0;
  }
  for (const name of entries) {
    if (SKIP_NAMES.has(name)) continue;
    const sub = join(p, name);
    let st;
    try {
      st = statSync(sub);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      total += dirSize(sub);
    } else if (st.isFile()) {
      total += st.size;
    }
  }
  return total;
}

/** 检测显示名是否包含 U+FFFD(说明原本的中文在某个环节被损坏) */
function hasCorruptedName(name: string): boolean {
  return /\uFFFD/.test(name);
}

function normalizeForPrefix(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

export async function getAdminStats(): Promise<AdminStats> {
  const users = listUsers();
  const allSessions = await listAllSessions(); // admin 视角,全量
  const threeDaysAgo = Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000;
  const adminDefault = getDefaultModelMeta();

  // === per-user ===
  const perUser: PerUserStat[] = users.map((u) => {
    const home = getUserWorkspaceDir(u.id);
    const homeNorm = normalizeForPrefix(home);
    const userSessions = allSessions.filter(
      (s) => s.cwd && normalizeForPrefix(s.cwd).startsWith(homeNorm)
    );
    const sessionCount = userSessions.length;
    let lastActivity: string | null = null;
    if (userSessions.length > 0) {
      const max = userSessions.reduce((acc, s) => (s.modified > acc ? s.modified : acc), userSessions[0]!.modified);
      lastActivity = max;
    }
    const lastTs = lastActivity ? new Date(lastActivity).getTime() : 0;
    // admin 总是"在线"(他们的角色是管理，不靠 session 活跃度衡量)
    // 被禁用的 admin 不算在线
    const isActive = !u.disabled && (u.role === "admin" || lastTs >= threeDaysAgo);
    return {
      userId: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      disabled: u.disabled,
      workspaceBytes: dirSize(home),
      sessionCount,
      lastActivity,
      isActive,
      hasCorruptedName: hasCorruptedName(u.displayName),
    };
  });

  // === 总览 ===
  const enabledUsers = users.filter((u) => !u.disabled);
  const totalStorage = perUser.reduce((acc, u) => acc + u.workspaceBytes, 0);
  const activeUserCount = perUser.filter((u) => u.isActive).length;

  return {
    userCount: users.length,
    adminCount: users.filter((u) => u.role === "admin").length,
    regularUserCount: users.filter((u) => u.role === "user").length,
    activeUserCount,
    totalSessions: allSessions.length,
    totalStorageBytes: totalStorage,
    defaultModelConfigured: !!adminDefault,
    defaultModelName: adminDefault ? (adminDefault.displayName ?? `${adminDefault.provider}:${adminDefault.modelId}`) : null,
    perUser,
    generatedAt: new Date().toISOString(),
  };
}
