"use client";

import { useRef, useState } from "react";
import { useWizard, type ChunkSetProgress } from "@/lib/wizard-state";
import { postJson } from "@/lib/api-client";
import { Alert, Badge, Button, Card, Field, ProgressBar, TextInput } from "@/components/ui";
import type { CompleteChunkSetResult, CopyChunkResult } from "@/lib/sitecore/types";

function sumMs(results: CopyChunkResult[]): number {
  return results.reduce((sum, r) => sum + (r.ms ?? 0), 0);
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function Step4Stream() {
  const { state, update } = useWizard();
  const { config, transferId, chunkSets, runLabel } = state;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setChunkSetLabel(chunksetId: string, label: string) {
    update({
      chunkSets: chunkSets.map((c) => (c.chunksetId === chunksetId ? { ...c, label } : c)),
    });
  }
  // Keep a live working copy so sequential updates don't clobber each other.
  const workingRef = useRef<ChunkSetProgress[]>(chunkSets);

  const allDone =
    chunkSets.length > 0 && chunkSets.every((c) => !!c.raifFileName);

  function commit(sets: ChunkSetProgress[]) {
    workingRef.current = sets;
    update({ chunkSets: [...sets] });
  }

  async function runAll() {
    setRunning(true);
    setError(null);
    workingRef.current = chunkSets.map((c) => ({ ...c, error: undefined }));
    commit(workingRef.current);

    try {
      for (let si = 0; si < workingRef.current.length; si++) {
        const set = workingRef.current[si];
        if (set.raifFileName) continue; // already completed

        let itemsProcessed = 0;
        let itemsSkipped = 0;
        const results: CopyChunkResult[] = [];

        for (let chunkId = 0; chunkId < set.chunkCount; chunkId++) {
          const t0 = performance.now();
          const res = await postJson<CopyChunkResult>(
            "/api/sitecore/content-transfer/copy-chunk",
            {
              sourceHost: config.sourceHost,
              destHost: config.destHost,
              transferId,
              chunksetId: set.chunksetId,
              chunkId,
            },
          );
          res.ms = Math.round(performance.now() - t0);
          results.push(res);
          itemsProcessed += res.itemsProcessed;
          itemsSkipped += res.itemsSkipped;

          const updated = [...workingRef.current];
          updated[si] = {
            ...updated[si],
            chunksDone: chunkId + 1,
            itemsProcessed,
            itemsSkipped,
            results,
          };
          commit(updated);
        }

        // Complete the chunk set → generates the .raif on the destination.
        const complete = await postJson<CompleteChunkSetResult>(
          "/api/sitecore/content-transfer/complete",
          {
            host: config.destHost,
            transferId,
            chunksetId: set.chunksetId,
          },
        );
        const updated = [...workingRef.current];
        updated[si] = { ...updated[si], raifFileName: complete.ContentTransferFileName };
        commit(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Streaming failed");
    } finally {
      setRunning(false);
    }
  }

  const totalChunks = chunkSets.reduce((sum, c) => sum + c.chunkCount, 0);
  const doneChunks = chunkSets.reduce((sum, c) => sum + c.chunksDone, 0);
  const totalMs = chunkSets.reduce((sum, c) => sum + sumMs(c.results), 0);

  return (
    <Card
      title="Stream chunks & complete sets"
      description="For each chunk set, every chunk is copied source → destination (server-side, bytes unaltered), then the set is completed to produce a .raif file on the destination."
      actions={
        <Button onClick={runAll} loading={running} disabled={chunkSets.length === 0}>
          {allDone ? "Re-run" : running ? "Streaming…" : "Start streaming"}
        </Button>
      }
    >
      {chunkSets.length === 0 && (
        <Alert tone="warning">No chunk sets yet — complete the Monitor step first.</Alert>
      )}

      {chunkSets.length > 0 && (
        <>
          <div className="mb-5">
            <Field
              label="Friendly label (optional)"
              hint="A human-readable name for this transfer, shown alongside the system .raif name in the Consume and Summary steps. Applies to every .raif in this run unless overridden per chunk set below."
            >
              <TextInput
                value={runLabel}
                onChange={(e) => update({ runLabel: e.target.value })}
                placeholder="e.g. Maryland site content — Jul 2026"
              />
            </Field>
          </div>

          <div className="mb-5">
            <div className="mb-1 flex justify-between text-xs text-zinc-500">
              <span>Overall chunks copied</span>
              {totalMs > 0 && <span>total copy time: {formatMs(totalMs)}</span>}
            </div>
            <ProgressBar value={doneChunks} max={totalChunks} />
          </div>

          <div className="flex flex-col gap-4">
            {chunkSets.map((c) => (
              <div
                key={c.chunksetId}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {c.chunksetId}
                  </span>
                  {c.raifFileName ? (
                    <Badge tone="success">✓ {c.raifFileName}</Badge>
                  ) : c.error ? (
                    <Badge tone="danger">error</Badge>
                  ) : (
                    <Badge tone="neutral">{c.totalItemCount} items</Badge>
                  )}
                </div>
                <ProgressBar value={c.chunksDone} max={c.chunkCount} />
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
                  <span>processed: {c.itemsProcessed}</span>
                  <span>skipped: {c.itemsSkipped}</span>
                  {c.results.length > 0 && (
                    <>
                      <span>total: {formatMs(sumMs(c.results))}</span>
                      <span>avg/chunk: {formatMs(sumMs(c.results) / c.results.length)}</span>
                    </>
                  )}
                </div>
                {c.results.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.results.map((r) => (
                      <span
                        key={r.chunkId}
                        title={`chunk ${r.chunkId}: ${r.itemsProcessed} items, ${r.bytes} bytes`}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        #{r.chunkId}·{formatMs(r.ms ?? 0)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <TextInput
                    value={c.label ?? ""}
                    onChange={(e) => setChunkSetLabel(c.chunksetId, e.target.value)}
                    placeholder={runLabel ? `Label (defaults to "${runLabel}")` : "Label for this .raif (optional)"}
                    className="text-xs"
                  />
                </div>
                {c.error && <p className="mt-2 text-xs text-red-600">{c.error}</p>}
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}
          {allDone && (
            <div className="mt-4">
              <Alert tone="success">
                All chunk sets completed. {chunkSets.length} .raif file(s) are ready on the
                destination — continue to <strong>Consume</strong>.
              </Alert>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
