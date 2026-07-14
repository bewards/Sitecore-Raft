import { NextRequest, NextResponse } from "next/server";
import { copyChunk } from "@/lib/sitecore/content-transfer";
import { toErrorResponse } from "@/lib/sitecore/route-utils";

export const dynamic = "force-dynamic";
// Chunk copies can be large; give the route generous time.
export const maxDuration = 300;

interface Body {
  sourceHost: string;
  destHost: string;
  transferId: string;
  chunksetId: string;
  chunkId: number;
}

/**
 * POST /api/sitecore/content-transfer/copy-chunk
 * Copies one chunk source→destination server-side and returns per-chunk metrics.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { sourceHost, destHost, transferId, chunksetId } = body;
    if (!sourceHost || !destHost || !transferId || !chunksetId || body.chunkId == null) {
      return NextResponse.json(
        { error: "sourceHost, destHost, transferId, chunksetId, chunkId are required." },
        { status: 400 },
      );
    }
    const result = await copyChunk(body);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
