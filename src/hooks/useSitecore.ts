"use client";

import useSWR from "swr";
import { getJson } from "@/lib/api-client";
import type {
  BlobSourcesResult,
  ContentTransferStatus,
  FileSourcesResult,
  HistoryResult,
  TransferDetailsResult,
  TransfersPagedResponse,
} from "@/lib/sitecore/types";

/** Polls content-transfer status; auto-refreshes while the operation is Running. */
export function useContentTransferStatus(host: string, transferId: string, enabled: boolean) {
  const key =
    enabled && host && transferId
      ? `/api/sitecore/content-transfer/status?host=${encodeURIComponent(host)}&transferId=${encodeURIComponent(transferId)}`
      : null;

  return useSWR<ContentTransferStatus>(key, getJson, {
    refreshInterval: (latest) => (latest?.State === "Running" ? 2500 : 0),
    revalidateOnFocus: false,
  });
}

/**
 * Polls a single transfer's details (authoritative state + item counts). Keeps
 * polling while the transfer is active and stops once it reaches a terminal state
 * (Finished/Failed) — so it also yields the final counts for completed transfers.
 */
export function useTransferDetails(host: string, id: string, enabled: boolean) {
  const key =
    enabled && host && id
      ? `/api/sitecore/item-transfer/transfers/${encodeURIComponent(id)}?host=${encodeURIComponent(host)}`
      : null;
  return useSWR<TransferDetailsResult>(key, getJson, {
    refreshInterval: (latest) =>
      latest && (latest.TransferState === "Finished" || latest.TransferState === "Failed")
        ? 0
        : 4000,
  });
}

export function useItemTransfers(host: string, enabled: boolean) {
  const key =
    enabled && host
      ? `/api/sitecore/item-transfer/transfers?host=${encodeURIComponent(host)}&page=1&pageSize=50`
      : null;
  return useSWR<TransfersPagedResponse>(key, getJson, { refreshInterval: 5000 });
}

export function useBlobSources(host: string, enabled: boolean) {
  const key =
    enabled && host
      ? `/api/sitecore/item-transfer/sources-blobs?host=${encodeURIComponent(host)}&page=1&pageSize=50`
      : null;
  return useSWR<BlobSourcesResult>(key, getJson, { refreshInterval: 5000 });
}

export function useFileSources(host: string, enabled: boolean) {
  const key =
    enabled && host
      ? `/api/sitecore/item-transfer/sources-files?host=${encodeURIComponent(host)}&page=1&pageSize=50`
      : null;
  return useSWR<FileSourcesResult>(key, getJson, { revalidateOnFocus: false });
}

export function useHistory(host: string, enabled: boolean) {
  const key =
    enabled && host
      ? `/api/sitecore/item-transfer/history?host=${encodeURIComponent(host)}&page=1&pageSize=50`
      : null;
  return useSWR<HistoryResult>(key, getJson, { refreshInterval: 5000 });
}
