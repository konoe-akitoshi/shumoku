export interface DocumentationJourneyStep {
  action: 'click' | 'fill' | 'expect-url'
  anchor?: string
  value?: string
}

export interface DocumentationJourney {
  id: string
  route: string
  source: string
  steps: DocumentationJourneyStep[]
}

/**
 * Machine-readable form of the topology creation workflow. The documentation
 * checker verifies every anchor against the colocated Svelte page. A browser
 * runner can consume the same steps without duplicating selectors.
 */
export const createTopologyJourney: DocumentationJourney = {
  id: 'server.topologies.create',
  route: '/topologies',
  source: 'apps/server/web/src/routes/(app)/topologies/+page.svelte',
  steps: [
    { action: 'click', anchor: 'add-topology' },
    { action: 'fill', anchor: 'topology-name', value: 'Branch network' },
    { action: 'click', anchor: 'create-topology' },
    { action: 'expect-url', value: '/topologies/:id/sources' },
  ],
}
