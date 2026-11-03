// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { sampleNetworkModel, sampleNetworkYaml } from './fixtures/index.js'
import { darkTheme, drawNetwork, lightTheme, version } from './index.js'

describe('@shumoku/core', () => {
  describe('exports', () => {
    it('should export version', () => {
      expect(version).toBeDefined()
    })

    it('should export the drawing entry', () => {
      expect(drawNetwork).toBeDefined()
    })

    it('should export themes', () => {
      expect(lightTheme).toBeDefined()
      expect(darkTheme).toBeDefined()
    })
  })

  describe('themes', () => {
    it('should have lightTheme with required properties', () => {
      expect(lightTheme.name).toBeDefined()
      expect(lightTheme.colors).toBeDefined()
      expect(lightTheme.colors.background).toBeDefined()
    })

    it('should have darkTheme with required properties', () => {
      expect(darkTheme.name).toBeDefined()
      expect(darkTheme.colors).toBeDefined()
      expect(darkTheme.colors.background).toBeDefined()
    })
  })

  describe('fixtures', () => {
    it('should export the sample network as YAML and as a model', () => {
      expect(sampleNetworkYaml).toContain('Sample Network')
      const model = sampleNetworkModel()
      expect(model.config.nodes.length).toBeGreaterThan(0)
      expect(model.config.groups?.map((g) => g.id)).toEqual(['cloud', 'perimeter', 'dmz', 'campus'])
    })
  })
})
