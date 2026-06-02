"use client";

import { useEffect, useState } from "react";

const KNOWN_PROVIDERS = [
  { id: "anthropic", name: "Anthropic (Claude)" },
  { id: "openai", name: "OpenAI" },
  { id: "google", name: "Google Gemini" },
  { id: "openai-codex", name: "ChatGPT Plus/Pro" },
  { id: "github-copilot", name: "GitHub Copilot" },
  { id: "mistral", name: "Mistral" },
  { id: "groq", name: "Groq" },
  { id: "cerebras", name: "Cerebras" },
  { id: "xai", name: "xAI (Grok)" },
  { id: "openrouter", name: "OpenRouter" },
];

interface KeyStatus { configured: boolean; source: "default" | "user" | null }

export default function DefaultKeysPage() {
  const [status, setStatus] = useState<Record<string, KeyStatus>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/default-keys");
    const d = await r.json();
    if (r.ok) setStatus(d.keys);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(provider: string) {
    setError(null); setBusy(true);
    try {
      const r = await fetch("/api/admin/default-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setKey(""); setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function remove(provider: string) {
    if (!confirm(`确定删除 ${provider} 的默认 key?`)) return;
    const r = await fetch("/api/admin/default-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (r.ok) await load();
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>🔑 默认 LLM API Key</h1>
        <a href="/" style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4, textDecoration: "none", color: "#666", fontSize: 13 }}>← 返回</a>
      </div>

      <p style={{ color: "#666", fontSize: 13, lineHeight: 1.6 }}>
        这里配置的 key 是<strong>所有用户</strong>的默认 key。
        用户可以在自己的设置中用 "Use my own key" 覆盖。
        Key 在存储时会被加密。
      </p>

      {loading ? <p>加载中...</p> : (
        <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: 4 }}>
          {KNOWN_PROVIDERS.map((p) => {
            const s = status[p.id];
            const isEditing = editing === p.id;
            return (
              <div key={p.id} style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {s?.configured ? (
                        <>✅ 已配置 <code style={{ background: "#f5f5f5", padding: "1px 4px", borderRadius: 3 }}>{p.id}</code></>
                      ) : (
                        <>⚠️ 未配置</>
                      )}
                    </div>
                  </div>
                  <div>
                    {s?.configured && (
                      <button onClick={() => remove(p.id)} style={{ padding: "6px 12px", background: "transparent", color: "#c00", border: "1px solid #fcc", borderRadius: 4, cursor: "pointer", fontSize: 12, marginRight: 6 }}>删除</button>
                    )}
                    <button onClick={() => { setEditing(isEditing ? null : p.id); setKey(""); setError(null); }} style={{ padding: "6px 12px", background: "#1a1a1a", color: "white", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                      {isEditing ? "取消" : s?.configured ? "更新" : "配置"}
                    </button>
                  </div>
                </div>
                {isEditing && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="password"
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      placeholder="sk-..."
                      style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid #ddd", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "var(--font-mono)" }}
                    />
                    {error && <div style={{ color: "#c00", fontSize: 12, marginTop: 6 }}>{error}</div>}
                    <button onClick={() => save(p.id)} disabled={busy || !key.trim()} style={{ marginTop: 8, padding: "6px 14px", background: busy || !key.trim() ? "#999" : "#0a7", color: "white", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                      {busy ? "保存中..." : "保存"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ marginTop: 20, color: "#888", fontSize: 12 }}>
        💡 提示:删除 key 后,如果用户没有自己的 key,系统会回退到用户自己的 LLM 凭据(OAuth 登录等)。
      </p>
    </div>
  );
}
