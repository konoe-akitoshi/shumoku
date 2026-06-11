-- No-change gate: hash of the contribution's STRUCTURAL content (volatile
-- fields like observedAt stripped). A re-sync whose hash matches the stored
-- one skips the composition-revision bump — and with it the multi-minute
-- layout re-bake — because nothing the diagram shows has changed.
ALTER TABLE contribution_source ADD COLUMN content_hash TEXT;
