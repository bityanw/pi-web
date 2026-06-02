import { NextResponse } from "next/server";
import { getCurrentUserPublic } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

// GET /api/auth/me - 返回当前登录用户,未登录返回 null
export async function GET() {
  const user = await getCurrentUserPublic();
  return NextResponse.json({ user });
}
