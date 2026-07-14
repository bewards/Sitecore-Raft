"use client";

import { useState } from "react";
import { useWizard } from "@/lib/wizard-state";
import { postJson } from "@/lib/api-client";
import { Alert, Badge, Button, Card, JsonPreview } from "@/components/ui";
import type { CreateContentTransferBody, DataTree } from "@/lib/sitecore/types";

export function Step2Create() {
  const { state, update } = useWizard();
  const { config, transferId, dataTrees, created } = state;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const body: CreateContentTransferBody = {
    TransferId: transferId,
    Configuration: {
      DataTrees: dataTrees.map(
        (r): DataTree => ({
          ItemPath: r.ItemPath,
          Scope: r.Scope,
          MergeStrategy: r.MergeStrategy,
        }),
      ),
    },
  };

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/sitecore/content-transfer/create", {
        host: config.sourceHost,
        transferId,
        dataTrees: body.Configuration.DataTrees,
      });
      update({ created: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Create transfer operation"
      description="This POSTs to the Content Transfer API on the source host. The request body is shown below exactly as it will be sent."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500">Reading from (source):</span>
        <Badge tone="info">{config.sourceHost || "— not set —"}</Badge>
        <span className="text-zinc-500">·</span>
        <span className="text-zinc-500">{dataTrees.length} data tree(s)</span>
      </div>

      <JsonPreview value={body} />

      {error && (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      {created && (
        <div className="mt-4">
          <Alert tone="success">
            Transfer created. Continue to <strong>Monitor</strong> to watch it complete and inspect
            the chunk sets.
          </Alert>
        </div>
      )}

      <div className="mt-6">
        <Button onClick={create} loading={busy} disabled={!config.sourceHost || dataTrees.length === 0}>
          {created ? "Re-create transfer" : "Create transfer"}
        </Button>
      </div>
    </Card>
  );
}
