import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/current-user";
import { getDefaultKeys, setDefaultKey, deleteDefaultKey } from "@/lib/api-keys-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ keys: getDefaultKeys() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { provider, apiKey } = await req.json() as { provider?: string; apiKey?: string };
    if (!provider || !apiKey) return NextResponse.json({ error: "provider 和 apiKey 必填" }, { status: 400 });
    setDefaultKey(provider, apiKey);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const { provider } = await req.json() as { provider?: string };
    if (!provider) return NextResponse.json({ error: "provider 必填" }, { status: 400 });
    deleteDefaultKey(provider);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
