/**
 * Admin 统计类型(纯类型,不引入 server-only 代码)
 * 客户端组件可安全 import
 */

export interface PerUserStat {
  userId: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  disabled: boolean;
  workspaceBytes: number;
  sessionCount: number;
  lastActivity: string | null;
  isActive: boolean;
  hasCorruptedName?: boolean;  // 显示名包含 U+FFFD(数据损坏)
}

export interface AdminStats {
  userCount: number;
  adminCount: number;
  regularUserCount: number;
  activeUserCount: number;
  totalSessions: number;
  totalStorageBytes: number;
  defaultModelConfigured: boolean;
  defaultModelName: string | null;
  perUser: PerUserStat[];
  generatedAt: string;
}

// 工具:把字节数格式化成可读字符串
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
