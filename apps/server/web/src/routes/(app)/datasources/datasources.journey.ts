import type { DocumentationJourney } from '../topologies/topologies.journey.js'

/** Stable creation flow shared by documentation checks and a future browser runner. */
export const createDataSourceJourney: DocumentationJourney = {
  id: 'server.datasources.create',
  route: '/datasources',
  source: 'apps/server/web/src/routes/(app)/datasources/+page.svelte',
  steps: [
    { action: 'click', anchor: 'add-data-source' },
    { action: 'click', anchor: 'choose-data-source-type' },
    { action: 'fill', anchor: 'data-source-name', value: 'Monitoring' },
    { action: 'click', anchor: 'create-data-source' },
  ],
}
