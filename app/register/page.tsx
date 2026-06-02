"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allowRegister, setAllowRegister] = useState<boolean | null>(null);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    fetch("/api/auth/register")
      .then((r) => r.json())
      .then((d) => setAllowRegister(d.allowRegister))
      .catch(() => setAllowRegister(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "注册失败");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (allowRegister === false) {
    return (
      <Centered>
        <Box>
          <h1 style={h1}>注册已关闭</h1>
          <p style={hint}>请联系管理员邀请,或<a href="/login" style={link}>返回登录</a></p>
        </Box>
      </Centered>
    );
  }

  return (
    <Centered>
      <form onSubmit={submit} style={box}>
        <h1 style={h1}>注册账户</h1>
        <p style={hint}>第一个注册的用户将自动成为管理员</p>

        <Label>用户名 <Small>(3-32 位小写字母/数字/_/-)</Small></Label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} required
          minLength={3} maxLength={32} pattern="[a-z0-9_\-]+" style={input} autoFocus />

        <Label>显示名 <Small>(可选,默认同用户名)</Small></Label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={32} style={input} />

        <Label>密码 <Small>(至少 6 位)</Small></Label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={input} />

        <Label>确认密码</Label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} style={input} />

        {error && <ErrorBox>{error}</ErrorBox>}

        <SubmitButton busy={busy}>注册并登录</SubmitButton>

        <div style={{ marginTop: 14, textAlign: "center", fontSize: 13, color: "#666" }}>
          已有账户?<a href="/login" style={link}>去登录</a>
        </div>
      </form>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background, #fafafa)" }}>{children}</div>;
}
function Box({ children }: { children: React.ReactNode }) {
  return <div style={{ width: 360, padding: 28, background: "white", border: "1px solid #e5e5e5", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>{children}</div>;
}
const box: React.CSSProperties = { width: 360, padding: 28, background: "white", border: "1px solid #e5e5e5", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" };
const h1: React.CSSProperties = { margin: 0, fontSize: 22, fontWeight: 600 };
const hint: React.CSSProperties = { margin: "4px 0 20px", color: "#888", fontSize: 13 };
const input: React.CSSProperties = { width: "100%", padding: "9px 12px", fontSize: 14, border: "1px solid #ddd", borderRadius: 6, outline: "none", boxSizing: "border-box" };
const link: React.CSSProperties = { color: "#0066cc", marginLeft: 4 };
function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 13, color: "#555", margin: "14px 0 4px" }}>{children}</label>;
}
function Small({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "#aaa", fontWeight: 400, marginLeft: 4, fontSize: 12 }}>{children}</span>;
}
function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 12, padding: "8px 12px", background: "#fff0f0", border: "1px solid #ffcccc", color: "#c00", fontSize: 13, borderRadius: 6 }}>{children}</div>;
}
function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return <button type="submit" disabled={busy} style={{ marginTop: 18, width: "100%", padding: "10px 16px", background: busy ? "#999" : "#1a1a1a", color: "white", border: 0, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: busy ? "default" : "pointer" }}>{busy ? "注册中..." : children}</button>;
}
