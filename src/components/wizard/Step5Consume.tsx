"use client";

import { useState } from "react";
import { labelForRaif, useWizard, type ConsumeProgress } from "@/lib/wizard-state";
import {
  useBlobSources,
  useHistory,
  useItemTransfers,
  useTransferDetails,
} from "@/hooks/useSitecore";
import { postJson } from "@/lib/api-client";
import { Alert, Badge, Button, Card, SkeletonRows } from "@/components/ui";
import type {
  BlobState,
  HistoryEvent,
  TransferState,
  TransferStatusResult,
} from "@/lib/sitecore/types";

/**
 * Active consumption time = sum of each InProgress→Finished interval, from the
 * history event log. Pairing this way naturally excludes any Queued gaps.
 * Returns null if the transfer hasn't finished (or has no event data yet).
 */
function activeProcessingMs(events: HistoryEvent[] | undefined): number | null {
  if (!events?.length) return null;
  let total = 0;
  let startedAt: number | null = null;
  let finished = false;
  for (const e of events) {
    const t = Date.parse(e.Date);
    if (Number.isNaN(t)) continue;
    if (e.Name === "InProgress") {
      startedAt = t;
    } else if (e.Name === "Finished" && startedAt != null) {
      total += t - startedAt;
      startedAt = null;
      finished = true;
    }
  }
  return finished ? total : null;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

/**
 * Progress / time cell for a transfer row. Driven by the authoritative details
 * endpoint (`/transfers/{id}`) because `/transfers` + `/history` are unreliable
 * for large runs (state can lag, and history may omit the Finished event):
 * - while running: live item-count bar (TransferredItemsCount / TotalItemsCount);
 * - finished, with a history Finished event: total processing time (queued excluded);
 * - finished, without one: "✓ done" + final item count (time can't be computed).
 */
function ProgressCell({
  host,
  transfer,
  events,
}: {
  host: string;
  transfer: TransferStatusResult;
  events: HistoryEvent[] | undefined;
}) {
  const { data } = useTransferDetails(host, transfer.Id, !!host);
  const state = data?.TransferState ?? transfer.TransferState;
  const total = data?.TotalItemsCount ?? 0;
  const done = data?.TransferredItemsCount ?? 0;
  const running = state === "InProgress" || state === "Queued";
  const activeMs = activeProcessingMs(events);

  if (running) {
    if (total === 0) return <span className="text-xs text-zinc-500">working…</span>;
    const pct = Math.min(100, Math.round((done / total) * 100));
    return (
      <div className="flex flex-col gap-1">
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] tabular-nums text-zinc-500">
          {done.toLocaleString()} / {total.toLocaleString()} ({pct}%)
        </span>
      </div>
    );
  }

  // Prefer a real processing time when history recorded a Finished event.
  if (activeMs != null) {
    return (
      <span
        className="text-xs tabular-nums text-zinc-500"
        title="Processing time (InProgress→Finished, queued excluded)"
      >
        {formatMs(activeMs)}
      </span>
    );
  }

  // Finished, but the API didn't log a Finished event in history, so there's no
  // finish timestamp to compute a duration from — show completion + final count.
  if (state === "Finished") {
    return (
      <span
        className="text-xs tabular-nums text-zinc-500"
        title="Finished — the API did not record a Finished event in history, so processing time is unavailable"
      >
        ✓ done{total > 0 ? ` · ${done.toLocaleString()}/${total.toLocaleString()}` : ""}
      </span>
    );
  }

  return <span className="text-xs text-zinc-500">—</span>;
}

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

