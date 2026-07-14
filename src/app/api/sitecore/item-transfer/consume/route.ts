import { NextRequest, NextResponse } from "next/server";
import { consumeSource } from "@/lib/sitecore/item-transfer";
import { toErrorResponse } from "@/lib/sitecore/route-utils";

export const dynamic = "force-dynamic";

interface Body {
  host: string;
  databaseName: string;
  /** For Content Transfer output (blob storage) — the usual path. */
  blobName?: string;
  /** For .raif files present on the CM file system. */
  fileName?: string;
}

/** POST /api/sitecore/item-transfer/consume — consume a .raif source into the
 *  destination database. Content Transfer output lives in blob storage, so pass
 *  `blobName`; use `fileName` only for file-system sources. */
export async function POST(req: NextRequest) {
  try {
    const { host, databaseName, blobName, fileName } = (await req.json()) as Body;
    if (!host || !databaseName || (!blobName && !fileName)) {
      return NextResponse.json(
        { error: "host, databaseName, and one of blobName / fileName are required." },
        { status: 400 },
      );
    }
    const result = await consumeSource(host, databaseName, { blobName, fileName });
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
