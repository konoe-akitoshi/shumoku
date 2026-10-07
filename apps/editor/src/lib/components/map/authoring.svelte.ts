import type { Point } from '$lib/map/model'

type Placement =
  | { kind: 'existing'; nodeId: string }
  | { kind: 'empty' }
  | { kind: 'product'; productId: string }
  | { kind: 'termination'; role: 'outlet' | 'eps' | 'panel' }
export const mapAuthoring = $state({
  cancelWireDrag: undefined as (() => void) | undefined,
  placement: null as Placement | null,
  calibration: null as { drawingId: string; from?: Point } | null,
})
