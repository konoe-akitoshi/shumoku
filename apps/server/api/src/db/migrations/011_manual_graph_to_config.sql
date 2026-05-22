-- Move Manual content from `topology_observations` to `data_sources.config_json`.
--
-- Rationale: Manual sources have no upstream — their "content" IS the
-- source. Keying that content by (topology, source) forced an
-- "orphan Manual is meaningless" failure mode and prevented the same
-- Manual from being shared across topologies. Manual graphs now live
-- on the source row itself (as `{"graph": ...}` inside config_json),
-- and the resolver reads them from there.
--
-- For each Manual data_source, take its most-recent observation
-- (across any topology) and stash that graph into config_json.

UPDATE data_sources
SET config_json = json_set(
  COALESCE(NULLIF(config_json, ''), '{}'),
  '$.graph',
  (
    SELECT json(o.graph_json)
    FROM topology_observations o
    WHERE o.source_id = data_sources.id
      AND o.graph_json IS NOT NULL
    ORDER BY o.captured_at DESC
    LIMIT 1
  )
)
WHERE type = 'manual'
  AND EXISTS (
    SELECT 1 FROM topology_observations o
    WHERE o.source_id = data_sources.id
      AND o.graph_json IS NOT NULL
  );

-- Drop the observation rows for Manual sources — they 're redundant now.
-- NetBox / SNMP / etc observations stay; only Manual moves to source-level.
DELETE FROM topology_observations
WHERE source_id IN (SELECT id FROM data_sources WHERE type = 'manual');
