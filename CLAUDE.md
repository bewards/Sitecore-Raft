# Content Transfer API and Item Transfer API's
The new Content Transfer API and Item Transfer API provide a complete workflow for transferring content between Sitecore environments. Together, these APIs let you create and upload transfer packages, consume transferred content into a destination environment, monitor transfer progress, inspect transferred items, retry failed transfers, and review transfer history.   

What's new  
- Content Transfer API - Create and manage content transfer operations and transfer packages. 
- Item Transfer API - Consume transfer packages, inspect transferred items, and manage transfer sources. 

The Content Transfer API and Item Transfer API work together as a single migration workflow, simplifying the automation of content migrations between Sitecore environments.

## Practical notes (verified against live XM Cloud)

These behaviours were confirmed empirically against a real PROD→UAT pair and are easy to get
wrong from the docs alone:

- **Consume from BLOB, not the file system.** The Content Transfer API's *complete chunk set*
  step writes each `.raif` to **Azure Blob storage**, not the destination file system. So the
  automated PROD→UAT workflow must consume with `?blobName=...`. After a transfer completes, the
  file appears in `GET /sources/blobs` (state `Uploaded` → `Initializing` → `Consumed`), while
  `GET /sources/files` stays empty.
  - **File system** (`?fileName=...`, `GET /sources/files`) is only for `.raif` files physically
    on the CM disk — small manual uploads (< 50 MB) or files you place there. In XM Cloud you
    generally can't drop files on disk, so this path is rarely usable for cloud-to-cloud
    migrations.
- **Body-less POSTs need `Content-Length: 0`.** The Item Transfer consume/retry endpoints take
  no request body. Without an explicit `Content-Length`, the Sitecore edge (Cloudflare/IIS)
  rejects them with `HTTP 411 Length Required`. Send an empty body so the header is emitted.
- **`TreeScope` enum = `SingleItem` | `ItemAndDescendants` only.** `ItemAndChildren` (used by
  some serialization modules) is rejected with HTTP 400; remap it to `ItemAndDescendants` (which
  is broader — all descendants, not just direct children).
- **Transfer-list lag.** After consuming, `GET /transfers` can take ~10–15 s to register and may
  briefly report `TransferState: Unknown` even once the blob shows `Consumed`. The blob state is
  the more reliable near-term progress signal.


# Item Transfer API

The Item Transfer API allows administrators to incorporate special files (*sources*) containing migrated content and media data into the database of the destination environment. Sources can come from the file system or Azure Blob Storage.

