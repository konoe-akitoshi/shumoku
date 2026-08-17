import type { DashboardService } from '../services/dashboard.js'
import type { DashboardApplicationService } from './services.js'

const DEFAULT_LAYOUT = JSON.stringify({
  columns: 12,
  rowHeight: 100,
  margin: 8,
  widgets: [],
})

export function createDashboardApplicationService(
  service: DashboardService,
): DashboardApplicationService {
  return {
    list: () => service.list(),
    get: (id) => service.get(id),
    create: (input) =>
      service.create({ name: input.name, layoutJson: input.layoutJson ?? DEFAULT_LAYOUT }),
    update: (id, input) => service.update(id, input),
    delete: (id) => service.delete(id),
    share: (id) => service.share(id),
    unshare: (id) => service.unshare(id),
  }
}
