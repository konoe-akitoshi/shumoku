// Copyright (C) 2026 system_explorer contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Parse a scenario YAML document into a {@link ScenarioDoc}.
//
// This is deliberately a thin, validating wrapper over `js-yaml`: it checks the
// shape the plugin contract guarantees (id / name / non-empty steps) and stamps
// the owning `topology` id. It does NOT build packet bytes — that is the
// standalone viewer's job (see the system_explorer repo, `lib/flow/spec.ts`).
// A consumer can therefore use the parsed doc for the narrative without
// depending on the packet builder.

import { load } from 'js-yaml'
import type { ScenarioDoc } from './schema.js'

export function parseScenarioDoc(yaml: string, topologyId?: string): ScenarioDoc {
  const doc = load(yaml) as ScenarioDoc | null | undefined
  if (!doc || typeof doc !== 'object') {
    throw new Error('scenario document is empty or not an object')
  }
  if (typeof doc.id !== 'string' || typeof doc.name !== 'string') {
    throw new Error(`scenario ${doc.name ?? '?'} is missing id / name`)
  }
  if (!Array.isArray(doc.steps) || doc.steps.length === 0) {
    throw new Error(`scenario ${doc.id} has no steps`)
  }
  if (topologyId) doc.topology = topologyId
  return doc
}
