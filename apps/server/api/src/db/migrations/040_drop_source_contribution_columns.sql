-- The per-source composition columns, vestigial since 022 moved the merge method onto the
-- topology (`topologies.composition_mode`): the API still took and stored them, but resolve
-- derives every source's contribution from the topology's mode and never read them.
ALTER TABLE topology_data_sources DROP COLUMN node_contribution;
ALTER TABLE topology_data_sources DROP COLUMN link_contribution;
