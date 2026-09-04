# Symph CRM NFS to GCS FUSE Migration Plan

**Goal:** Move all CRM-owned content from Aria's shared NFS into a private `symph-crm` Cloud Storage bucket mounted through Cloud Storage FUSE, while preserving existing CRM API and UI behavior and making the CRM API the only content access boundary.

**Source baseline:** `SymphonyAgents/symph-crm` main at `4359aaed43fc083140cecfd2bc692c83cc8ec5ed`

**Verified data baseline:** `/share/crm` contains 721 files, 497 directories, no symlinks, and 29,274,679 bytes. The newest observed write was 2026-08-28.

**Verified code baseline:** Using the deployment-matched pnpm 9 toolchain, the API webpack build and all five registered API regressions passed before implementation: wiki frontmatter, auth guard, user roles, inbound email, and meeting actions.

## Accepted behavior

- CRM notes, resources, wiki pages, summaries, context documents, and playbooks remain readable and writable through existing CRM APIs and UI surfaces.
- Existing relative paths remain unchanged, so PostgreSQL `storage_path` references continue to resolve.
- The production API mounts a private CRM-owned GCS bucket at `/share/crm` through Cloud Storage FUSE.
- The API initially runs with `max-instances=1`.
- All application filesystem operations are owned by `StorageService`; deal, wiki, contact, meeting, document, and chat layers do not import or call `fs` directly.
- All Aria CRM workflows use CRM APIs for content access. They do not read or write `/share/crm` directly.
- The migration is idempotent, never deletes source files, verifies every copied file by SHA-256, and emits bounded durable execution evidence.
- The first copy may run while CRM is live. A final delta copy runs during a short write freeze immediately before cutover.
- Production traffic moves all at once after no-traffic revision acceptance. No old/new revision traffic split is allowed.
- The original NFS tree remains untouched and available for rollback until a separately approved retirement point.

## Explicit exclusions and prohibited side effects

- Do not modify or extend `agent-worker` or `agent-worker-pi`. Existing OG Cloud Aria capabilities may perform ordinary authorized access administration, but migration execution remains owned by the CRM Cloud Run Job selected by Ben.
- Do not delegate implementation. The originating Local Aria session remains the sole execution engineer.
- Do not migrate or redesign structured PostgreSQL records.
- Do not move Supabase-hosted voice recordings, signed proposal PDFs, catalog icons, proposal HTML, or proposal versions.
- Do not rename, normalize, or delete existing storage paths, including historical or misspelled directories.
- Do not create a second content model or speculative metadata catalog.
- Do not add a distributed lock table or raw SQL advisory locks in the initial one-instance design.
- Do not merge the production deployment change before the bucket is populated and verified, because pushes to `main` deploy automatically.
- Do not cut production traffic without a separate human approval after migration evidence is available.
- Do not print file contents, secrets, credentials, or customer-sensitive paths into normal logs.

## Important security prerequisite

The public repository contained plaintext credentials in `build/deploy-runbook.md`. Read-only hash comparison in OG Cloud Aria session `1545321745672835135` verified that the committed database URL, Google OAuth client secret, NextAuth secret, and cron secret still match their active Secret Manager latest versions. Before migration execution or production deployment:

1. Keep the tracked runbook sanitized without reproducing values elsewhere.
2. Rotate the database URL/password, Google OAuth client secret, NextAuth secret, and cron secret through their owning provider and caller paths.
3. Run a repository and history secrets scan.
4. Keep all new bucket, IAM, and migration configuration free of credential values.

This prerequisite is release-blocking but does not block local source implementation.

## Implementation Design Brief

### Problem

CRM content is authoritative on Aria's shared NFS. Removing that mount would leave dangling PostgreSQL pointers, empty note/wiki surfaces, failed document reads, and potentially ephemeral writes. Direct filesystem access is duplicated across four backend services and several Aria skills.

### Correct layer

