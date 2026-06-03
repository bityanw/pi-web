"use client";

import { useEffect, useState } from "react";
import { formatBytes, type PerUserStat } from "@/lib/admin-stats-types";

interface User {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  createdAt: string;
  lastLoginAt: string | null;
  disabled: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [statsById, setStatsById] = useState<Record<string, PerUserStat>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: "", displayName: "", password: "", role: "user" as "user" | "admin" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [ur, sr] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/stats"),
    ]);
    const ud = await ur.json();
    if (ur.ok) setUsers(ud.users);
    if (sr.ok) {
      const sd = await sr.json() as { perUser: PerUserStat[] };
      const map: Record<string, PerUserStat> = {};
      for (const s of sd.perUser) map[s.userId] = s;
      setStatsById(map);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setForm({ username: "", displayName: "", password: "", role: "user" });
      setShowCreate(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function toggleDisabled(u: User) {
    const r = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: !u.disabled }),
    });
    if (r.ok) await load();
  }

  async function changeRole(u: User, role: "admin" | "user") {
    const r = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const d = await r.json();
    if (!r.ok) { alert(d.error); return; }
    await load();
  }

  async function remove(u: User) {
    if (!confirm(`确定删除用户 ${u.username}?`)) return;
    const r = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) { alert(d.error); return; }
    await load();
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>👥 用户管理</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/admin" style={btnLink}>← Dashboard</a>
          <a href="/" style={btnLink}>返回主页</a>
          <button onClick={() => setShowCreate((v) => !v)} style={btnPrimary}>{showCreate ? "取消" : "+ 新建用户"}</button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={create} style={panel}>
          <h3 style={{ marginTop: 0 }}>新建用户</h3>
          <Row label="用户名">
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required style={input} pattern="[a-z0-9_\-]{3,32}" />
          </Row>
          <Row label="显示名">
            <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} style={input} />
          </Row>
          <Row label="密码">
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required style={input} minLength={6} />
          </Row>
          <Row label="角色">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "user" | "admin" })} style={input}>
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </Row>
          {error && <div style={errBox}>{error}</div>}
          <button type="submit" disabled={busy} style={btnPrimary}>{busy ? "创建中..." : "创建"}</button>
        </form>
      )}

      {loading ? <p>加载中...</p> : (
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>用户名</th>
              <th style={th}>显示名</th>
              <th style={th}>角色</th>
              <th style={th}>状态</th>
              <th style={th}>活跃</th>
              <th style={th}>Session</th>
              <th style={th}>存储</th>
              <th style={th}>最近登录</th>
              <th style={th}>最后活跃</th>
              <th style={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const s = statsById[u.id];
              return (
                <tr key={u.id} style={{ opacity: u.disabled ? 0.5 : 1 }}>
                  <td style={td}><code>{u.username}</code></td>
                  <td style={td}>{u.displayName}</td>
                  <td style={td}>
                    <select value={u.role} onChange={(e) => changeRole(u, e.target.value as "admin" | "user")} style={{ ...input, padding: "4px 8px" }}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td style={td}>{u.disabled ? "🚫 禁用" : "✅ 正常"}</td>
                  <td style={td}>
                    {s?.isActive
                      ? <span style={{ color: "#22c55e" }}>● 活跃</span>
                      : <span style={{ color: "#999" }}>○ 沉睡</span>}
                  </td>
                  <td style={td}>{s?.sessionCount ?? "—"}</td>
                  <td style={td}>{s ? formatBytes(s.workspaceBytes) : "—"}</td>
                  <td style={td}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("zh-CN") : "从未"}</td>
                  <td style={td}>{s?.lastActivity ? new Date(s.lastActivity).toLocaleString("zh-CN") : "—"}</td>
                  <td style={td}>
                    <button onClick={() => toggleDisabled(u)} style={btnSmall}>{u.disabled ? "启用" : "禁用"}</button>
                    <button onClick={() => remove(u)} style={{ ...btnSmall, color: "#c00" }}>删除</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 10, gap: 12 }}>
      <label style={{ width: 80, fontSize: 13, color: "#666" }}>{label}</label>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

const panel: React.CSSProperties = { background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: 20, marginBottom: 20 };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 4, outline: "none", boxSizing: "border-box" };
const errBox: React.CSSProperties = { padding: "8px 12px", background: "#fff0f0", border: "1px solid #ffcccc", color: "#c00", fontSize: 13, borderRadius: 4, marginBottom: 10 };
const btnPrimary: React.CSSProperties = { padding: "8px 16px", background: "#1a1a1a", color: "white", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 13 };
const btnLink: React.CSSProperties = { padding: "8px 12px", background: "transparent", color: "#666", border: "1px solid #ddd", borderRadius: 4, textDecoration: "none", fontSize: 13 };
const btnSmall: React.CSSProperties = { padding: "4px 10px", background: "transparent", color: "#333", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", fontSize: 12, marginRight: 6 };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", background: "white", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" };
const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: 12, color: "#666", background: "#fafafa", borderBottom: "1px solid #e5e5e5" };
const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #f5f5f5" };
