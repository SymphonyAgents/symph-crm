# CRM Content Storage on Cloud Storage FUSE

## Overview

Symph CRM stores CRM-managed notes, wiki pages, summaries, context documents, playbooks, and non-audio resource files in a private Cloud Storage bucket owned by the `symph-crm` GCP project. Cloud Run mounts that bucket at `/share/crm` through Cloud Storage FUSE.

PostgreSQL remains authoritative for structured CRM records and storage-path metadata. Supabase Storage remains authoritative for voice recordings, signed proposal PDFs, and public catalog icons. `StorageService.readMarkdown()` temporarily retains the existing legacy `content` bucket fallback until database pointers are reconciled after cutover. Proposal HTML and proposal versions remain in PostgreSQL.

## Ownership boundary

`apps/api/src/storage/storage.service.ts` is the only application source file allowed to perform filesystem operations. Domain services receive relative paths and call `StorageService`.

```text
CRM UI and Aria workflows
          |
          v
      CRM API
          |
          v
   StorageService
          |
          v
Cloud Storage FUSE at /share/crm
          |
          v
 gs://symph-crm-nfs-vault
```

Aria workflows use CRM API endpoints. They do not receive bucket credentials, mount the bucket, or access `/share/crm` directly.

## Logical layout

Existing paths remain stable so PostgreSQL `storage_path` values need no rewrite:

```text
deals/{dealId}/
  general/*.md
  meeting/*.md
  notes/*.md
  discovery/*.md
  transcript/*.md
  proposal/*.md
  summaries/*.md
  resources/*
  context.md
  index.md
  log.md
companies/{companyId}/index.md
people/{contactId}/...
_playbooks/*
MASTER_INDEX.md
WIKI_SCHEMA.md
log.md
```

Historical path variants are preserved during migration. Do not rename or normalize objects as part of storage maintenance.

## Single-writer invariant

Cloud Storage FUSE does not provide cross-mount write locking. CRM therefore starts with a deliberate single-writer deployment contract:

- `symph-crm-api` has `--max-instances=1` in `cloudbuild.yaml`.
- `StorageService` serializes writes, appends, and deletes to the same path inside that process.
- Every external writer, including Aria, uses the CRM API.
- Production cutovers move traffic all at once and do not split writes across old and new revisions.

This preserves same-path operation ordering inside one mounted API process. It does not make a separate read followed later by a write atomic. If stale whole-page replacement becomes a real failure mode, add an explicit revision or object-generation compare-and-swap contract.

Do not increase the API instance limit until cross-instance coordination is implemented and verified. `test:storage-boundary` enforces the source and deployment portions of this invariant.

## Environment

```text
CRM_STORAGE_PATH=/share/crm
```

Local development may set `CRM_STORAGE_PATH` to any writable local directory. The application does not select or detect a provider. The deployment owns whether that path is backed by Cloud Storage FUSE or a local filesystem.

## Migration

The one-shot job `symph-crm-nfs-to-gcs-migration` is defined by `cloudbuild.storage-migration.yaml` and uses `Dockerfile.storage-migration`.

It mounts:

- `10.95.69.154:/share` read-only at `/mnt/nfs`,
- `gs://symph-crm-nfs-vault` read/write at `/mnt/gcs`.

`scripts/migrate-crm-storage.mjs` copies `/mnt/nfs/crm` to `/mnt/gcs`, preserves every relative file path, hashes files with SHA-256, verifies exact source and destination manifests, and never deletes source data. The job is one task with no automatic retries and does not execute as part of normal deployment.

Migration sequence:

1. Provision the private bucket with uniform bucket-level access and object versioning.
2. Configure the job without executing it.
3. Review job identity, mounts, network, and destination.
4. Run the initial copy and verify manifest equality.
5. Rerun to prove idempotency.
6. Freeze CRM writes briefly and run the final delta.
7. Deploy and test a no-traffic FUSE-backed API revision.
8. Move traffic all at once after explicit approval.
9. Retain NFS unchanged for rollback until separately retired.

## Verification

At minimum, verify:

- source and destination file counts, byte totals, and aggregate manifest SHA-256 match,
- note create/read/delete,
- wiki index/page read and write,
- summary creation and retrieval,
- text and binary upload, preview, and download,
- meeting summary and transcript retrieval,
- playbook retrieval through CRM APIs,
- exactly one serving API revision and one maximum API instance,
- no NFS volume or unnecessary Aria VPC attachment on the serving revision,
- no new permission, FUSE, or storage errors in Cloud Run logs.
