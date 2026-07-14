/**
 * Shared TypeScript types for the Content Transfer API and Item Transfer API.
 * Mirrors the OpenAPI schemas at api-docs.sitecore.com.
 */

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

/** Content Transfer create-request scope (only these two are supported by the API). */
export type TransferScope = "SingleItem" | "ItemAndDescendants";

/** Merge strategy applied when items already exist in the destination. */
export type MergeStrategy =
  | "OverrideExistingItem"
  | "KeepExistingItem"
  | "LatestWin"
  | "OverrideExistingTree";

export const MERGE_STRATEGIES: MergeStrategy[] = [
  "OverrideExistingItem",
  "KeepExistingItem",
  "LatestWin",
  "OverrideExistingTree",
];

export const TRANSFER_SCOPES: TransferScope[] = ["SingleItem", "ItemAndDescendants"];

/** Item Transfer consume/transfer lifecycle state. */
export type TransferState =
  | "Unknown"
  | "InProgress"
  | "Finished"
  | "Failed"
  | "Queued"
  | "Discarded";

// ---------------------------------------------------------------------------
// Content Transfer API
// ---------------------------------------------------------------------------

export interface DataTree {
  ItemPath: string;
  Scope: TransferScope;
  MergeStrategy: MergeStrategy;
}

export interface CreateContentTransferBody {
  TransferId: string;
  Configuration: {
    DataTrees: DataTree[];
  };
}

export type ContentTransferState = "Running" | "Completed" | "Failed" | "NotFound";

export interface ChunkSetMetadata {
  ChunkSetId: string;
  ChunkCount: number;
  TotalItemCount: number;
}

export interface ContentTransferStatus {
  State: ContentTransferState;
  ChunkSetsMetadata: ChunkSetMetadata[];
}

/** Result of copying a single chunk from source to destination (server-side pairing). */
export interface CopyChunkResult {
  chunkId: number;
  isMedia: boolean;
  itemsProcessed: number;
  itemsSkipped: number;
  bytes: number;
  /** Client-measured wall-clock time for the copy-chunk round trip, in ms. */
  ms?: number;
}

export interface CompleteChunkSetResult {
  ContentTransferFileName: string;
}

// ---------------------------------------------------------------------------
// Item Transfer API
// ---------------------------------------------------------------------------

export interface TransferStatusResult {
  Id: string;
  SourceName: string;
  DatabaseName: string;
  ConsumedDate: string;
  TransferState: TransferState;
  Strategy: MergeStrategy;
  Description: string;
}

export interface TransferDetailsResult extends TransferStatusResult {
  TotalItemsCount: number;
  TransferredItemsCount: number;
  ValidationErrors: string[];
  SourcesCount: number;
}

export interface Paged {
  Page: number;
  PageSize: number;
  TotalCount: number;
}

export interface TransfersPagedResponse extends Paged {
  Transfers: TransferStatusResult[];
}

export type BlobState =
  | "Unknown"
  | "Uploading"
  | "Uploaded"
  | "Initializing"
  | "Error"
  | "Consumed"
  | "Transferred"
  | "TransferredWithErrors"
  | "Queued"
  | "Discarded";

export interface BlobSourceInfo {
  Name: string;
  BlobState: BlobState;
}

export interface BlobSourcesResult extends Paged {
  Sources: BlobSourceInfo[];
}

export interface FileSourceInfo {
  FileName: string;
  DatabaseName: string;
}

export interface FileSourcesResult extends Paged {
  Sources: FileSourceInfo[];
}

export interface HistoryEvent {
  Name: string;
  Date: string;
}

export interface TransfersHistory {
  Name: string;
  SourceName: string;
  ConsumeDate: string;
  Strategy: MergeStrategy;
  Events: HistoryEvent[];
}

export interface HistoryResult extends Paged {
  Sources: TransfersHistory[];
}

// ---------------------------------------------------------------------------
// Wizard-local types
// ---------------------------------------------------------------------------

/** A DataTree row as edited in the UI, carrying provenance for display. */
export interface DataTreeRow extends DataTree {
  id: string;
  /** Original module.json include name, if imported. */
  sourceName?: string;
  /** Original module.json scope before mapping (e.g. ItemAndChildren). */
  originalScope?: string;
  /** Step / group tags from the module it came from. */
  tags?: string[];
  /** Warning when the original scope was remapped (e.g. ItemAndChildren). */
  warning?: string;
}
