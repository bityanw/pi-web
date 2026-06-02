"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// 外层:用 Suspense 包裹,避免 next build 预渲染失败
//   Next.js 要求 useSearchParams 必须包在 Suspense 里,见:
//   https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginLoading() {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--background, #fafafa)",
      color: "#888",
      fontSize: 14,
    }}>
      加载中...
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isFirst, setIsFirst] = useState<boolean | null>(null);
  const [allowRegister, setAllowRegister] = useState(true);

  // 防止 React 18 双调用
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    fetch("/api/auth/register")
      .then((r) => r.json())
      .then((d) => {
        setIsFirst(d.allowRegister);
        setAllowRegister(d.allowRegister);
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "登录失败");
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--background, #fafafa)",
      fontFamily: "inherit",
    }}>
      <form onSubmit={submit} style={{
        width: 360,
        padding: 28,
        background: "white",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>pi-web 登录</h1>
        <p style={{ margin: "4px 0 20px", color: "#888", fontSize: 13 }}>
          {isFirst === false ? "请登录您的账户" : "首次启动,请注册第一个用户(将自动成为管理员)"}
        </p>

        <label style={{ display: "block", fontSize: 13, color: "#555", marginBottom: 4 }}>用户名</label>
        <input
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={32}
          pattern="[a-z0-9_\-]+"
          style={inputStyle}
          placeholder="小写字母/数字/下划线"
        />

        <label style={{ display: "block", fontSize: 13, color: "#555", margin: "14px 0 4px" }}>密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={inputStyle}
        />

        {error && (
          <div style={{
            marginTop: 12,
            padding: "8px 12px",
            background: "#fff0f0",
            border: "1px solid #ffcccc",
            color: "#c00",
            fontSize: 13,
            borderRadius: 6,
          }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 18,
            width: "100%",
            padding: "10px 16px",
            background: busy ? "#999" : "#1a1a1a",
            color: "white",
            border: 0,
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: busy ? "default" : "pointer",
          }}
        >{busy ? "登录中..." : "登录"}</button>

        {allowRegister && (
          <div style={{ marginTop: 14, textAlign: "center", fontSize: 13, color: "#666" }}>
            还没有账户?<a href="/register" style={{ color: "#0066cc", marginLeft: 4 }}>去注册</a>
          </div>
        )}
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 14,
  border: "1px solid #ddd",
  borderRadius: 6,
  outline: "none",
  boxSizing: "border-box",
};
