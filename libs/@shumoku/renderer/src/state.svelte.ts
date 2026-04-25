import type {
  Link,
  LinkEndpoint,
  ResolvedEdge,
  ResolvedLayout,
  ResolvedPort,
  Subgraph,
  Theme,
} from '@shumoku/core'
import { SvelteMap } from 'svelte/reactivity'
import { themeToColors } from './lib/render-colors'

export class ShumokuStateBox {
  #state = $state<ShumokuState>()

  constructor(init?: ShumokuStateInitializer) {
    this.#state = new ShumokuState(init)
  }

  get state() {
    return this.#state as ShumokuState
  }

  set state(value: ShumokuState) {
    this.#state = value
  }
}

export class ShumokuState {
  // Direct state (preferred — parent owns state)
  nodes: Map<string, Node> = new SvelteMap()
  ports: Map<string, ResolvedPort> = new SvelteMap()
  edges: Map<string, ResolvedEdge> = new SvelteMap()
  subgraphs: Map<string, Subgraph> = new SvelteMap()
  bounds: { x: number; y: number; width: number; height: number } = $state({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  })
  links: Link[] = $state([])
  // Legacy: pass layout object (WebComponent compat)
  layout?: ResolvedLayout = $state()
  graph?: { links: Link[] } = $state()
  theme?: Theme = $state()
  mode: 'view' | 'edit' = $state('view')

  onchange?: (links: Link[]) => void
  onselect?: (id: string | null, type: string | null) => void
  onlabeledit?: (portId: string, label: string, screenX: number, screenY: number) => void
  oncontextmenu?: (id: string, type: string, screenX: number, screenY: number) => void
  onnodeadd?: (id: string) => void
  onnodedelete?: (ids: string[]) => void
  /**
   * Fired when the user drags between two ports to request a new link.
   * The parent owns link identity — it must create the link (with an ID of
   * its choosing) and either push it via `bind:links` or call `appendLink()`.
   */
  oncreatelink?: (from: LinkEndpoint, to: LinkEndpoint) => void

  colors = $derived(themeToColors(this.theme))
  interactive = $derived(this.mode === 'edit')
  linkedPorts = $derived(
    new Set([...this.edges.values()].flatMap((e) => [e.fromPortId, e.toPortId].filter(Boolean))),
  )

  constructor(init?: ShumokuStateInitializer) {
    if (init) Object.assign(this, init)
  }
}

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

type ShumokuStateInitializer = Optional<
  ShumokuState,
  'nodes' | 'ports' | 'edges' | 'subgraphs' | 'bounds' | 'links' | 'mode'
>
