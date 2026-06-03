import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/current-user";
import { getAdminStats } from "@/lib/admin-stats";

export const dynamic = "force-dynamic";

// GET /api/admin/stats
// 返回 admin dashboard 用的全局统计
export async function GET() {
  try {
    await requireAdmin();
    const stats = await getAdminStats();
    return NextResponse.json(stats);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Not authenticated") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    if (msg.includes("Forbidden") || msg.includes("Admin")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
