// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Session-level transient state — status text, YAML source, init flag.
// Not persisted; not in undo. Just runtime UI signals.

const sessionState = $state({
  status: 'Loading...',
  yamlSource: '',
  initialized: false,
  /** Active project id (null = nothing loaded; 'sample' = read-only sample). */
  projectId: null as string | null,
  /** User-visible project name. Used by the cache mirror and settings UI. */
  projectName: 'Untitled',
})

export const sessionStore = {
  get status(): string {
    return sessionState.status
  },
  setStatus(v: string) {
    sessionState.status = v
  },
  get yamlSource(): string {
    return sessionState.yamlSource
  },
  setYamlSource(v: string) {
    sessionState.yamlSource = v
  },
  get initialized(): boolean {
    return sessionState.initialized
  },
  setInitialized(v: boolean) {
    sessionState.initialized = v
  },
  get projectId(): string | null {
    return sessionState.projectId
  },
  setProjectId(v: string | null) {
    sessionState.projectId = v
  },
  get projectName(): string {
    return sessionState.projectName
  },
  setProjectName(v: string) {
    sessionState.projectName = v
  },
}
