# Sitecore Raft

> **Raft your content between Sitecore environments.**

A Next.js app that migrates content between two SitecoreAI (XM Cloud) environments —
**source (PROD) → destination (UAT)** — using the newer **Content Transfer API** and
**Item Transfer API**, as a modern replacement for the `dotnet sitecore ser pull/push`
serialization-CLI workflow. (The name nods to the `.raif` packages the workflow produces —
rafts that carry your content across.)

The UI is a **guided wizard**: every API parameter is set via forms, and each stage of the
transfer is a step you can watch and drive.

---

## Features

- **Guided 7-step wizard** covering the full workflow — configure → select content → create →
  monitor → stream → consume → summary — with progress persisted in the browser so a reload
  resumes where you left off.
- **Server-side secret handling** — all Sitecore calls go through Next.js route handlers;
  credentials/JWT never reach the browser (see [Project layout](#project-layout)).
- **Content selection** from Sitecore serialization `module.json` files:
  - **Import per module** (bundled samples auto-loaded, or upload your own).
  - **Add by tag** — one click adds every item tree carrying a tag (`step1`…`step4`, `site`, …)
    across *all* modules, mirroring the old `ser pull -i tags:[…]` flow.
  - **Manual add/edit** of item paths, scope, and merge strategy.
  - **Automatic de-duplication** by item path (across existing rows and within a batch).
  - **Scope remapping** with warnings (`ItemAndChildren` → `ItemAndDescendants`; see Comparison).
- **Friendly labels** for runs/`.raif` files, shown primary over the system name (see
  [Friendly labels](#friendly-labels)).
- **Live monitoring & timing** — chunk copy times in the Stream step, live item-count progress and
  consume duration in the Consume step (see [Timing & observability](#timing--observability)).
- **Read views** — destination transfers, blob sources, and consume history, all auto-refreshing.

---

## Setup

1. **Install dependencies** (project uses pnpm):
   ```bash
   pnpm install
   ```
   If pnpm blocks native build scripts, they're pre-approved in `pnpm-workspace.yaml`
   (`sharp`, `unrs-resolver`); run `pnpm install` once more to build them.

2. **Configure secrets** in `.env.local` (gitignored):
   ```
   SITECORE_CLIENT_ID=...            # org-level automation client
   SITECORE_CLIENT_SECRET=...
   SITECORE_AUTH_URL=https://auth.sitecorecloud.io/oauth/token
   SITECORE_AUTH_AUDIENCE=https://api.sitecorecloud.io
   SITECORE_SOURCE_HOST=             # optional default; can also be set in the UI
   SITECORE_DEST_HOST=
   ```
   Secrets are read **server-side only** (Next.js route handlers) and never sent to the browser.
   A single org-level automation client authenticates against both hosts.

3. **Run**:
   ```bash
   pnpm dev
   ```
   Open http://localhost:3000. On Step 0, click **Test authentication** to confirm your
   credentials before doing anything else.

---

## The migration workflow

The migration spans **two environments** and **two APIs**. Content is *read from* the source
and *lands at* the destination — you never "push" content the way the old CLI did.

```
   SOURCE (PROD)                         DESTINATION (UAT)
   ─────────────                         ─────────────────
   Content Transfer API                  Content Transfer API        Item Transfer API
   ────────────────────                  ────────────────────        ─────────────────
1. create transfer  ──┐
2. monitor status     │  (chunk sets built on source)
3. GET each chunk  ───┼──────────────►  PUT each chunk
                      │                  complete chunk set ──► .raif in BLOB STORAGE
                      │                                              │
                      │                                              ▼
                      │                                         consume (blobName)
                      │                                         ──► items imported
                      │                                             into target DB
4. delete transfer  ──┘  (cleanup on source)
```

### Which host each wizard step talks to

| Step | API | Host | Action |
|------|-----|------|--------|
| 0 · Configure | — | — | set both hosts + database; test auth |
| 1 · Content | — | — | choose item trees — import module.json, **add by tag**, or add manually (deduped) |
| 2 · Create | Content Transfer | **PROD (source)** | nominate content → build chunk sets |
| 3 · Monitor | Content Transfer | **PROD (source)** | poll until `Completed` |
| 4 · Stream | Content Transfer | **PROD → UAT** | copy each chunk; `complete` writes `.raif` on UAT |
| 5 · Consume | Item Transfer | **UAT (dest)** | import `.raif` into the target database |
| 6 · Summary | Item Transfer / Content Transfer | UAT / PROD | history + blob sources; `delete` cleanup on PROD |

---

## File system vs. Blob storage — important

The **Item Transfer API** can consume a `.raif` from **two different source types**, and it
matters which one you use:

| | **Blob storage** (`blobName=`) | **File system** (`fileName=`) |
|---|---|---|
| Where the `.raif` lives | Azure Blob storage attached to the environment | Physically on the CM instance's disk |
| Listed by | `GET /sources/blobs` | `GET /sources/files` |
| How it gets there | **Automatically**, by the Content Transfer API's *complete chunk set* step | Manually — small uploads (< 50 MB) or files placed on disk |
| Usable in XM Cloud? | **Yes — this is the normal path** | Rarely; you can't easily drop files on a cloud CM's disk |
| Used by this wizard | **Yes** (Step 5 consumes by `blobName`) | Supported in code, not wired into the wizard |

**Key point:** in XM Cloud, the Content Transfer API's *complete* step writes each `.raif` to
**blob storage, not the file system.** So the automated PROD → UAT workflow **always** consumes
by `blobName`. After Step 4 you will see the file in `GET /sources/blobs` (state `Uploaded`),
while `GET /sources/files` stays empty. Consuming it drives the blob state
`Uploaded → Initializing → Consumed`.

> It's easy to reach for a file-system source here, but on XM Cloud that won't work: a completed
> transfer lands in blob storage, so a `fileName=` consume never finds it. The code keeps a
> file-system path (`consumeSource({ fileName })`, `/sources/files`) for `.raif` files that are
> genuinely on the CM disk, but the wizard consumes by `blobName`.

---

## Timing & observability

The wizard surfaces timing at two distinct stages — they measure different things:

- **Stream step (chunk copy time).** Each `copy-chunk` round trip (GET from PROD **+** PUT to
  UAT, measured client-side) is timed. You get a per-chunk breakdown (`#0·210 ms`, `#1·1.3 s`, …
  with item-count/byte tooltips), a **per-chunk-set** total and average, and an **overall**
  total copy time. This reflects transport throughput.
- **Consume step (processing time).** The Destination transfers table shows a **Processing time**
  column = the destination's actual ingest duration, computed from the `/history` event log as
  the sum of each `InProgress → Finished` interval. Pairing the events this way **excludes any
  queued time**, so it's true start-to-finish processing, not wall-clock-since-submit. It reads
  `—` until the transfer reaches `Finished`, and uses server-reported timestamps (unaffected by
  your browser/network). The history view auto-refreshes every 5 s so it fills in live.

In short: the Stream timing is **PROD→UAT transport**, the Consume timing is **UAT ingest**.

---

## Friendly labels

`.raif` file names are **generated by Sitecore** (`contentTransfer-<transferId>-<chunksetId>.raif`),
one per chunk set, and the API gives no way to influence them. To make runs recognizable, the
wizard lets you attach an optional **friendly label**:

- **Stream step** — a run-level "Friendly label" field (applies to every `.raif` in the run) plus a
  per-chunk-set override input on each card. Resolution: chunk-set label → run label → none.
- **Consume & Summary steps** — where a label exists it's shown as the **primary** value with the
  system `.raif` name beneath it (destination transfers table, consume list, blob sources, and
  history). Rows without a local label just show the system name.

The label is joined onto the server-provided rows by `.raif` file name (`labelForRaif` in
`src/lib/wizard-state.tsx`).

Caveats:
- **Labels are browser-local** — stored in `localStorage` with the rest of the wizard state, never
  sent to Sitecore. They won't appear on another machine or for runs performed elsewhere. Making
  them durable/shared ties into the "persist run state server-side" item under Improvements.
- **Don't edit a chunk-set label while that run is actively streaming** — the streaming loop keeps
  its own working copy and will overwrite the edit when it completes. Set labels before streaming
  (the run-level field) or after it finishes.

---

## Notes & gotchas

- **`Content-Length: 0` on body-less POSTs.** The Item Transfer consume/retry endpoints are
  body-less POSTs. Without an explicit `Content-Length`, the Sitecore edge (Cloudflare/IIS)
  rejects them with `HTTP 411 Length Required`. `sitecoreFetch` sends an empty body so
  `Content-Length: 0` is emitted automatically.
- **Scope: `ItemAndChildren` is not supported.** The Content Transfer `TreeScope` enum only
  accepts `SingleItem` and `ItemAndDescendants` — send anything else and you get a 400. When
  importing serialization modules, `ItemAndChildren` gets remapped to `ItemAndDescendants` (which
  is *broader* — all descendants, not just direct children) and flagged in the UI.
- **Transfer list lag.** After consuming, `GET /transfers` can take ~10–15 s to register and may
  briefly report `TransferState: Unknown` even once the blob shows `Consumed`. The **BlobState**
  badge in Step 5 is the more reliable progress signal.
- **JWT lifetime.** Tokens are cached server-side for ~24 h and refreshed on expiry / 401.

---

## API Findings

A few things that only really show up once you run this against real environments — and aren't in
the docs:

### Consume/ingest throughput ≈ 4 items/sec

The Item Transfer *consume* step writes items into the destination DB at a fairly constant
**~4 items/second (~240/min)**, roughly independent of run size:

- 1,718 items → ~7 min
- 74,060 items → measured mid-run at ~4 items/sec (multi-hour total)

So consume time scales ~linearly with item count — estimate it as `TotalItemsCount / 4` seconds.
Media/blob-heavy items sit at the slower end.

### Consume runs entirely server-side on the destination

Once the `.raif` reaches blob storage (BlobState `Consumed`), ingestion is performed by Sitecore
on the destination. The app and your local machine are **not** involved — closing the browser does
not stop or slow it; the app only polls for status. (Contrast the Stream step, where chunk bytes
relay through your machine — see [Improvements](#improvements--future-work).)

### Progress is only visible via the details endpoint

`GET /transfers` and `GET /history` report **state transitions only** (`InProgress`, `Finished`,
`Queued`) — no incremental progress, so a multi-hour consume looks frozen at `InProgress`.
`GET /transfers/{id}` exposes `TransferredItemsCount / TotalItemsCount`, which advances live and is
the reliable progress signal. The Consume step polls this to show an item-count progress bar.

### BlobState lifecycle

`Uploaded → Initializing → Consumed → Transferred`. `Consumed` means the `.raif` was read and
ingestion is underway; `Transferred` means all items were written into the DB (done). A `Finished`
event in `/history` *usually* accompanies completion — but not always (see below).

### `/history` can omit the `Finished` event on large transfers

One large transfer (74,060 items) finished cleanly — `GET /sources/blobs/{name}` → `Transferred`,
`GET /transfers/{id}` → `Finished` with `74060/74060` — yet its `/history` entry still listed only
`[{ InProgress }]`, never logging a `Finished` event. Smaller transfers in the same environment did
record `InProgress → Finished`.

Consequences:
- **`/history` is not a reliable completion or timing signal.** Because there's no `Finished`
  timestamp anywhere in the API for such a transfer, its total processing time **cannot be
  computed** (start is known, finish is not).
- **Use `GET /transfers/{id}` (details) as the source of truth** for state and item counts, not the
  history event log. This app drives the consume progress/completion UI off the details endpoint
  and treats history events as a best-effort timeline only.

---

## Comparison: Content Transfer API vs. legacy Serialization (SCS)

This process replaces the `dotnet sitecore ser pull` / `ser push` workflow (Sitecore Content
Serialization, "SCS"). They solve overlapping but different problems: SCS is **content-as-code**
(serialize to disk, commit, deploy), while the Content Transfer + Item Transfer APIs are
**purpose-built environment-to-environment migration** (stream a package straight from source to
destination). The tables below are what I ran into building this POC; the SCS side comes from its
serialization model (a few of these are right there in this repo's `sitecore.json`).

| Capability | Legacy SCS (`ser pull`/`push`) | Content Transfer + Item Transfer |
|---|---|---|
| Primary purpose | Content-as-code / dev deployment | Environment-to-environment content migration |
| Artifact | One human-readable `.yml` per item, on disk | Opaque binary `.raif` package in blob storage |
| Version-control friendly | **Yes** — git, diffs, PR review, CI/CD | No — binary, not diffable |
| Transport | Local files + CLI push from a workstation | Chunked streaming (content encrypted, media compressed), server-side |
| Local disk footprint | Full copy on the workstation (media as base64 → large) | None for large runs — package built server-side into blob |
| Scope options | `SingleItem`, `ItemAndChildren`, `ItemAndDescendants`, `DescendantsOnly`, `Ignored` | `SingleItem`, `ItemAndDescendants` **only** |
| Sub-path rules (`includes[].rules`) | **Yes** — per-path include/exclude, per-rule scope/ops | No — a data tree is just `{ ItemPath, Scope, MergeStrategy }` |
| Field-level exclusion (`excludedFields`) | **Yes** | No — full items move; the create body has no field params |
| Conflict handling | `allowedPushOperations`: `CreateOnly` / `UpdateOnly` / `CreateAndUpdate` / `CreateUpdateAndDelete` | `MergeStrategy`: `OverrideExistingItem` / `KeepExistingItem` / `LatestWin` / `OverrideExistingTree` |
| Delete / orphan removal | **Yes** (`removeOrphans*`, `CreateUpdateAndDelete`) | Not clearly exposed — `OverrideExistingTree` may replace a tree, but no explicit orphan control *(didn't confirm)* |
| Roles & users / security | **Yes** — serializes roles and users | Looks like content/media only *(didn't confirm)* |
| Media handling | Base64 inline in YAML (bloats files, slow git) | Compressed binary chunks in blob — purpose-built for volume |
| Progress / monitoring | CLI console output | API: transfer state, chunk sets, `TransferredItemsCount/TotalItemsCount`, history, retry |
| Dry-run / comparison | Version comparison available | None — merge is applied at consume time |
| Auth | CLI cloud login + `environment connect` | Automation-client JWT (cloud-native, headless) |
| Throughput | Varies | Ingest ~4 items/sec (see [API Findings](#api-findings)); media chunk copy is bandwidth-bound |

### What the Content Transfer process lacks vs. SCS

- **Coarser scope.** Only `SingleItem` and `ItemAndDescendants`. No `ItemAndChildren` (direct
  children only — the API rejects it with a 400), no `DescendantsOnly`, no `Ignored`. To get
  direct-children-only you'd have to list the child paths as separate data trees.
- **No rules engine.** SCS `includes[].rules` let you include a subtree but carve out or re-scope
  specific sub-paths. The transfer API has no equivalent — each data tree is all-or-nothing under
  its single scope.
- **No field-level control.** No `excludedFields`; whole items move.
- **No deterministic, reviewable artifact.** The `.raif` is opaque and blob-hosted — you can't
  diff it, commit it, or review a change set before applying. SCS YAML is the opposite.
- **No dry-run / diff.** You can't preview what a merge will change; strategy is applied at consume.
- **Weaker delete/orphan and security story** *(didn't confirm)* — no obvious equivalent to
  `CreateUpdateAndDelete` / orphan removal, and roles/users don't look like part of the model.

### Benefits over SCS for environment-to-environment migration

- **No workstation bottleneck for packaging.** SCS `pull` writes the entire content set (media as
  base64) to local disk, then `push` streams it back up. The transfer API builds the `.raif`
  **server-side** into blob storage — large/media-heavy migrations don't need gigabytes of local
  files or a fast workstation uplink for the packaging stage.
- **Built for content + media volume.** Content is encrypted and media is compressed in transit,
  and media rides as binary chunks rather than base64-in-YAML (which bloats files and git).
- **Direct source→destination, fully headless.** No intermediate git repo, no CLI login flow on a
  developer machine — automation-client credentials + JWT, scriptable end to end.
- **Programmatic monitoring, retry, and history.** Transfer/chunk-set state, live item counts,
  per-source retry, and a consume history are all API-exposed — far more observable than CLI push.
- **Resilient chunking.** Work is split into chunk sets and chunks; failed sources can be retried
  without redoing everything.

### When to use which

- **Legacy SCS** — templates, renderings, settings, and other *content-as-code* that belongs in
  git and flows through CI/CD; when you need fine-grained rules, field exclusion, security items,
  or a reviewable diff.
- **Content Transfer + Item Transfer** — bulk, one-directional **content/media migration** between
  SitecoreAI environments where the payload is large, no git artifact is wanted, and the whole
  thing should run headless/automated.

> The bits marked *(didn't confirm)* are my best guess — I didn't test them against a live
> environment, so check them yourself before relying on them.

---

## Improvements / future work

- **Media payload size — chunks stream through the local machine.** Each `copy-chunk` relays the
  raw chunk PROD → **this Next server** → UAT. For **content** chunks (encrypted item data) that's
  kilobytes and takes ~300 ms. For **media** chunks (`IsMedia = true`, compressed binary assets —
  images, PDFs, files) a single chunk can be tens/hundreds of MB, so per-chunk time jumps to
  30–50 s+ once the transfer reaches media-library content. In practice I saw content chunks around
  ~300 ms and media chunks 45–53 s each.

  This is a bandwidth/volume bottleneck from the **double hop** through the local relay, not a bug.
  Options to improve:
  - **Server-to-server copy** — have the destination pull each chunk directly from the source (or
    the source push to the destination), eliminating the round trip through this app's machine.
  - **Parallelize chunk copies** — the Stream step currently copies chunks strictly sequentially;
    running several in flight would hide latency (mind Sitecore-side rate limits and local memory,
    since each chunk is buffered fully in memory before the PUT).
  - **Stream instead of buffer** — `copyChunk` reads the whole chunk into an `ArrayBuffer` before
    PUTting; piping the response body straight into the PUT would cut memory and time-to-first-byte
    for large media.
  - **Separate media from content** — transfer content trees first (fast) and schedule the heavy
    media trees separately, so a large media set doesn't block the rest.

- **Run persistence is browser-local.** Wizard state lives in `localStorage` (single run, per
  browser) and can silently hit the ~5 MB quota on very large runs. Persisting run state
  server-side (file/DB) would make runs durable, shareable across browsers, and quota-free.

- **Retry / resume for failed chunks.** A failed chunk aborts the chunk-set loop; per-chunk retry
  and resume-from-last-successful would make large transfers more robust.

- **Blob source cleanup.** After consuming, the `.raif` blobs remain (`DELETE /sources/blobs`);
  a cleanup action in the Summary step would tidy them up.

---

## Project layout

```
src/
  app/api/                     Next.js route handlers (server-side proxy to Sitecore)
    modules/                   parse bundled serialization-samples/*.module.json
    sitecore/auth/test         verify credentials (fetch a JWT)
    sitecore/content-transfer/ create, status, copy-chunk, complete, delete
    sitecore/item-transfer/    consume, transfers, sources-blobs, sources-files, history
  lib/sitecore/                token cache, authed fetch client, API wrappers, types, parser
  components/wizard/           one component per step + stepper
  hooks/useSitecore.ts         SWR polling hooks
```

Requests go: **browser → our `/api/*` route → Sitecore host**. The browser never holds the JWT
or talks to Sitecore directly.