function blobTone(s: BlobState) {
  switch (s) {
    case "Consumed":
    case "Transferred":
      return "success" as const;
    case "Error":
    case "TransferredWithErrors":
      return "danger" as const;
    case "Initializing":
    case "Queued":
    case "Uploading":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

export function Step5Consume() {
  const { state, update } = useWizard();
  const { config, chunkSets, consumes } = state;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The Content Transfer "complete" step writes each .raif to blob storage,
  // so we consume by blobName.
  const raifFiles = chunkSets.map((c) => c.raifFileName).filter(Boolean) as string[];
  const { data: blobs, isLoading: blobsLoading, mutate: mutateBlobs } = useBlobSources(
    config.destHost,
    true,
  );
  const { data: transfers, mutate: mutateTransfers } = useItemTransfers(config.destHost, true);
  const { data: history } = useHistory(config.destHost, true);

  // Join history (which carries per-state event timestamps) to transfers by Id.
  const eventsByName = new Map<string, HistoryEvent[]>(
    (history?.Sources ?? []).map((h) => [h.Name, h.Events]),
  );

  async function consumeAll() {
    setBusy(true);
    setError(null);
    const results: ConsumeProgress[] = [];
    try {
      for (const blobName of raifFiles) {
        try {
          const res = await postJson<{ status: number; location: string | null }>(
            "/api/sitecore/item-transfer/consume",
            { host: config.destHost, databaseName: config.database, blobName },
          );
          const transferId = res.location
            ? decodeURIComponent(res.location.split("/").filter(Boolean).pop() ?? "")
            : undefined;
          results.push({ raifFileName: blobName, location: res.location ?? undefined, transferId });
        } catch (err) {
          results.push({
            raifFileName: blobName,
            error: err instanceof Error ? err.message : "Consume failed",
          });
        }
      }
      update({ consumes: results });
      mutateBlobs();
      mutateTransfers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Consume failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Consume .raif files"
        description="Each .raif produced by the transfer lands in the destination's blob storage; consuming it imports the items into the target database (Item Transfer API)."
        actions={
          <Button onClick={consumeAll} loading={busy} disabled={raifFiles.length === 0}>
            Consume {raifFiles.length} file(s)
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">Destination:</span>
          <Badge tone="info">{config.destHost || "— not set —"}</Badge>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-500">database: {config.database}</span>
        </div>

        {raifFiles.length === 0 ? (
          <Alert tone="warning">No .raif files yet — complete the Stream step first.</Alert>
        ) : (
          <ul className="flex flex-col gap-2">
            {raifFiles.map((f) => {
              const result = consumes.find((c) => c.raifFileName === f);
              const blob = blobs?.Sources?.find((b) => b.Name === f);
              const label = labelForRaif(state, f);
              return (
                <li
                  key={f}
                  className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {label && (
                        <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {label}
                        </span>
                      )}
                      <span className="block truncate font-mono text-xs text-zinc-500">{f}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {blob && <Badge tone={blobTone(blob.BlobState)}>{blob.BlobState}</Badge>}
                      {result?.error ? (
                        <Badge tone="danger">error</Badge>
                      ) : result ? (
                        <Badge tone="success">queued</Badge>
                      ) : (
                        <Badge tone="neutral">pending</Badge>
                      )}
                    </div>
                  </div>
                  {result?.error && (
                    <p className="mt-2 break-words text-xs text-red-600 dark:text-red-400">
                      {result.error}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {error && (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
      </Card>

      <Card
        title="Destination transfers"
        description="Consumed/transferred sources on the destination (auto-refreshing). Registration can lag a few seconds after consuming."
        actions={
          <Button variant="secondary" onClick={() => mutateTransfers()}>
            Refresh
          </Button>
        }
      >
        {blobsLoading && !transfers && <SkeletonRows rows={3} />}
        {transfers?.Transfers && transfers.Transfers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Database</th>
                  <th className="py-2 pr-3 font-medium">State</th>
                  <th className="py-2 pr-3 font-medium">Consumed</th>
                  <th
                    className="py-2 font-medium"
                    title="Live item count while running (TransferredItemsCount / TotalItemsCount); total processing time once finished (queued time excluded)"
                  >
                    Progress / time
                  </th>
                </tr>
              </thead>
              <tbody>
                {transfers.Transfers.map((t) => (
                  <tr key={t.Id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-3">
                      {(() => {
                        const label = labelForRaif(state, t.SourceName);
                        return label ? (
                          <>
                            <span className="block text-xs font-medium text-zinc-800 dark:text-zinc-200">
                              {label}
                            </span>
                            <span className="block font-mono text-[11px] text-zinc-400">
                              {t.SourceName}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono text-xs">{t.SourceName}</span>
                        );
                      })()}
                    </td>
                    <td className="py-2 pr-3">{t.DatabaseName}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={transferTone(t.TransferState)}>{t.TransferState}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">{formatDate(t.ConsumedDate)}</td>
                    <td className="py-2">
                      <ProgressCell host={config.destHost} transfer={t} events={eventsByName.get(t.Id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-sm text-zinc-500">No transfers reported yet.</p>
        )}
      </Card>
    </div>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
