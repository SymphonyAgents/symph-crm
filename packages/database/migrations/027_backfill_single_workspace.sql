UPDATE "deals"
SET "workspace_id" = (
  SELECT "id" FROM "workspaces" WHERE "slug" = 'symph' ORDER BY "created_at" ASC LIMIT 1
)
WHERE "workspace_id" IS NULL
  AND EXISTS (SELECT 1 FROM "workspaces" WHERE "slug" = 'symph');

UPDATE "companies"
SET "workspace_id" = (
  SELECT "id" FROM "workspaces" WHERE "slug" = 'symph' ORDER BY "created_at" ASC LIMIT 1
)
WHERE "workspace_id" IS NULL
  AND EXISTS (SELECT 1 FROM "workspaces" WHERE "slug" = 'symph');

UPDATE "documents"
SET "workspace_id" = (
  SELECT "id" FROM "workspaces" WHERE "slug" = 'symph' ORDER BY "created_at" ASC LIMIT 1
)
WHERE "workspace_id" IS NULL
  AND EXISTS (SELECT 1 FROM "workspaces" WHERE "slug" = 'symph');