- `StorageService` owns mounted-volume path resolution and every filesystem primitive.
- Domain services own CRM behavior and consume `StorageService` methods.
- Cloud Run configuration owns the FUSE mount and one-instance ceiling.
- A one-shot CRM-owned Cloud Run Job owns the NFS-to-GCS copy and verification.
- CRM API endpoints own agent content access.

### Rejected layers

- No filesystem logic in controllers or React code.
- No GCS SDK calls scattered across domain services. FUSE is the deployment adapter.
- No direct agent mount. Volunteer Neo machines must not receive bucket credentials or filesystem access.
- No new PostgreSQL content schema. The existing logical file contract remains useful and the dataset is tiny.
- No raw SQL advisory lock. Project backend rules prohibit raw SQL, and distributed coordination is not earned while production is explicitly limited to one API instance.

### Concurrency contract

Verified writers:

- `StorageService`: markdown and binary create, overwrite, and delete.
- `DealNotesService`: unique note writes, deterministic note upserts, author backfill, note deletion, unique summary writes.
- `WikiService`: mutable page overwrite and log append.
- Aria skills: currently direct wiki/summary reads and writes, to be routed through CRM APIs.

Initial coordination:

- Production API has `max-instances=1`.
- A process-local per-path promise queue in `StorageService` serializes writes, appends, and deletes to the same path inside that one instance.
- All external writers route through the API.
- Unique timestamped files do not require global serialization, but still use the central service.
- Deployments use a no-traffic revision and an all-at-once traffic switch so two revisions do not write concurrently.

Known ceiling:

- If API scaling above one instance is needed, the single-writer contract no longer holds. Before increasing the ceiling, replace the process-local queue with cross-instance coordination or object-generation compare-and-swap. A warning comment and deployment regression check will make this executable rather than relying only on documentation.

### Security impact

- The GCS bucket is private, uniform-access, versioned, and owned by `symph-crm`.
- Only the CRM API runtime identity receives normal object read/write access.
- The migration job uses the same bounded runtime identity unless live inspection proves a narrower existing identity is required.
- NFS is mounted read-only on the migration job.
- Destination storage is never public.
- Path traversal is rejected centrally with separator-aware root containment.
- Migration logs contain aggregate counts and digests by default. Detailed mismatch paths remain in restricted job logs only when needed.

### Scalability and data-access impact

- Current scale is 721 files and 29.3 MB.
- Directory listing remains bounded by per-deal/per-category prefixes in existing behavior.
- Cloud Run enables implicit directories by default for Cloud Storage FUSE, matching current prefix-shaped paths.
- GCS FUSE is not POSIX-complete. The code will use only supported read, write, append, list, stat, mkdir, and delete operations.
- Mutable shared paths are serialized inside the sole API process.
- The migration script streams hashes and file copies rather than buffering the full tree.

### Module boundary plan

- `apps/api/src/storage/storage.service.ts`
  - Own root configuration, safe path resolution, exists/read/write/append/list/stat/delete, and per-path serialization.
  - Preserve Supabase-specific voice, signed-PDF, and catalog-icon methods.
- `apps/api/src/storage/storage-content-metadata.ts`
  - Own pure markdown and HTML excerpt extraction so StorageService remains within the repository read-size budget.
- `apps/api/src/deals/deal-notes.service.ts`
  - Own note parsing, categories, summaries, audit, and wiki triggers.
  - Depend on `StorageService`, never `fs` or absolute paths.
- `apps/api/src/wiki/wiki.service.ts`
  - Own wiki page semantics and structured logs.
  - Depend on `StorageService`, never `fs` or absolute paths.
- `apps/api/src/contacts/contact-notes.service.ts`
  - Own contact note response assembly.
  - Depend on `StorageService`, never `fs` or absolute paths.
- `scripts/migrate-crm-storage.mjs`
  - Own source/destination traversal, idempotent copy, SHA-256 verification, aggregate manifest digest, and verify-only mode.
- `Dockerfile.storage-migration`
  - Minimal image containing only the migration script and Node runtime.
