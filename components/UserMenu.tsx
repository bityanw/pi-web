"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
}

export function UserMenu() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) return null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initial = (user.displayName || user.username).slice(0, 1).toUpperCase();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={user.role === "admin" ? "管理员" : "用户"}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 8px 4px 4px",
          background: "transparent",
          border: "1px solid var(--border, #e5e5e5)",
          borderRadius: 999,
          cursor: "pointer",
          fontSize: 12,
          color: "var(--fg, #333)",
        }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: "50%",
          background: user.role === "admin" ? "#f59e0b" : "#3b82f6",
          color: "white",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 600,
        }}>{initial}</span>
        <span>{user.displayName}</span>
        {user.role === "admin" && (
          <span style={{
            padding: "1px 6px",
            background: "#fef3c7",
            color: "#92400e",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 600,
          }}>ADMIN</span>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          minWidth: 180,
          background: "var(--bg-elevated, white)",
          border: "1px solid var(--border, #e5e5e5)",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          padding: 4,
          zIndex: 1000,
          fontSize: 13,
        }}>
          <div style={{ padding: "8px 10px", color: "#888", fontSize: 12, borderBottom: "1px solid #f0f0f0", marginBottom: 4 }}>
            @{user.username}
          </div>
          {user.role === "admin" && (
            <>
              <MenuItem onClick={() => { setOpen(false); router.push("/admin"); }}>
                📊 Dashboard
              </MenuItem>
              <MenuItem onClick={() => { setOpen(false); router.push("/admin/users"); }}>
                👥 用户管理
              </MenuItem>
            </>
          )}
          <MenuItem onClick={logout}>
            🚪 退出登录
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "8px 10px",
        background: "transparent",
        border: 0,
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 13,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--hover, #f5f5f5)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >{children}</button>
  );
}
