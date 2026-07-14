import { NextResponse } from "next/server";
import { testToken } from "@/lib/sitecore/token";

export const dynamic = "force-dynamic";

/** POST /api/sitecore/auth/test — verifies client credentials by fetching a JWT. */
export async function POST() {
  try {
    const result = await testToken();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