- `cloudbuild.storage-migration.yaml`
  - Build and deploy/update the one-task migration job with read-only NFS and writable GCS mounts. It must not execute automatically.
- `cloudbuild.yaml`
  - Mount the verified bucket at `/share/crm`, set API `max-instances=1`, and remove the old NFS/VPC dependency only at cutover.
- CRM skills in `symphco/aria-skills`
  - Replace direct `/share/crm` access with existing CRM API endpoints.
  - Keep skill behavior and attribution intact.

Dependency direction:

```text
Controllers and domain services -> StorageService -> mounted filesystem
Aria skills -> CRM internal API -> domain services -> StorageService
Migration job -> read-only NFS mount + writable GCS mount
```

Forbidden imports:

- No `fs` imports outside `apps/api/src/storage/storage.service.ts` in application source.
- No GCS SDK in deal, wiki, contact, document, meeting, or chat modules.
- No CRM product logic in the migration script.
- No direct `/share/crm` references in Aria skills.

### Verification plan

- Baseline and final API build.
- Existing API regression scripts.
- New storage regression covering safe path resolution, read/write/list/stat/delete, append ordering, and same-path serialization using a temporary local directory.
- Architecture regression proving no application source outside `StorageService` imports `fs` or hardcodes `/share/crm`.
- Migration-script tests covering dry run, first copy, idempotent rerun, changed-file replacement, verify-only mismatch detection, binary integrity, no source deletion, and bounded output.
- Migration dry run against a local fixture tree.
- Reconcile active PostgreSQL `documents.storage_path` values against the mounted destination and identify any records still served only by the legacy Supabase `content` fallback.
- Production source/destination totals and aggregate manifest SHA-256 equality.
- API/UAT checks for notes, wiki index/page, summaries, text upload, binary upload/preview/download, meeting artifacts, context injection, and pricing playbook retrieval.
- Cloud Run checks for one API instance, exact bucket mount, private IAM, versioning, no NFS volume, no unnecessary VPC attachment, one serving revision, and clean error logs.

**Quality verdict:** PROCEED. Ben approved the no-SQL, single-instance design and requested direct implementation without delegated engineering sessions.

## Commit-shaped implementation groups

### Group 1: Centralize mounted content storage

**Commit goal:** Make `StorageService` the only application filesystem owner while preserving all existing API response shapes and storage paths.

**Files owned:**

- `apps/api/src/storage/storage.service.ts`
- `apps/api/src/storage/storage.module.ts`
- `apps/api/src/deals/deal-notes.service.ts`
- `apps/api/src/wiki/wiki.service.ts`
- `apps/api/src/contacts/contact-notes.service.ts`
- focused regression scripts under `apps/api/scripts/`
- `apps/api/package.json` only for script registration

**What changes:** Expand the existing service instead of creating a parallel abstraction. Add separator-aware path validation, directory entry/stat methods, append, and per-path serialization. Inject and use it from all three direct filesystem domain services.

**Performance contract:** Existing per-deal category scans remain bounded. No global bucket scan enters request paths. Resource stat calls remain limited to one selected deal/contact directory.

**Independence:** Works with the current NFS mount and the future FUSE mount because both expose the same filesystem contract.

**Verification:** API build, existing regression scripts, new behavior and architecture regression.

### Group 2: Add an idempotent CRM-owned migration job

**Commit goal:** Provide a repeatable one-task migration that copies the entire CRM tree from read-only NFS to GCS FUSE and verifies content without deleting source data.

**Files owned:**

- `scripts/migrate-crm-storage.mjs`
- `scripts/migrate-crm-storage.test.mjs`
- `Dockerfile.storage-migration`
- `cloudbuild.storage-migration.yaml`
- root package script registration if useful

**What changes:** Add standard-library streaming traversal, SHA-256 manifests, copy/verify and verify-only modes, idempotent replacement of mismatched destination files, and aggregate evidence.

**Performance contract:** One task, one file at a time, bounded memory, no unbounded model-facing output, no source deletion, rerunnable after interruption.

