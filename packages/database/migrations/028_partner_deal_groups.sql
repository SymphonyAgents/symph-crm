CREATE TABLE IF NOT EXISTS "partner_deal_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid REFERENCES "workspaces"("id"),
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" text REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "partner_deal_groups_workspace_slug_unique" ON "partner_deal_groups" ("workspace_id", "slug");
CREATE INDEX IF NOT EXISTS "partner_deal_groups_workspace_idx" ON "partner_deal_groups" ("workspace_id");

CREATE TABLE IF NOT EXISTS "partner_deal_group_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid REFERENCES "workspaces"("id"),
  "group_id" uuid NOT NULL REFERENCES "partner_deal_groups"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_by" text REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "partner_deal_group_members_group_user_unique" ON "partner_deal_group_members" ("group_id", "user_id");
CREATE INDEX IF NOT EXISTS "partner_deal_group_members_user_idx" ON "partner_deal_group_members" ("user_id");
CREATE INDEX IF NOT EXISTS "partner_deal_group_members_group_idx" ON "partner_deal_group_members" ("group_id");
CREATE INDEX IF NOT EXISTS "partner_deal_group_members_workspace_idx" ON "partner_deal_group_members" ("workspace_id");

CREATE TABLE IF NOT EXISTS "deal_partner_deal_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid REFERENCES "workspaces"("id"),
  "deal_id" uuid NOT NULL REFERENCES "deals"("id") ON DELETE CASCADE,
  "group_id" uuid NOT NULL REFERENCES "partner_deal_groups"("id") ON DELETE CASCADE,
  "created_by" text REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "deal_partner_deal_groups_deal_group_unique" ON "deal_partner_deal_groups" ("deal_id", "group_id");
CREATE INDEX IF NOT EXISTS "deal_partner_deal_groups_deal_idx" ON "deal_partner_deal_groups" ("deal_id");
CREATE INDEX IF NOT EXISTS "deal_partner_deal_groups_group_idx" ON "deal_partner_deal_groups" ("group_id");
CREATE INDEX IF NOT EXISTS "deal_partner_deal_groups_workspace_idx" ON "deal_partner_deal_groups" ("workspace_id");

INSERT INTO "partner_deal_groups" ("workspace_id", "name", "slug")
SELECT workspace.id, seed.name, seed.slug
FROM (SELECT "id" FROM "workspaces" ORDER BY "created_at" ASC LIMIT 1) workspace
CROSS JOIN (VALUES
  ('ISV - Americas Google', 'isv-americas-google'),
  ('ValorPro', 'valorpro'),
  ('Josys Repackaging', 'josys-repackaging'),
  ('Virginia Reseller', 'virginia-reseller'),
  ('GCP Enterprise FSR', 'gcp-enterprise-fsr'),
  ('CAN', 'can'),
  ('CPS', 'cps')
) AS seed(name, slug)
ON CONFLICT ("workspace_id", "slug") DO NOTHING;
