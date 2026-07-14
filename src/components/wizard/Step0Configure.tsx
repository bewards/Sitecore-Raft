"use client";

import { useEffect, useState } from "react";
import { useWizard } from "@/lib/wizard-state";
import { postJson, getJson } from "@/lib/api-client";
import { Alert, Badge, Button, Card, Field, TextInput } from "@/components/ui";

interface AuthResult {
  ok: boolean;
  expiresAt?: string;
  error?: string;
}

export function Step0Configure() {
  const { state, updateConfig } = useWizard();
  const { config } = state;
  const [auth, setAuth] = useState<AuthResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Prefill host defaults from server env (only when empty).
  useEffect(() => {
    if (config.sourceHost || config.destHost) return;
    getJson<{ sourceHost: string; destHost: string }>("/api/sitecore/defaults")
      .then((d) =>
        updateConfig({
          sourceHost: d.sourceHost || "",
          destHost: d.destHost || "",
        }),
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function testAuth() {
    setTesting(true);
    setAuth(null);
    try {
      const res = await postJson<AuthResult>("/api/sitecore/auth/test", {});
      setAuth(res);
    } catch (err) {
      setAuth({ ok: false, error: err instanceof Error ? err.message : "Failed" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card
      title="Configure environments"
      description="The source (PROD) is where content is read from; the destination (UAT) is where chunks are written and .raif files are produced and consumed. The same org-level automation client authenticates against both."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Source host (PROD)" hint="e.g. cm.prod-tenant.sitecorecloud.io — no scheme">
          <TextInput
            value={config.sourceHost}
            onChange={(e) => updateConfig({ sourceHost: e.target.value })}
            placeholder="cm.prod-tenant.sitecorecloud.io"
          />
        </Field>
        <Field label="Destination host (UAT)" hint="e.g. cm.uat-tenant.sitecorecloud.io — no scheme">
          <TextInput
            value={config.destHost}
            onChange={(e) => updateConfig({ destHost: e.target.value })}
            placeholder="cm.uat-tenant.sitecorecloud.io"
          />
        </Field>
        <Field label="Target database" hint="Destination database that will consume the .raif files">
          <TextInput
            value={config.database}
            onChange={(e) => updateConfig({ database: e.target.value })}
            placeholder="master"
          />
        </Field>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button variant="secondary" onClick={testAuth} loading={testing}>
          Test authentication
        </Button>
        {auth?.ok && (
          <Badge tone="success">Token OK — expires {formatDate(auth.expiresAt)}</Badge>
        )}
      </div>

      {auth && !auth.ok && (
        <div className="mt-4">
          <Alert tone="danger">Authentication failed: {auth.error}</Alert>
        </div>
      )}
      {auth?.ok && (
        <div className="mt-4">
          <Alert tone="success">
            Client credentials are valid. This token is cached server-side and works for both hosts.
          </Alert>
        </div>
      )}
    </Card>
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
