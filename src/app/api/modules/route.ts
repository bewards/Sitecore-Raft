import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseModuleText } from "@/lib/sitecore/module-parser";
import type { DataTreeRow } from "@/lib/sitecore/types";

export const dynamic = "force-dynamic";

const SAMPLES_DIR = path.join(process.cwd(), "serialization-samples");

interface ModuleSummary {
  fileName: string;
  namespace?: string;
  tags: string[];
  rows: DataTreeRow[];
}

/**
 * GET /api/modules — reads the bundled serialization-samples/*.module.json files
 * and returns them parsed into DataTree rows, so the wizard can offer them as
 * import presets grouped by step tag.
 */
export async function GET() {
  try {
    const entries = await readdir(SAMPLES_DIR);
    const files = entries.filter((f) => f.endsWith(".module.json"));

    const modules: ModuleSummary[] = [];
    for (const fileName of files) {
      const text = await readFile(path.join(SAMPLES_DIR, fileName), "utf8");
      const raw = JSON.parse(text) as { namespace?: string; tags?: string[] };
      modules.push({
        fileName,
        namespace: raw.namespace,
        tags: raw.tags ?? [],
        rows: parseModuleText(text),
      });
    }

    return NextResponse.json({ modules });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ modules: [], error: message }, { status: 500 });
  }
}
