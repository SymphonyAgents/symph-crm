UPDATE users
SET
  role = 'PARTNER',
  status = 'pending',
  is_active = true,
  is_onboarded = false,
  current_team = NULL,
  "updatedAt" = NOW()
WHERE email IS NOT NULL
  AND lower(email) NOT LIKE '%@symph.co'
  AND deleted_at IS NULL
  AND status = 'active'
  AND role = 'BUILD';
