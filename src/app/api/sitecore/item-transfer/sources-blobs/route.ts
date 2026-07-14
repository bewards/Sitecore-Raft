import { NextRequest, NextResponse } from "next/server";
import { listBlobSources } from "@/lib/sitecore/item-transfer";
import { requireParam, toErrorResponse } from "@/lib/sitecore/route-utils";

export const dynamic = "force-dynamic";

/** GET /api/sitecore/item-transfer/sources-blobs?host=&page=&pageSize= */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const host = requireParam(params, "host");
    const page = Number(params.get("page") ?? 1);
    const pageSize = Number(params.get("pageSize") ?? 50);
    const result = await listBlobSources(host, page, pageSize);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
