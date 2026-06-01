UPDATE users
SET
  deleted_at = NULL,
  is_active = true,
  "updatedAt" = NOW()
WHERE status = 'pending'
  AND role = 'PARTNER'
  AND email IS NOT NULL
  AND lower(email) NOT LIKE '%@symph.co'
  AND deleted_at IS NULL;
