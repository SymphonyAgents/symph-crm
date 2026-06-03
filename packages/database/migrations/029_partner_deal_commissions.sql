CREATE TABLE IF NOT EXISTS "partner_deal_commissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid REFERENCES "workspaces"("id"),
  "deal_id" uuid NOT NULL REFERENCES "deals"("id") ON DELETE CASCADE,
  "partner_deal_group_id" uuid NOT NULL REFERENCES "partner_deal_groups"("id") ON DELETE CASCADE,
  "commission_amount_scaled" bigint DEFAULT 0 NOT NULL,
  "commission_status" text DEFAULT 'pending' NOT NULL,
  "notes" text,
  "created_by" text REFERENCES "users"("id"),
  "updated_by" text REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "partner_deal_commissions_deal_group_unique" ON "partner_deal_commissions" ("deal_id", "partner_deal_group_id");
CREATE INDEX IF NOT EXISTS "partner_deal_commissions_deal_idx" ON "partner_deal_commissions" ("deal_id");
CREATE INDEX IF NOT EXISTS "partner_deal_commissions_group_idx" ON "partner_deal_commissions" ("partner_deal_group_id");
CREATE INDEX IF NOT EXISTS "partner_deal_commissions_workspace_idx" ON "partner_deal_commissions" ("workspace_id");
