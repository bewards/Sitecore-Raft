import { NextRequest, NextResponse } from "next/server";
import { createContentTransfer } from "@/lib/sitecore/content-transfer";
import { toErrorResponse } from "@/lib/sitecore/route-utils";
import type { DataTree } from "@/lib/sitecore/types";

export const dynamic = "force-dynamic";

interface Body {
  host: string;
  transferId: string;
  dataTrees: DataTree[];
}

/** POST /api/sitecore/content-transfer/create — create a transfer on the SOURCE env. */
export async function POST(req: NextRequest) {
  try {
    const { host, transferId, dataTrees } = (await req.json()) as Body;
    if (!host || !transferId || !dataTrees?.length) {
      return NextResponse.json(
        { error: "host, transferId, and at least one dataTree are required." },
        { status: 400 },
      );
    }
    const result = await createContentTransfer(host, transferId, dataTrees);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
