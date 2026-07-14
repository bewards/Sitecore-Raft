import { NextRequest, NextResponse } from "next/server";
import { deleteContentTransfer } from "@/lib/sitecore/content-transfer";
import { requireParam, toErrorResponse } from "@/lib/sitecore/route-utils";

export const dynamic = "force-dynamic";

/** DELETE /api/sitecore/content-transfer/delete?host=&transferId= — cleanup on SOURCE. */
export async function DELETE(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const host = requireParam(params, "host");
    const transferId = requireParam(params, "transferId");
    const result = await deleteContentTransfer(host, transferId);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
