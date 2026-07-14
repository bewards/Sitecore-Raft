import "server-only";
import { sitecoreFetch, sitecoreJson } from "./client";
import type {
  CompleteChunkSetResult,
  ContentTransferStatus,
  CopyChunkResult,
  CreateContentTransferBody,
  DataTree,
} from "./types";

const BASE = "/sitecore/api/content/transfer/v1";

export async function createContentTransfer(
  host: string,
  transferId: string,
  dataTrees: DataTree[],
): Promise<{ status: number }> {
  const body: CreateContentTransferBody = {
    TransferId: transferId,
    Configuration: { DataTrees: dataTrees },
  };
  const res = await sitecoreFetch({
    host,
    path: `${BASE}/transfers`,
    method: "POST",
    jsonBody: body,
  });
  return { status: res.status };
}

export async function getContentTransferStatus(
  host: string,
  transferId: string,
): Promise<ContentTransferStatus> {
  return sitecoreJson<ContentTransferStatus>({
    host,
    path: `${BASE}/transfers/${encodeURIComponent(transferId)}/status`,
  });
}

/** Parses ItemsProcessed / ItemsSkipped / IsMedia from Content-Disposition params,
 *  falling back to same-named individual headers if present. */
function parseChunkHeaders(res: Response): { itemsProcessed: number; itemsSkipped: number; isMedia: boolean } {
  const cd = res.headers.get("content-disposition") ?? "";
  const params = new Map<string, string>();
  for (const part of cd.split(";")) {
    const idx = part.indexOf("=");
    if (idx > -1) {
      const key = part.slice(0, idx).trim().toLowerCase();
      const val = part.slice(idx + 1).trim().replace(/^"|"$/g, "");
      params.set(key, val);
    }
  }

  const read = (name: string): string | undefined =>
    params.get(name.toLowerCase()) ?? res.headers.get(name) ?? undefined;

  const itemsProcessed = Number(read("ItemsProcessed") ?? 0) || 0;
  const itemsSkipped = Number(read("ItemsSkipped") ?? 0) || 0;
  const isMediaRaw = (read("IsMedia") ?? "false").toLowerCase();
  const isMedia = isMediaRaw === "true";

  return { itemsProcessed, itemsSkipped, isMedia };
}

/**
 * Copies a single chunk from source to destination entirely server-side:
 * GET the binary from source (with its metadata headers), then PUT it unaltered
 * to the destination with the matching ?isMedia flag.
 */
export async function copyChunk(params: {
  sourceHost: string;
  destHost: string;
  transferId: string;
  chunksetId: string;
  chunkId: number;
}): Promise<CopyChunkResult> {
  const { sourceHost, destHost, transferId, chunksetId, chunkId } = params;
  const chunkPath = `${BASE}/transfers/${encodeURIComponent(transferId)}/chunksets/${encodeURIComponent(
    chunksetId,
  )}/chunks/${chunkId}`;

  // 1. GET chunk from source (raw binary).
  const getRes = await sitecoreFetch({
    host: sourceHost,
    path: chunkPath,
    method: "GET",
    rawResponse: true,
    headers: { Accept: "application/octet-stream" },
  });
  if (!getRes.ok) {
    const detail = await getRes.text().catch(() => "");
    throw new Error(`GET chunk ${chunkId} from source failed (${getRes.status}): ${detail}`);
  }

  const { itemsProcessed, itemsSkipped, isMedia } = parseChunkHeaders(getRes);
  const bytes = await getRes.arrayBuffer();

  // 2. PUT chunk to destination, unaltered, with matching isMedia flag.
  const putRes = await sitecoreFetch({
    host: destHost,
    path: chunkPath,
    method: "PUT",
    query: { isMedia },
    binaryBody: bytes,
    rawResponse: true,
  });
  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => "");
    throw new Error(`PUT chunk ${chunkId} to destination failed (${putRes.status}): ${detail}`);
  }

  return { chunkId, isMedia, itemsProcessed, itemsSkipped, bytes: bytes.byteLength };
}

export async function completeChunkSet(
  host: string,
  transferId: string,
  chunksetId: string,
): Promise<CompleteChunkSetResult> {
  return sitecoreJson<CompleteChunkSetResult>({
    host,
    path: `${BASE}/transfers/${encodeURIComponent(transferId)}/chunksets/${encodeURIComponent(
      chunksetId,
    )}/complete`,
    method: "POST",
  });
}

export async function deleteContentTransfer(
  host: string,
  transferId: string,
): Promise<{ status: number }> {
  const res = await sitecoreFetch({
    host,
    path: `${BASE}/transfers/${encodeURIComponent(transferId)}`,
    method: "DELETE",
    rawResponse: true,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`DELETE transfer failed (${res.status}): ${detail}`);
  }
  return { status: res.status };
}
