import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
  "/favicon.ico",
];

export const config = {
  // 匹配除静态资源外的所有路径
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map|woff2?)$).*)"],
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 公开路径直接放行
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("pi_web_session")?.value;
  if (!token) {
    return unauthenticated(req);
  }
  const payload = await verifySession(token);
  if (!payload) {
    return unauthenticated(req);
  }

  // 把用户信息传给下游(headers 注入,可选)
  const res = NextResponse.next();
  res.headers.set("x-pi-uid", payload.uid);
  res.headers.set("x-pi-uname", payload.uname);
  res.headers.set("x-pi-role", payload.role);
  return res;
}

function unauthenticated(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

// 注:Next.js 16 将 middleware 改名为 proxy.ts,旧名仍可用但有弃用警告。
// 新代码建议直接用 proxy.ts,旧项目保持 middleware.ts 不影响。
