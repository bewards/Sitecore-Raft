import { NextResponse } from "next/server";
import { getPublicDefaults } from "@/lib/sitecore/config";

export const dynamic = "force-dynamic";

/** GET /api/sitecore/defaults — non-secret host defaults for prefilling the config form. */
export async function GET() {
  return NextResponse.json(getPublicDefaults());
}
