import "server-only";
import { sitecoreFetch, sitecoreJson } from "./client";
import type {
  BlobSourcesResult,
  FileSourcesResult,
  HistoryResult,
  TransferDetailsResult,
  TransfersPagedResponse,
} from "./types";

const BASE = "/sitecore/shell/api/v3/ItemsTransfer";

/**
 * Starts consuming a source (.raif) into the target database.
 *
 * The Content Transfer API's "complete chunk set" step writes the .raif to Azure
 * Blob storage, so that workflow consumes via `blobName`. `fileName` is for .raif
 * files physically present on the CM file system (e.g. small manual uploads).
 * Exactly one of blobName / fileName must be provided.
 */
export async function consumeSource(
  host: string,
  databaseName: string,
  source: { blobName?: string; fileName?: string },
): Promise<{ status: number; location: string | null }> {
  const { blobName, fileName } = source;
  if (!blobName && !fileName) throw new Error("Provide either blobName or fileName.");

  const res = await sitecoreFetch({
    host,
    path: `${BASE}/transfers/databases/${encodeURIComponent(databaseName)}/sources`,
    method: "POST",
    query: blobName ? { blobName } : { fileName },
    rawResponse: true,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Consume '${blobName ?? fileName}' failed (${res.status}): ${detail}`);
  }
  return { status: res.status, location: res.headers.get("location") };
}

export async function listBlobSources(
  host: string,
  page = 1,
  pageSize = 50,
): Promise<BlobSourcesResult> {
  return sitecoreJson<BlobSourcesResult>({
    host,
    path: `${BASE}/sources/blobs`,
    query: { page, pageSize },
  });
}

export async function listTransfers(
  host: string,
  page = 1,
  pageSize = 50,
): Promise<TransfersPagedResponse> {
  return sitecoreJson<TransfersPagedResponse>({
    host,
    path: `${BASE}/transfers`,
    query: { page, pageSize },
  });
}

export async function getTransferDetails(
  host: string,
  transferId: string,
): Promise<TransferDetailsResult> {
  return sitecoreJson<TransferDetailsResult>({
    host,
    path: `${BASE}/transfers/${encodeURIComponent(transferId)}`,
  });
}

export async function listFileSources(
  host: string,
  page = 1,
  pageSize = 50,
): Promise<FileSourcesResult> {
  return sitecoreJson<FileSourcesResult>({
    host,
    path: `${BASE}/sources/files`,
    query: { page, pageSize },
  });
}

export async function getHistory(host: string, page = 1, pageSize = 50): Promise<HistoryResult> {
  return sitecoreJson<HistoryResult>({
    host,
    path: `${BASE}/history`,
    query: { page, pageSize },
  });
}

/** Retries a failed file-system source transfer. */
export async function retryFailedSource(
  host: string,
  databaseName: string,
  sourceName: string,
): Promise<{ DatabaseName: string; SourceName: string }> {
  return sitecoreJson<{ DatabaseName: string; SourceName: string }>({
    host,
    path: `${BASE}/transfers/databases/${encodeURIComponent(databaseName)}/sources/${encodeURIComponent(
      sourceName,
    )}`,
    method: "PUT",
  });
}
