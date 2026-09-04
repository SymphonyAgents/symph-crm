# Symph CRM Cloud Run Deploy Runbook

## Security

- Never put secret values, database URLs, OAuth client secrets, API keys, or tokens in this repository.
- Runtime secrets belong in Secret Manager and are referenced by name from `cloudbuild.yaml`.
- If a secret is ever committed, removing the text is not sufficient. Rotate the credential and run a repository-history secret scan.

## Normal deployment

Production deploys run through `.github/workflows/deploy.yml` after a push to `main`. The workflow authenticates with Workload Identity Federation and submits `cloudbuild.yaml` in project `symph-crm`.

Before merging a production change:

1. Run the repository build and affected regressions.
2. Confirm required schema migrations are applied separately.
3. Record the current serving API and web revisions for rollback.
4. Review changes to Cloud Run IAM, secrets, volumes, instance limits, and network configuration.
5. Merge only after the release owner approves the production rollout.

After deployment:

1. Confirm `latestCreatedRevisionName`, `latestReadyRevisionName`, and the revision receiving 100 percent traffic.
2. Verify the deployed image matches the intended commit.
3. Exercise the changed API or browser behavior.
4. Inspect application logs for new errors before declaring success.

## CRM content storage invariant

The API mounts the private CRM Cloud Storage bucket at `/share/crm` through Cloud Storage FUSE. Application code reads the configured root through `CRM_STORAGE_PATH` and all filesystem operations must flow through `StorageService`.

The API must remain at one maximum instance. `StorageService` uses a process-local per-path queue, so increasing `--max-instances` above 1 removes same-path operation ordering and exposes FUSE to multiple application mounts. The queue does not make a separate read and later write atomic. Cross-instance coordination or object-generation compare-and-swap must be implemented and verified before scaling out.

## NFS to GCS migration

`cloudbuild.storage-migration.yaml` builds and configures the one-shot migration job. It does not execute the job automatically.

Required substitutions:

```text
_CRM_STORAGE_BUCKET=symph-crm-nfs-vault
_MIGRATION_SERVICE_ACCOUNT=188047996224-compute@developer.gserviceaccount.com
_SOURCE_ARCHIVE=aria-migrations/<sha256>.tar.gz
```

The explicit source archive is used with `gcloud builds submit --no-source`. This avoids the known default source-staging failure without widening IAM. Build step `fetch-source` downloads that exact archive from the existing private `symph-crm_cloudbuild` bucket before building the migration image.

The job mounts:

- the old Filestore share read-only at `/mnt/nfs`,
- the new bucket read/write at `/mnt/gcs`.

The migration command recursively copies `/mnt/nfs/crm` into the bucket, preserves relative paths, verifies SHA-256 for every file, and never deletes source data. Run the job once for the initial copy, rerun it to prove idempotency, then run a final delta during the approved write freeze.

Do not merge the FUSE deployment change before source and destination manifests match. A push to `main` triggers production deployment automatically.

## Rollback

Retain the original NFS tree unchanged until the GCS-backed revision has passed monitored acceptance and the release owner separately approves NFS retirement. If the GCS revision fails, route traffic back to the recorded NFS-backed API revision and investigate before attempting another cutover.
