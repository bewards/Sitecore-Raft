"use client";

import { useEffect } from "react";
import { useWizard, type ChunkSetProgress } from "@/lib/wizard-state";
import { useContentTransferStatus } from "@/hooks/useSitecore";
import { Alert, Badge, Button, Card, SkeletonRows } from "@/components/ui";
import type { ContentTransferState } from "@/lib/sitecore/types";

function stateTone(s?: ContentTransferState): "info" | "success" | "danger" | "neutral" {
  switch (s) {
    case "Completed":
      return "success";
    case "Failed":
      return "danger";
    case "Running":
      return "info";
    default:
      return "neutral";
  }
}

export function Step3Monitor() {
  const { state, update } = useWizard();
  const { config, transferId, created } = state;
  const { data, error, isLoading, mutate } = useContentTransferStatus(
    config.sourceHost,
    transferId,
    created,
  );

  // When completed, seed the chunk-set progress records for the streaming step.
  useEffect(() => {
    if (data?.State !== "Completed" || !data.ChunkSetsMetadata?.length) return;
    // Only seed once (or when the set of chunkset ids changes).
    const incomingIds = data.ChunkSetsMetadata.map((c) => c.ChunkSetId).join(",");
    const existingIds = state.chunkSets.map((c) => c.chunksetId).join(",");
    if (incomingIds === existingIds) return;

    const seeded: ChunkSetProgress[] = data.ChunkSetsMetadata.map((c) => ({
      chunksetId: c.ChunkSetId,
      chunkCount: c.ChunkCount,
      totalItemCount: c.TotalItemCount,
      chunksDone: 0,
      itemsProcessed: 0,
      itemsSkipped: 0,
      results: [],
    }));
    update({ chunkSets: seeded });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.State, data?.ChunkSetsMetadata]);

  return (
    <Card
      title="Monitor transfer"
      description="Checks the source until it's done building. Each chunk set becomes one .raif once you stream."
      actions={
        <Button variant="secondary" onClick={() => mutate()}>
          Refresh
        </Button>
      }
    >
      {!created && <Alert tone="warning">Create the transfer first (previous step).</Alert>}

      {created && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm text-zinc-500">State:</span>
            <Badge tone={stateTone(data?.State)}>{data?.State ?? "…"}</Badge>
            {data?.State === "Running" && (
              <span className="text-xs text-zinc-400">auto-refreshing…</span>
            )}
          </div>

          {error && <Alert tone="danger">{String(error)}</Alert>}

          {isLoading && !data && <SkeletonRows rows={3} />}

          {data?.ChunkSetsMetadata && data.ChunkSetsMetadata.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                    <th className="py-2 pr-3 font-medium">Chunk set ID</th>
                    <th className="py-2 pr-3 font-medium">Chunks</th>
                    <th className="py-2 font-medium">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ChunkSetsMetadata.map((c) => (
                    <tr key={c.ChunkSetId} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="py-2 pr-3 font-mono text-xs">{c.ChunkSetId}</td>
                      <td className="py-2 pr-3 tabular-nums">{c.ChunkCount}</td>
                      <td className="py-2 tabular-nums">{c.TotalItemCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data?.State === "Completed" && (
            <div className="mt-4">
              <Alert tone="success">
                Done — {data.ChunkSetsMetadata?.length ?? 0} chunk set(s) ready. On to{" "}
                <strong>Stream chunks</strong>.
              </Alert>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
