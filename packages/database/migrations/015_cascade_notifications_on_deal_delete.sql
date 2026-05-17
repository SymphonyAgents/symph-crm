-- Migration 015: Cascade notifications when deleting deals
-- Deal-specific notifications have no standalone meaning once their deal is deleted.

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_deal_id_fkey;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_deal_id_fkey
  FOREIGN KEY (deal_id)
  REFERENCES deals(id)
  ON DELETE CASCADE;
