import { NextRequest, NextResponse } from "next/server";
import { getContentTransferStatus } from "@/lib/sitecore/content-transfer";
import { requireParam, toErrorResponse } from "@/lib/sitecore/route-utils";

export const dynamic = "force-dynamic";

/** GET /api/sitecore/content-transfer/status?host=&transferId= — poll status on SOURCE. */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const host = requireParam(params, "host");
    const transferId = requireParam(params, "transferId");
    const status = await getContentTransferStatus(host, transferId);
    return NextResponse.json(status);
  } catch (err) {
    return toErrorResponse(err);
  }
}
