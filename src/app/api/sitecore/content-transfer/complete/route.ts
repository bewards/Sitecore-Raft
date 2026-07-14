import { NextRequest, NextResponse } from "next/server";
import { completeChunkSet } from "@/lib/sitecore/content-transfer";
import { toErrorResponse } from "@/lib/sitecore/route-utils";

export const dynamic = "force-dynamic";

interface Body {
  host: string;
  transferId: string;
  chunksetId: string;
}

/** POST /api/sitecore/content-transfer/complete — complete a chunk set on the DESTINATION,
 *  producing a .raif file. Returns { ContentTransferFileName }. */
export async function POST(req: NextRequest) {
  try {
    const { host, transferId, chunksetId } = (await req.json()) as Body;
    if (!host || !transferId || !chunksetId) {
      return NextResponse.json(
        { error: "host, transferId, and chunksetId are required." },
        { status: 400 },
      );
    }
    const result = await completeChunkSet(host, transferId, chunksetId);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
