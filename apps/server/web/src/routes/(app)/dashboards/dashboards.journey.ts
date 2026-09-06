import type { DocumentationJourney } from '../topologies/topologies.journey.js'

/** Stable dashboard creation flow shared by documentation checks and a future browser runner. */
export const createDashboardJourney: DocumentationJourney = {
  id: 'server.dashboards.create',
  route: '/dashboards',
  source: 'apps/server/web/src/routes/(app)/dashboards/+page.svelte',
  steps: [
    { action: 'click', anchor: 'new-dashboard' },
    { action: 'fill', anchor: 'dashboard-name', value: 'Network operations' },
    { action: 'click', anchor: 'create-dashboard' },
    { action: 'expect-url', value: '/dashboards/:id' },
  ],
}
