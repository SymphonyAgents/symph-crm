-- Merge legacy proposal chains that encoded versions in proposals.title.
-- Correct shape: one proposals row per deal/proposal name, many
-- proposal_versions rows underneath it.

CREATE TEMP TABLE proposal_chain_merge_targets ON COMMIT DROP AS
WITH normalized AS (
  SELECT
    p.id,
    p.deal_id,
    p.title,
    p.updated_at,
    regexp_replace(p.title, '\s+v[0-9]+$', '', 'i') AS base_title,
    COALESCE((substring(p.title FROM '\s+v([0-9]+)$'))::int, 1) AS title_version,
    (p.title ~* '\s+v[0-9]+$') AS has_title_version
  FROM proposals p
  WHERE p.deleted_at IS NULL
),
duplicate_groups AS (
  SELECT deal_id, base_title
  FROM normalized
  GROUP BY deal_id, base_title
  HAVING count(*) > 1
     AND bool_or(has_title_version)
)
SELECT DISTINCT ON (n.deal_id, n.base_title)
  n.deal_id,
  n.base_title,
  n.id AS target_id
FROM normalized n
JOIN duplicate_groups g
  ON g.deal_id IS NOT DISTINCT FROM n.deal_id
 AND g.base_title = n.base_title
ORDER BY n.deal_id, n.base_title, n.title_version DESC, n.updated_at DESC, n.id;

CREATE TEMP TABLE proposal_chain_merge_versions ON COMMIT DROP AS
WITH normalized AS (
  SELECT
    p.id,
    p.deal_id,
    regexp_replace(p.title, '\s+v[0-9]+$', '', 'i') AS base_title,
    COALESCE((substring(p.title FROM '\s+v([0-9]+)$'))::int, 1) AS title_version
  FROM proposals p
  WHERE p.deleted_at IS NULL
)
SELECT
  pv.id AS version_id,
  t.target_id,
  row_number() OVER (
    PARTITION BY n.deal_id, n.base_title
    ORDER BY n.title_version ASC, pv.version ASC, pv.created_at ASC, pv.id ASC
  ) AS new_version
FROM normalized n
JOIN proposal_chain_merge_targets t
  ON t.deal_id IS NOT DISTINCT FROM n.deal_id
 AND t.base_title = n.base_title
JOIN proposal_versions pv
  ON pv.proposal_id = n.id;

UPDATE proposal_versions pv
SET
  proposal_id = vr.target_id,
  version = -vr.new_version
FROM proposal_chain_merge_versions vr
WHERE pv.id = vr.version_id;

UPDATE proposal_versions
SET version = abs(version)
WHERE version < 0;

WITH version_counts AS (
  SELECT proposal_id, count(*)::int AS version_count, max(created_at) AS latest_version_at
  FROM proposal_versions
  GROUP BY proposal_id
)
UPDATE proposals p
SET
  title = t.base_title,
  current_version = vc.version_count,
  updated_at = GREATEST(p.updated_at, vc.latest_version_at)
FROM proposal_chain_merge_targets t
JOIN version_counts vc
  ON vc.proposal_id = t.target_id
WHERE p.id = t.target_id;

UPDATE proposals p
SET
  deleted_at = now(),
  updated_at = now()
FROM proposal_chain_merge_targets t
WHERE p.deal_id IS NOT DISTINCT FROM t.deal_id
  AND regexp_replace(p.title, '\s+v[0-9]+$', '', 'i') = t.base_title
  AND p.id <> t.target_id;
