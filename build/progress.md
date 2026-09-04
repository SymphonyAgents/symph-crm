# Build Progress

## 2026-05-04

[2026-05-04 06:36:47] 🚀 Deployed f3d3bbd (feat: wiki obsidian-style sidebar + inline note/resource viewing + graph restyle) to production
[2026-05-04 06:52:05] ✅ GHA build succeeded, revision symph-crm-web-00288-fhb ready
[2026-05-04 06:52:15] ✅ Smoke test passed: crm.symph.co login page loads, all resources 200, no critical errors

## 2026-09-04

[2026-09-04 06:13:20 UTC] NFS retirement research complete: verified 721 files, 29,274,679 bytes, four direct filesystem services, and Cloud Run GCS FUSE support.
[2026-09-04 06:16:09 UTC] Baseline API build and all five existing API regressions passed with pnpm 9.
[2026-09-04 06:50:02 UTC] Scoped GCP access granted to ben.rocat@symph.co for the exact CRM bucket, migration job, API service, Cloud Build submission, and runtime identity.
[2026-09-04 06:53:54 UTC] Centralized CRM filesystem access under StorageService, added single-instance enforcement, migration tooling, and source-level storage regressions. Verification in progress.
[2026-09-04 07:06:18 UTC] API build, web TypeScript/build, storage boundary tests, and six migration behavior tests passed.
[2026-09-04 07:11:36 UTC] Created private regional bucket symph-crm-nfs-vault with uniform access, public-access prevention, versioning, and runtime object access.
[2026-09-04 07:13:00 UTC] Cloud Build 8e85dbfd-03e4-406a-be3e-e791c3a772c2 succeeded and configured the non-executed migration job after correcting its exact runtime identity validation.
[2026-09-04 07:19:59 UTC] Added three direct TypeScript characterization tests for deal notes, wiki operations, and contact notes; all passed.
[2026-09-04 07:22:52 UTC] Verified four credentials exposed in public history still match active versions. Tracked runbook sanitized; coordinated rotation is now a migration-execution and deploy blocker.
[2026-09-04 07:25:28 UTC] Hardened migration build f79cfd85-b70a-4b79-9323-1667795f5238 succeeded with immutable source-archive verification; deployed image digest recorded by Cloud Build.
[2026-09-04 07:48:36 UTC] Final API build, web TypeScript/build, four storage-consumer tests, storage-boundary regression, six migration tests, and all five existing API regressions passed. Remediated all six known high advisories by pinning patched fast-uri and browserslist versions.
[2026-09-04 07:50:10 UTC] Fresh pnpm audit passed the high-severity gate with zero high or critical findings; 22 moderate and 6 low advisories remain outside this migration scope.
[2026-09-04 07:50:10 UTC] Migration tooling committed as 38c285e and the GCS FUSE application/storage cutover source committed as 5b60fb8. Both remain local and unpushed pending the production security and cutover gates.