The Item Transfer API consumes `.raif` files created using the [Content Transfer API](https://api-docs.sitecore.com/sai/content-transfer). Each file represents a single data tree from the source environment, and each tree is either a single item or an item plus all of its descendants.

You can also [upload](#operation/startItemsTransfer) small `.raif` files (less than 50 MB) directly to blob storage, but for large content migrations between environments, use the **Content Transfer API**, which uses chunked streaming to produce `.raif` files in the destination environment automatically.

You can also use this API to explore and validate sources, fetch details about a specific source, examine a history of consumed sources, retry failed sources, and discard sources you no longer need.

# Base URL
In the base URL, replace `{host}` with your environment host name. Find the value in SitecoreAI Deploy > **Projects** > your project > **Authoring environments** > your environment > **Details** > **Environment host name**. 


# Authorization
To authorize your requests, use environment automation client credentials and generate a JSON Web Token (JWT).

Note: To create client credentials, you must be an [Organization Admin or Organization Owner](https://doc.sitecore.com/portal/en/developers/sitecore-cloud-portal/roles.html).

## Create an automation client
1. In the Sitecore Cloud Portal, open SitecoreAI Deploy.
2. Click **Credentials** > **Environment** > **Create credentials** > **Automation**.
3. Fill out the automation client details, then click **Create**.
4. Copy the client ID and the client secret because you won't be able to view them again in SitecoreAI Deploy. You'll use them to request a JWT.

## Request a JWT

Run the following cURL command to request a JWT. Replace the placeholder values with your client ID and client secret.
```curl
  curl -X POST 'https://auth.sitecorecloud.io/oauth/token' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'client_id={YOUR_CLIENT_ID}' \
  --data-urlencode 'client_secret={YOUR_CLIENT_SECRET}' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode 'audience=https://api.sitecorecloud.io'
```

The JWT expires in 24 hours. If your requests unexpectedly return a response with status `401 Unauthorized`, request a new JWT by repeating this `POST` request.

We recommend that you cache the JWT for 24 hours to avoid repeating this `POST` request while the JWT is still valid.

## Include the JWT in the request header

You can now start making REST API requests. You must include the JWT in the request header of every request. For example:
```curl
  curl -X GET '{YOUR_BASE_URL}/...' \
  -H 'Authorization: Bearer {YOUR_JWT}' \
  -H 'Accept: application/json'
```


Version: 3.0
Metadata:
  - product: SitecoreAI

## Servers

```
https://{host}/sitecore/shell/api/v3/ItemsTransfer
```

Variables:
- `host`: The environment host name
Default: "cm.your-tenant.sitecorecloud.io"

## Security

### bearerAuth

Type: http
Scheme: bearer
Bearer Format: JWT

## Download OpenAPI description

[Item Transfer API](https://api-docs.sitecore.com/_bundle/sai/item-transfer/index.yaml)

## Transfers

Operations related to managing and monitoring item transfers.

### Returns the status of consumed and transferred sources

 - [GET /transfers](https://api-docs.sitecore.com/sai/item-transfer/transfers/gettransfers.md): Returns a paged list of currently available active and completed transfers across all Sitecore databases.
Each entry includes original file name, transfer date, and transfer state.

Example:
GET /sitecore/shell/api/v3/ItemsTransfer/transfers?page=1&pageSize=50

### Retrieves the details of a loaded to memory transferred source by transferId

 - [GET /transfers/{transferId}](https://api-docs.sitecore.com/sai/item-transfer/transfers/gettransferbyid.md): Retrieves the detailed metrics about items count, state, errors, and validation warnings for an actively transferring or completed source.

Example:
GET /sitecore/shell/api/v3/ItemsTransfer/transfers/consumed.20260622%20123617%203195348.14f58964-9a2f-42fb-8b6d-62440df23454

### Starts consuming a file or blob source into a database

 - [POST /transfers/databases/{databaseName}/sources](https://api-docs.sitecore.com/sai/item-transfer/transfers/startitemstransfer.md): Initiates the content transfer from a local Sitecore file system source or Azure Blob storage into the target database.

Examples:
POST /sitecore/shell/api/v3/ItemsTransfer/transfers/databases/master/sources?fileName=testFile.raif
POST /sitecore/shell/api/v3/ItemsTransfer/transfers/databases/master/sources?blobName=content_2025-08-28.raif

### Retries the transfer of a failed source for a specific database by re-queuing it for processing

 - [PUT /transfers/databases/{databaseName}/sources](https://api-docs.sitecore.com/sai/item-transfer/transfers/retryfaileditemstransfer.md): Retries a failed attempt to transfer a source file into a database. Only sources with a transfer state of "Failed" can be retried.

Example:
PUT /sitecore/shell/api/v3/ItemsTransfer/transfers/databases/master/sources/content_2025-08-28.raif

## Items

Operations for viewing details of specific transferred items.

### Returns a paginated list of transferred items for a specific database and source

 - [GET /transfers/databases/{databaseName}/sources/{sourceName}/items](https://api-docs.sitecore.com/sai/item-transfer/items/gettransferreditems.md): Provide the required databaseName and sourceName of an ongoing or completed transfer.

Example:
GET /sitecore/shell/api/v3/ItemsTransfer/transfers/databases/master/sources/consumed.20260622%20123617%203195348.14f58964-9a2f-42fb-8b6d-62440df23454/items?page=1&pageSize=50

### Retrieves the details of a specific transferred item for a given database and source

 - [GET /transfers/databases/{databaseName}/sources/{sourceName}/items/{itemId}](https://api-docs.sitecore.com/sai/item-transfer/items/gettransferreditemdetails.md): Given a particular itemId within an active sourceName into a databaseName, returns all captured metadata and corresponding localized or versioned field information.

Example:
GET /sitecore/shell/api/v3/ItemsTransfer/transfers/databases/master/sources/consumed.20260622%20123617%203195348.14f58964-9a2f-42fb-8b6d-62440df23454/items/11111111-1111-1111-1111-111111111111

## Sources

Operations for managing file and blob storage sources for transfers.

### Returns a paginated list of blob sources available in the system

 - [GET /sources/blobs](https://api-docs.sitecore.com/sai/item-transfer/sources/getblobsources.md): Retrieves the list of available blob sources from Azure Blob Storage which have not yet been deleted or permanently archived.

Example:
GET /sitecore/shell/api/v3/ItemsTransfer/sources/blobs?page=1&pageSize=50

### Retrieves the state of a specific blob source

 - [GET /sources/blobs/{blobName}](https://api-docs.sitecore.com/sai/item-transfer/sources/getblobsourcestate.md): Returns HTTP 200 containing BlobDetailsResult containing the state of the blob source.

Example:
GET /sitecore/shell/api/v3/ItemsTransfer/sources/blobs/content_2025-08-28.raif

### Uploads a blob to the system for processing

 - [POST /sources/blobs/{blobName}](https://api-docs.sitecore.com/sai/item-transfer/sources/uploadblobsource.md): Note that the file data is pushed using stream content chunks. Set query parameter gzip to true if stream applies gzip algorithms.

Example:
POST /sitecore/api/v3/ItemsTransfer/sources/blobs/content_2025-08-28.raif?gzip=true

### Discards a transferred source by deleting its associated file or blob

 - [DELETE /sources/blobs/{blobName}](https://api-docs.sitecore.com/sai/item-transfer/sources/deleteblobsource.md): Performs the permanent removal of artifacts tracking across Blob storage and caches representing the passed source.

Example:
DELETE /sitecore/shell/api/v3/ItemsTransfer/sources/blobs/content_2025-08-28.raif

### Lists file sources

 - [GET /sources/files](https://api-docs.sitecore.com/sai/item-transfer/sources/getfilesources.md): Returns all file sources natively accessible by the CMS, with optional support for paginated tracking.

Example:
GET /sitecore/shell/api/v3/ItemsTransfer/sources/files?page=1&pageSize=50

## History

Access to historical records of item transfers.

### Retrieves a paginated history of consumed sources across all databases

 - [GET /history](https://api-docs.sitecore.com/sai/item-transfer/history/gettransfershistory.md): Returns the complete transition timeline of each transfer in descending order by ConsumeDate. Useful for inspecting historical runs.

Example:
GET /sitecore/shell/api/v3/ItemsTransfer/history?page=1&pageSize=50


(new API section below)

# Content Transfer API

The Content Transfer REST API allows SitecoreAI administrators to initiate, monitor, and finalize content transfer operations for migrating content data from one SitecoreAI environment (the *source*) to another (the *destination*). This enables efficient transfer of data between environments using chunked data streaming with encryption and compression support.

Each transfer operation includes at least one set of chunked data, where each chunk set represents a single data tree that was nominated for transfer. When an operation is complete, each of its chunk sets will be represented by a `.raif` file in the destination environment. To finish integrating the transferred data, use the separate [Item Transfer API](https://api-docs.sitecore.com/sai/item-transfer) to have the destination database consume the `.raif` files.

The key stages of a content transfer operation are as follows:
- **Create the transfer operation** - specify the content you want to transfer and apply optional configuration parameters, creating the initial operation. Depending on how much data is being transferred, this will create one or more sets of chunked data.
- **Monitor the operation** - view key information about an existing transfer operation, including its current status and metadata for each of its chunk sets (such as the ID and how many chunks it contains).
- **Transfer data chunks** - for each chunk of data in a particular chunk set, copy the chunk data from the source environment to a corresponding location in the destination environment. This stage involves calling two endpoints as a pair.
- **Complete a chunk set transfer** - when all chunks in a particular set have been transferred, mark that set as complete and generate a `.raif` file in the destination environment.
- **Cleanup** - when all chunk sets in a transfer operation are complete, delete the transfer operation from the source environment and clean up all associated resources.

# Base URL
In the base URL, replace `{host}` with your environment host name. Find the value in SitecoreAI Deploy > **Projects** > your project > **Authoring environments** > your environment > **Details** > **Environment host name**. 

# Authorization
To authorize your requests, use environment automation client credentials and generate a JSON Web Token (JWT).

Note: To create client credentials, you must be an [Organization Admin or Organization Owner](https://doc.sitecore.com/portal/en/developers/sitecore-cloud-portal/roles.html).

## Create an automation client
1. In the Sitecore Cloud Portal, open SitecoreAI Deploy.
2. Click **Credentials** > **Environment** > **Create credentials** > **Automation**.
3. Fill out the automation client details, then click **Create**.
4. Copy the client ID and the client secret because you won't be able to view them again in SitecoreAI Deploy. You'll use them to request a JWT.

## Request a JWT

Run the following cURL command to request a JWT. Replace the placeholder values with your client ID and client secret.
```curl
  curl -X POST 'https://auth.sitecorecloud.io/oauth/token' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'client_id={YOUR_CLIENT_ID}' \
  --data-urlencode 'client_secret={YOUR_CLIENT_SECRET}' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode 'audience=https://api.sitecorecloud.io'
```

The JWT expires in 24 hours. If your requests unexpectedly return a response with status `401 Unauthorized`, request a new JWT by repeating this `POST` request.

We recommend that you cache the JWT for 24 hours to avoid repeating this `POST` request while the JWT is still valid.

## Include the JWT in the request header

You can now start making REST API requests. You must include the JWT in the request header of every request. For example:
```curl
  curl -X GET '{YOUR_BASE_URL}/...' \
  -H 'Authorization: Bearer {YOUR_JWT}' \
  -H 'Accept: application/json'
```


Version: v1
Metadata:
  - product: SitecoreAI

## Servers

```
https://{host}
```

Variables:
- `host`: The environment host name
Default: "cm.your-tenant.sitecorecloud.io"

## Security

### bearerAuth

Type: http
Scheme: bearer
Bearer Format: JWT

## Download OpenAPI description

[Content Transfer API](https://api-docs.sitecore.com/_bundle/sai/content-transfer/index.yaml)

## Content transfer API

APIs for content transfer operations.

### Create a content transfer operation

 - [POST /sitecore/api/content/transfer/v1/transfers](https://api-docs.sitecore.com/sai/content-transfer/content-transfer-api/contenttransfer_createcontenttransfer.md): Creates a new operation to transfer one or more specified items from your source environment. You must specify a unique ID for the transfer, which you'll use later in the transfer workflow.

Warning: If you reuse a previous transfer ID, the transfer operation associated with that ID will be overwritten (if it was not previously deleted using this API).

By default, a transfer will only include single items based on the paths you specify, and it will replace any duplicate items found in the destination environment. You can override these settings to include descendants or choose a different merge strategy as needed.

### Retrieve details of a content transfer operation

 - [GET /sitecore/api/content/transfer/v1/transfers/{transferId}/status](https://api-docs.sitecore.com/sai/content-transfer/content-transfer-api/contenttransfer_getcontenttransferstatus.md): Important: You must be an Organization Admin or Organization Owner to use this endpoint.

Retrieves information about a specific operation, including its current status and a list of the chunk sets included.

For each chunk set in the specified operation, the response contains:
- The chunk set's unique ID.
- How many chunks are in the set.
- How many items are represented by the chunk set.

You will use this information when iterating through chunk set data during the transfer of chunk sets between environments.

### Retrieve a specific chunk of transfer data

 - [GET /sitecore/api/content/transfer/v1/transfers/{transferId}/chunksets/{chunksetId}/chunks/{chunkId}](https://api-docs.sitecore.com/sai/content-transfer/content-transfer-api/contenttransfer_getchunkasync.md): Important: You must be an Organization Admin or Organization Owner to use this endpoint.

To migrate the data in a specific chunk set within a content transfer operation, you need to fetch each chunk of data in that set and copy them to the destination environment. This endpoint fetches the data for a single chunk.

The response body contains a binary stream of serialized item data, and the first chunk in a given set also includes a header.

Depending on whether the chunk represents a media item or a content item, the data will either be compressed or encrypted, and the returned value of IsMedia will either be true or false:
- Media data (IsMedia = true) is compressed.
- Content data (IsMedia = false) is encrypted.

You must pair each call to this endpoint with a matching call to the corresponding endpoint (Save a data chunk to the destination environment), which accepts the binary stream. Repeat that pairing until you have copied all chunks in a particular set to the destination environment.

Content description metadata is exposed via Content-Disposition header parameters:
- ItemsProcessed: number of successfully processed items written into the stream
- ItemsSkipped: number of items in the chunk that were skipped (failed / filtered)
- IsMedia: indicates whether the returned payload was compressed (true) or encrypted (false).

### Save a data chunk to the destination environment

 - [PUT /sitecore/api/content/transfer/v1/transfers/{transferId}/chunksets/{chunksetId}/chunks/{chunkId}](https://api-docs.sitecore.com/sai/content-transfer/content-transfer-api/contenttransfer_savechunkasync.md): Important: You must be an Organization Admin or Organization Owner to use this endpoint.

For each chunk of content in a set within a transfer operation, use this endpoint to copy the chunk to the destination environment after using the corresponding endpoint (Retrieve a specific chunk of transfer data) to obtain a binary stream representing the chunk data.

Important: The request body for this endpoint MUST be the raw binary stream obtained from the response of the paired endpoint.

Do not alter, wrap, re-encode or chunk the stream; forward it exactly as received:
- For media chunks, the client must send the compressed bytes as-is, with no decompression.
- For content (non-media) chunks, the client must send the encrypted bytes as-is, with no decryption.

When you've finished fetching and transferring all the chunks in a particular set, you can use the next endpoint (Complete a chunk set) to generate a .raif file containing that chunk set's data on the destination environment.

### Complete a chunk set

 - [POST /sitecore/api/content/transfer/v1/transfers/{transferId}/chunksets/{chunksetId}/complete](https://api-docs.sitecore.com/sai/content-transfer/content-transfer-api/contenttransfer_completechunksetasync.md): Important: You must be an Organization Admin or Organization Owner to use this endpoint.

When all chunk data in a particular chunk set has been copied to the destination environment, use this endpoint to generate a .raif file containing the chunk set data on that environment. The name of this new file is returned in the body of a successful call to this endpoint.

To incorporate the .raif file data into the destination environment's database, use the separate Item Transfer API.

### Delete a content transfer and clean up associated resources

 - [DELETE /sitecore/api/content/transfer/v1/transfers/{transferId}](https://api-docs.sitecore.com/sai/content-transfer/content-transfer-api/contenttransfer_deletecontenttransfer.md): Important: You must be an Organization Admin or Organization Owner to use this endpoint.

If you no longer need a particular content transfer operation—either because you've finished converting the contents of its chunk sets into .raif files, or because the transfer was unsuccessful or cancelled—use this endpoint to delete the operation and all associated resources that are no longer required.
