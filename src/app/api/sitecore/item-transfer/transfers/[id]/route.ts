import { NextRequest, NextResponse } from "next/server";
import { getTransferDetails } from "@/lib/sitecore/item-transfer";
import { requireParam, toErrorResponse } from "@/lib/sitecore/route-utils";

export const dynamic = "force-dynamic";

/** GET /api/sitecore/item-transfer/transfers/{id}?host= — transfer details/metrics. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const host = requireParam(req.nextUrl.searchParams, "host");
    const result = await getTransferDetails(host, id);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
