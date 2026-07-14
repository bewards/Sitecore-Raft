"use client";

import { useState } from "react";
import { labelForRaif, useWizard } from "@/lib/wizard-state";
import { useBlobSources, useHistory, useItemTransfers } from "@/hooks/useSitecore";
import { del } from "@/lib/api-client";
import { Alert, Badge, Button, Card, SkeletonRows } from "@/components/ui";
import type { TransferState } from "@/lib/sitecore/types";

function transferTone(s: TransferState) {
  switch (s) {
    case "Finished":
      return "success" as const;
    case "Failed":
      return "danger" as const;
    case "InProgress":
    case "Queued":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

export function Step6Summary() {
  const { state, reset } = useWizard();
  const { config, transferId, dataTrees, chunkSets, consumes, runLabel } = state;
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: blobSources, isLoading: blobsLoading } = useBlobSources(config.destHost, true);
  const { data: history, isLoading: historyLoading } = useHistory(config.destHost, true);
  const { data: transfers } = useItemTransfers(config.destHost, true);

  // Authoritative state per source (history events can lag / omit Finished).
  const stateById = new Map<string, TransferState>(
    (transfers?.Transfers ?? []).map((t) => [t.Id, t.TransferState]),
  );

  const raifCount = chunkSets.filter((c) => c.raifFileName).length;
  const consumeErrors = consumes.filter((c) => c.error).length;

  async function deleteTransfer() {
    setDeleting(true);
    setError(null);
    try {
      await del(
        `/api/sitecore/content-transfer/delete?host=${encodeURIComponent(
          config.sourceHost,
        )}&transferId=${encodeURIComponent(transferId)}`,
      );
      setDeleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Summary" description="Results of this content transfer run.">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Data trees" value={dataTrees.length} />
          <Stat label="Chunk sets" value={chunkSets.length} />
          <Stat label=".raif files" value={raifCount} />
          <Stat label="Consumed" value={consumes.length - consumeErrors} />
        </dl>

        <div className="mt-5 flex flex-col gap-2">
          {chunkSets.map((c) => {
            const label = (c.label?.trim() || runLabel.trim()) || undefined;
            return (
            <div
              key={c.chunksetId}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <div className="min-w-0">
                {label && (
                  <span className="block truncate font-medium text-zinc-800 dark:text-zinc-200">
                    {label}
                  </span>
                )}
                <span className="block truncate font-mono text-xs text-zinc-500">
                  {c.raifFileName ?? c.chunksetId}
                </span>
              </div>
              <div className="flex gap-3 text-xs text-zinc-500">
                <span>{c.itemsProcessed} processed</span>
                <span>{c.itemsSkipped} skipped</span>
                {c.raifFileName ? (
                  <Badge tone="success">done</Badge>
                ) : (
                  <Badge tone="warning">incomplete</Badge>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Cleanup"
        description="Delete the content transfer operation and its resources on the source. Do this once all .raif files have been consumed."
      >
        {deleted ? (
          <Alert tone="success">Transfer operation deleted from the source.</Alert>
        ) : (
          <div className="flex items-center gap-3">
            <Button variant="danger" onClick={deleteTransfer} loading={deleting}>
              Delete source transfer
            </Button>
            <Button variant="ghost" onClick={reset}>
              Start a new transfer
            </Button>
          </div>
        )}
        {error && (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
      </Card>

      <Card title="Destination blob sources" description="Item Transfer API — .raif sources in blob storage and their state.">
        {blobsLoading && !blobSources && <SkeletonRows rows={2} />}
        {blobSources?.Sources?.length ? (
          <ul className="flex flex-col gap-1.5 text-sm">
            {blobSources.Sources.map((b) => {
              const label = labelForRaif(state, b.Name);
              return (
                <li key={b.Name} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {label && (
                      <span className="block truncate font-medium text-zinc-800 dark:text-zinc-200">
                        {label}
                      </span>
                    )}
                    <span className="block truncate font-mono text-xs text-zinc-500">{b.Name}</span>
                  </div>
                  <Badge tone="neutral">{b.BlobState}</Badge>
                </li>
              );
            })}
          </ul>
        ) : (
          !blobsLoading && <p className="text-sm text-zinc-500">No blob sources.</p>
        )}
      </Card>

      <Card title="Transfer history" description="Item Transfer API — consumed sources timeline.">
        {historyLoading && !history && <SkeletonRows rows={2} />}
        {history?.Sources?.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {history.Sources.map((h, i) => {
              const tState = stateById.get(h.Name);
              const label = labelForRaif(state, h.SourceName);
              return (
                <li key={`${h.SourceName}-${i}`} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {label && (
                        <span className="block truncate font-medium text-zinc-800 dark:text-zinc-200">
                          {label}
                        </span>
                      )}
                      <span className="block truncate font-mono text-xs text-zinc-500">
                        {h.SourceName}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {tState && <Badge tone={transferTone(tState)}>{tState}</Badge>}
                      <Badge tone="neutral">{h.Strategy}</Badge>
                    </div>
                  </div>
                  {h.Events?.length ? (
                    <p className="mt-1 text-xs text-zinc-400">
                      timeline: {h.Events.map((e) => e.Name).join(" → ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          !historyLoading && <p className="text-sm text-zinc-500">No history.</p>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {value}
      </dd>
    </div>
  );
}
