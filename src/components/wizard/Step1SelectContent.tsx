"use client";

import { ChangeEvent, useMemo, useRef } from "react";
import useSWR from "swr";
import { useWizard } from "@/lib/wizard-state";
import { getJson } from "@/lib/api-client";
import { parseModuleText } from "@/lib/sitecore/module-parser";
import {
  MERGE_STRATEGIES,
  TRANSFER_SCOPES,
  type DataTreeRow,
  type MergeStrategy,
  type TransferScope,
} from "@/lib/sitecore/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Select,
  SkeletonRows,
  TextInput,
} from "@/components/ui";

interface ModuleSummary {
  fileName: string;
  namespace?: string;
  tags: string[];
  rows: DataTreeRow[];
}

let uiSeq = 0;
function newRowId() {
  uiSeq += 1;
  return `ui-${Date.now()}-${uiSeq}`;
}

export function Step1SelectContent() {
  const { state, setDataTrees, update, regenerateTransferId } = useWizard();
  const { dataTrees, transferId } = state;
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useSWR<{ modules: ModuleSummary[] }>(
    "/api/modules",
    getJson,
    { revalidateOnFocus: false },
  );

  function addRows(rows: DataTreeRow[]) {
    // Dedupe by ItemPath (case-insensitive) against existing rows AND within the
    // incoming batch (adding by tag can pull the same path from several modules).
    const seen = new Set(dataTrees.map((r) => r.ItemPath.trim().toLowerCase()));
    const fresh: DataTreeRow[] = [];
    for (const r of rows) {
      const key = r.ItemPath.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      fresh.push({ ...r, id: newRowId() });
    }
    setDataTrees([...dataTrees, ...fresh]);
  }

  // Distinct tags across all modules, and the rows contributed by each tag.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    data?.modules.forEach((m) => m.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [data]);

  function rowsForTag(tag: string): DataTreeRow[] {
    return (data?.modules ?? []).filter((m) => m.tags.includes(tag)).flatMap((m) => m.rows);
  }

  function addManualRow() {
    setDataTrees([
      ...dataTrees,
      {
        id: newRowId(),
        ItemPath: "",
        Scope: "SingleItem",
        MergeStrategy: "OverrideExistingItem",
      },
    ]);
  }

  function updateRow(id: string, patch: Partial<DataTreeRow>) {
    setDataTrees(dataTrees.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setDataTrees(dataTrees.filter((r) => r.id !== id));
  }

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      try {
        const text = await file.text();
        addRows(parseModuleText(text));
      } catch {
        /* ignore invalid file */
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const warnings = dataTrees.filter((r) => r.warning);

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Transfer ID"
        description="A unique ID for this transfer. Reuse an old one and you'll overwrite that transfer on the source."
      >
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Field label="Transfer ID">
              <TextInput
                value={transferId}
                onChange={(e) => update({ transferId: e.target.value })}
              />
            </Field>
          </div>
          <Button variant="secondary" onClick={regenerateTransferId}>
            Generate new
          </Button>
        </div>
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          ⚠ Reusing an existing, undeleted transfer ID will overwrite that operation.
        </p>
      </Card>

      <Card
        title="Import from serialization modules"
        description="Grab item trees from an existing serialization module, or upload your own module.json. We'll parse it and add the trees to the list below."
      >
        {isLoading && <SkeletonRows rows={4} />}
        {error && <Alert tone="warning">Could not load sample modules: {String(error)}</Alert>}

        {data && allTags.length > 0 && (
          <div className="mb-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Add all item trees for a tag (across every module — duplicate paths are skipped):
            </p>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const count = rowsForTag(tag).length;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addRows(rowsForTag(tag))}
                    title={`Add all ${count} item tree(s) tagged "${tag}" from every module (duplicates skipped)`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  >
                    <span aria-hidden>+</span>
                    {tag}
                    <span className="rounded-full bg-blue-100 px-1.5 text-[10px] tabular-nums dark:bg-blue-900/60">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-3">
            {data.modules.map((m) => (
              <div
                key={m.fileName}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm text-zinc-800 dark:text-zinc-200">
                      {m.fileName}
                    </span>
                    {m.tags.map((t) => (
                      <Badge key={t} tone="info">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {m.rows.length} item tree{m.rows.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => addRows(m.rows)}>
                  Add {m.rows.length}
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            multiple
            onChange={onUpload}
            className="hidden"
            id="module-upload"
          />
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Upload module.json…
          </Button>
        </div>
      </Card>

      <Card
        title="Data trees to transfer"
        description="Each row is one tree in the transfer. Adjust scope and merge strategy as needed."
        actions={
          <div className="flex items-center gap-2">
            {dataTrees.length > 0 && (
              <Button variant="ghost" onClick={() => setDataTrees([])}>
                Remove all
              </Button>
            )}
            <Button variant="secondary" onClick={addManualRow}>
              Add row
            </Button>
          </div>
        }
      >
        {warnings.length > 0 && (
          <div className="mb-4">
            <Alert tone="warning">
              {warnings.length} row(s) used a scope the API doesn&apos;t support, so we remapped
              them. Hover the badge for details.
            </Alert>
          </div>
        )}

        {dataTrees.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">
            No item trees yet. Import a module above or add a row manually.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-3 font-medium">Item path</th>
                  <th className="py-2 pr-3 font-medium">Scope</th>
                  <th className="py-2 pr-3 font-medium">Merge strategy</th>
                  <th className="py-2 pr-3 font-medium"></th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {dataTrees.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-3 align-top">
                      <TextInput
                        value={r.ItemPath}
                        onChange={(e) => updateRow(r.id, { ItemPath: e.target.value })}
                        placeholder="/sitecore/content/..."
                        className="min-w-[280px] font-mono text-xs"
                      />
                      {r.sourceName && (
                        <span className="mt-1 block text-[11px] text-zinc-400">{r.sourceName}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <Select
                        value={r.Scope}
                        onChange={(e) =>
                          updateRow(r.id, { Scope: e.target.value as TransferScope })
                        }
                      >
                        {TRANSFER_SCOPES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <Select
                        value={r.MergeStrategy}
                        onChange={(e) =>
                          updateRow(r.id, { MergeStrategy: e.target.value as MergeStrategy })
                        }
                      >
                        {MERGE_STRATEGIES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-3 align-top">
                      {r.warning && (
                        <span title={r.warning}>
                          <Badge tone="warning">scope remapped</Badge>
                        </span>
                      )}
                    </td>
                    <td className="py-2 align-top text-right">
                      <Button variant="ghost" onClick={() => removeRow(r.id)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
