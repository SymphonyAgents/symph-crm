# CRM Wiki Sync

When a user saves a note in the CRM UI, the API writes the note through `StorageService`, returns immediately, and triggers an asynchronous wiki refresh after a three-second per-deal debounce.

## Flow

```text
User adds note in UI
  -> POST /api/deals/{dealId}/notes
  -> DealNotesService writes through StorageService
  -> Cloud Storage FUSE persists the file in the private CRM bucket
  -> API returns the note
  -> per-deal debounce resets

After three seconds without another note for that deal
  -> API sends [CRM_WIKI_SYNC] deal_id={uuid} performed_by={userId}
  -> Aria reads current notes through the CRM internal API
  -> Aria updates deal, company, and master indexes through CRM wiki APIs
  -> Aria requests summary regeneration through the CRM API
```

## Storage and writer boundary

All note, index, summary, and log persistence flows through `StorageService`. Aria does not access the mounted bucket directly and does not receive bucket credentials.

The API is intentionally limited to one Cloud Run instance. The debounce map and mounted-storage per-path queue are process-local. Do not increase `--max-instances` above 1 until cross-instance debounce and write coordination have been implemented and verified.

## Concurrent notes

Different notes use distinct timestamped paths, so concurrent note creation does not overwrite note content. The per-deal debounce coalesces closely spaced saves into one refresh that rereads the complete current note set through the API.

Mutable index and log paths are serialized by `StorageService` inside the single API process. An all-at-once production traffic switch avoids old and new revisions writing concurrently during cutover.

## Failure behavior

- A note write failure fails the request. The API must not report a saved note without durable storage success.
- A later wiki trigger failure does not remove the already-saved note. The failure is logged and a later explicit sync can rebuild indexes from the authoritative note set.
- A deleted note is absent from the next API-backed wiki refresh.
- The source NFS tree remains unchanged during migration and is available only as rollback evidence until retirement is separately approved.

## Verification

A storage change is not accepted until these paths pass:

- note create, list, read, and delete,
- rapid multiple note saves followed by one coherent wiki refresh,
- deal and company index updates,
- global and entity log appends,
- summary creation and retrieval,
- no direct `/share/crm` references in active Aria CRM skills,
- `test:storage-boundary` with the API maximum instance invariant intact.
