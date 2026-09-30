import { describe, expect, it, vi } from 'vitest'

import { createDocument, setParam, type GradientDocument } from '@/engine/document'
import { MAX_ANCHORS, deriveLookFromDocument } from '@/engine/render/derive-look'

function withFamily(doc: GradientDocument, lookFamily: GradientDocument['lookFamily']): GradientDocument {
  return { ...doc, lookFamily }
}

function blobDoc(seed: string): GradientDocument {
  return withFamily(createDocument(seed), 'blob')
}

describe('deriveLookFromDocument', () => {
  it('same seed and params yield identical anchors and uniforms', () => {
    const doc = blobDoc('look-seed-a')
    expect(deriveLookFromDocument(doc)).toEqual(deriveLookFromDocument(doc))
  })

  it('same seed and blob family yield identical count, positions, and radii', () => {
    const a = deriveLookFromDocument(blobDoc('blob-determinism'))
    const b = deriveLookFromDocument(blobDoc('blob-determinism'))
    expect(a.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y, radius: anchor.radius }))).toEqual(
      b.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y, radius: anchor.radius })),
    )
  })

  it('different seeds yield different anchors', () => {
    const a = deriveLookFromDocument(blobDoc('look-seed-a'))
    const b = deriveLookFromDocument(blobDoc('look-seed-b'))
    expect(a.anchors).not.toEqual(b.anchors)
  })

  it('blob anchor count is always in [4, 6] and varies across seeds', () => {
    const counts = new Set<number>()
    for (let i = 0; i < 60; i += 1) {
      const look = deriveLookFromDocument(blobDoc(`blob-count-${i}`))
      expect(look.anchors.length).toBeGreaterThanOrEqual(4)
      expect(look.anchors.length).toBeLessThanOrEqual(6)
      expect(look.anchors.length).toBeLessThanOrEqual(MAX_ANCHORS)
      counts.add(look.anchors.length)
    }
    expect(counts.size).toBeGreaterThan(1)
    expect(counts.has(4) || counts.has(6)).toBe(true)
  })

  it('returns anchors with positions in [0,1] and rgb in [0,1]', () => {
    const look = deriveLookFromDocument(blobDoc('bounds-seed'))
    for (const anchor of look.anchors) {
      expect(anchor.x).toBeGreaterThanOrEqual(0)
      expect(anchor.x).toBeLessThanOrEqual(1)
      expect(anchor.y).toBeGreaterThanOrEqual(0)
      expect(anchor.y).toBeLessThanOrEqual(1)
      expect(anchor.radius).toBeGreaterThan(0)
      for (const channel of anchor.rgb) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(1)
      }
    }
  })

  it('packs document soft/grain/energy into uniforms without Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    const doc = blobDoc('uniform-seed')
    const look = deriveLookFromDocument(doc)

    expect(look.uniforms.softness).toBe(doc.params.softness.amount)
    expect(look.uniforms.grain).toBe(doc.params.grain.amount)
    expect(look.uniforms.energy).toBe(doc.params.palette.energy)
    expect(look.uniforms.seedHash).toBeTypeOf('number')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('setParam soft/grain/energy changes uniforms but not anchor positions', () => {
    const base = blobDoc('param-look')
    const soft = setParam(base, 'softness', 'amount', 0.9)
    const baseLook = deriveLookFromDocument(base)
    const softLook = deriveLookFromDocument(soft)

    expect(softLook.anchors.map((a) => [a.x, a.y])).toEqual(
      baseLook.anchors.map((a) => [a.x, a.y]),
    )
    expect(softLook.uniforms.softness).toBe(0.9)
    expect(softLook.uniforms.softness).not.toBe(baseLook.uniforms.softness)
  })

  it('flow and silk still derive a paint-able look (temporary blob fallback)', () => {
    for (const family of ['flow', 'silk'] as const) {
      const look = deriveLookFromDocument(withFamily(createDocument(`fallback-${family}`), family))
      expect(look.anchors.length).toBeGreaterThanOrEqual(4)
      expect(look.anchors.length).toBeLessThanOrEqual(6)
      expect(look.uniforms.softness).toBeTypeOf('number')
    }
  })
})