**Independence:** Does not affect production API or deploy automatically.

**Verification:** Fixture tests plus local dry run.

### Group 3: Make production deployment FUSE-ready

**Commit goal:** Define the final single-instance private GCS FUSE deployment without activating it prematurely.

**Files owned:**

- `cloudbuild.yaml`
- `docs/gcs-storage-architecture.md` as the current storage architecture
- `docs/ARCHITECTURE.md`
- `docs/WIKI-SYNC.md`
- `build/deploy-runbook.md` sanitized, with rotation as a separate operational gate
- deployment regression script if needed

**What changes:** Add bucket substitution and GCS volume mount at `/share/crm`, set API max instances to one, remove NFS/VPC configuration from the final service, document the scaling ceiling and rollback flow, and remove plaintext credentials from the active runbook.

**Independence:** This commit is source-coherent but must remain on an unmerged PR until the bucket copy and production cutover gate are approved because `main` auto-deploys.

**Verification:** YAML/config regression, secrets scan, Cloud Build config validation, local image builds.

### Group 4: Make Aria workflows API-only

**Commit goal:** Remove direct CRM filesystem reads/writes from canonical skills without changing CRM operation behavior.

**Repository:** `symphco/aria-skills`, separate isolated worktree and PR.

**Files owned:**

- `crm-ingest/SKILL.md`
- `crm-query/SKILL.md`
- `crm-summarize-deal/SKILL.md`
- `pricing-judge/SKILL.md`
- related validation fixtures if present

**What changes:** Use existing CRM internal endpoints for notes, wiki pages, summaries, and playbooks. Remove fallback instructions that write directly to NFS. The migration does not add new agent-specific application machinery.

**Independence:** Can land before storage cutover because the APIs already front NFS.

**Verification:** Skill validation plus literal scan proving no `/share/crm` references remain in active CRM skills.

## Infrastructure and rollout gates

### Gate A: Access and security

- Restore authorized `symph-crm` GCP access for the current operator or provide managed product access.
- Verify the live API service account and existing NFS volume configuration.
- Rotate and remove any exposed credentials.

### Gate B: Provisioning

- Create the access-bounded private regional bucket `symph-crm-nfs-vault`.
- Enable uniform bucket-level access and object versioning.
- Grant the verified API runtime identity bucket-scoped object access.
- Build the migration image and create the job, but do not run it until its exact configuration is reviewed.

### Gate C: Initial copy

- Execute one task with NFS read-only and GCS read/write.
- Require successful source and destination counts, byte totals, and aggregate SHA-256 manifest equality.
- Re-run to prove idempotency.

### Gate D: Human cutover approval

Present:

- source and destination manifest equality,
- job execution evidence,
- bucket/IAM/versioning evidence,
- source PR and independent review verdict,
- tested rollback path,
- exact planned write-freeze window.

No production cutover occurs before Ben explicitly approves this gate.

### Gate E: Cutover and monitored acceptance

- Freeze CRM writes briefly.
- Run final delta and verify equality.
- Deploy/tag a no-traffic FUSE revision.
- Run direct revision smoke tests.
- Move 100 percent traffic atomically.
- Verify all named API/UI paths and watch logs.
- Roll back immediately on missing content, FUSE errors, permission errors, or write divergence.

## Current blockers and evidence gaps

- Local user `gcloud` credentials require reauthentication and available ADC has no effective `symph-crm` permissions.
- AURA currently has no Product record matching `symph-crm`.
- OG Cloud Aria access session `1545321745672835135` granted `ben.rocat@symph.co` resource-bounded access for bucket `symph-crm-nfs-vault`, job `symph-crm-nfs-to-gcs-migration`, API service `symph-crm-api`, and runtime identity `188047996224-compute@developer.gserviceaccount.com`.
- IAM policy readback succeeded in the access session. Local ADC identified the same Ben account; immediate Cloud Run REST read still returned 403, so propagation or conditional-resource matching must be verified before infrastructure mutation.
