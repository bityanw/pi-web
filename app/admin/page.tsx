"use client";

import { useEffect, useState } from "react";
import { formatBytes, type AdminStats } from "@/lib/admin-stats-types";

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/stats");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setStats(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>加载中...</div>;
  }
  if (error || !stats) {
    return (
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <h1>📊 Admin Dashboard</h1>
        <div style={errBox}>{error || "加载失败"}</div>
        <button onClick={load} style={btnPrimary}>重试</button>
      </div>
    );
  }

  const sortedUsers = [...stats.perUser].sort((a, b) => b.workspaceBytes - a.workspaceBytes);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>📊 Admin Dashboard</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/admin/users" style={btnLink}>👥 用户管理 →</a>
          <button onClick={load} style={btnPrimary}>刷新</button>
        </div>
      </div>

      {/* ── 总览卡片 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Card label="总用户" value={stats.userCount} sub={`${stats.adminCount} admin / ${stats.regularUserCount} 普通`} />
        <Card label="活跃用户" value={stats.activeUserCount} sub={`近 3 天有 session`} accent={stats.activeUserCount > 0 ? "#22c55e" : undefined} />
        <Card label="总 Session" value={stats.totalSessions} sub="全用户累计" />
        <Card label="存储占用" value={formatBytes(stats.totalStorageBytes)} sub="所有工作空间" />
        <Card
          label="默认模型"
          value={stats.defaultModelConfigured ? "已配" : "未配"}
          sub={stats.defaultModelName ?? "在 ModelsConfig 中配置"}
          accent={stats.defaultModelConfigured ? "#0a7" : "#dc2626"}
        />
      </div>

      {/* 提示:管理员默认模型入口 */}
      <div style={{
        padding: "12px 16px",
        background: stats.defaultModelConfigured ? "rgba(34,197,94,0.06)" : "#fffbeb",
        border: `1px solid ${stats.defaultModelConfigured ? "rgba(34,197,94,0.25)" : "#fde68a"}`,
        borderRadius: 8,
        marginBottom: 20,
        fontSize: 13,
        color: stats.defaultModelConfigured ? "#166534" : "#92400e",
      }}>
        {stats.defaultModelConfigured
          ? <>✅ 系统默认模型已配置:<strong style={{ marginLeft: 4 }}>{stats.defaultModelName}</strong>
              <span style={{ marginLeft: 12, color: "#666" }}>
                · 用户登录后会自动使用该模型(<a href="/" style={{ color: "inherit" }}>Models</a> 页可改)
              </span>
            </>
          : <>⚠️ 系统默认模型尚未配置。用户登录后需要自己选 model 并配 key 才能使用。
              <span style={{ marginLeft: 12, color: "#666" }}>
                打开 <a href="/" style={{ color: "inherit", textDecoration: "underline" }}>Models</a> → "管理员默认" 部分配置
              </span>
            </>
        }
      </div>

      {/* ── 用户活动表 ── */}
      <Section title="用户活动(按占用排序)">
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>用户名</th>
              <th style={th}>角色</th>
              <th style={th}>状态</th>
              <th style={th}>活跃</th>
              <th style={th}>Session 数</th>
              <th style={th}>工作空间</th>
              <th style={th}>最后活跃</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((u) => (
              <tr key={u.userId} style={{ opacity: u.disabled ? 0.5 : 1 }}>
                <td style={td}>
                  <code>{u.username}</code>
                  {u.displayName && u.displayName !== u.username && (
                    <span style={{ marginLeft: 6, color: u.hasCorruptedName ? "#dc2626" : "#888", fontSize: 12 }}>
                      · {u.displayName}
                      {u.hasCorruptedName && <span title="显示名包含不可显示字符(U+FFFD),可能是编码问题。需手动修复" style={{ marginLeft: 4 }}>⚠</span>}
                    </span>
                  )}
                </td>
                <td style={td}><span style={u.role === "admin" ? badgeAdmin : badgeUser}>{u.role}</span></td>
                <td style={td}>{u.disabled ? "🚫 禁用" : "✅ 正常"}</td>
                <td style={td}>
                  {u.isActive
                    ? <span style={{ color: "#22c55e" }}>● 活跃</span>
                    : <span style={{ color: "#999" }}>○ 沉睡</span>}
                </td>
                <td style={td}>{u.sessionCount}</td>
                <td style={td}>{formatBytes(u.workspaceBytes)}</td>
                <td style={td}>{u.lastActivity ? new Date(u.lastActivity).toLocaleString("zh-CN") : "—"}</td>
              </tr>
            ))}
            {sortedUsers.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#999" }}>暂无用户</td></tr>
            )}
          </tbody>
        </table>
      </Section>

      <p style={{ marginTop: 20, color: "#888", fontSize: 11, textAlign: "right" }}>
        生成于 {new Date(stats.generatedAt).toLocaleString("zh-CN")}
      </p>
    </div>
  );
}

function Card({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: accent ?? "#1a1a1a" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 10px", color: "#333" }}>{title}</h2>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "white", border: "1px solid #e5e5e5", borderRadius: 8,
  padding: "14px 16px",
};
const errBox: React.CSSProperties = { padding: "10px 14px", background: "#fff0f0", border: "1px solid #ffcccc", color: "#c00", fontSize: 13, borderRadius: 4, marginBottom: 12 };
const btnPrimary: React.CSSProperties = { padding: "8px 16px", background: "#1a1a1a", color: "white", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 13 };
const btnLink: React.CSSProperties = { padding: "8px 12px", background: "transparent", color: "#666", border: "1px solid #ddd", borderRadius: 4, textDecoration: "none", fontSize: 13 };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", background: "white", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" };
const th: React.CSSProperties = { padding: "9px 12px", textAlign: "left", fontSize: 12, color: "#666", background: "#fafafa", borderBottom: "1px solid #e5e5e5" };
const td: React.CSSProperties = { padding: "9px 12px", fontSize: 13, borderBottom: "1px solid #f5f5f5" };
const badgeAdmin: React.CSSProperties = { padding: "1px 6px", background: "#fef3c7", color: "#a16207", borderRadius: 3, fontSize: 11, fontWeight: 600 };
const badgeUser: React.CSSProperties = { padding: "1px 6px", background: "#f3f4f6", color: "#4b5563", borderRadius: 3, fontSize: 11 };
