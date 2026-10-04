import { describe, expect, it, vi } from 'vitest'

import { createDocument, setLookFamily, setParam, type GradientDocument } from '@/engine/document'
import {
  MAX_ANCHORS,
  MAX_FLOW_STOPS,
  SILK_COLOR_COUNT,
  deriveFlowLook,
  deriveLookFromDocument,
  deriveSilkLook,
} from '@/engine/render/derive-look'

function blobDoc(seed: string): GradientDocument {
  return setLookFamily(createDocument(seed), 'blob')
}

function flowDoc(seed: string): GradientDocument {
  return setLookFamily(createDocument(seed), 'flow')
}

function silkDoc(seed: string): GradientDocument {
  return setLookFamily(createDocument(seed), 'silk')
}

describe('deriveLookFromDocument', () => {
  it('same seed and params yield identical anchors and uniforms', () => {
    const doc = blobDoc('look-seed-a')
    expect(deriveLookFromDocument(doc)).toEqual(deriveLookFromDocument(doc))
  })

  it('same seed and params under blob vs flow vs silk yield different family look data', () => {
    const seed = 'cross-family-seed'
    const blob = deriveLookFromDocument(blobDoc(seed))
    const flow = deriveFlowLook(flowDoc(seed))
    const silk = deriveSilkLook(silkDoc(seed))

    expect(blob.anchors).toBeDefined()
    expect(flow.stops).toBeDefined()
    expect(silk.colors).toBeDefined()
    expect(blob).not.toEqual(flow)
    expect(flow).not.toEqual(silk)
    expect(blob).not.toEqual(silk)

    const base = createDocument(seed)
    expect(setLookFamily(base, 'blob').params).toEqual(base.params)
    expect(setLookFamily(base, 'flow').seed).toBe(base.seed)
    expect(setLookFamily(base, 'silk').seed).toBe(base.seed)
  })

  it('same seed and blob family yield identical count, positions, and radii', () => {
    const a = deriveLookFromDocument(blobDoc('blob-determinism'))
    const b = deriveLookFromDocument(blobDoc('blob-determinism'))
    expect(
      a.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y, radius: anchor.radius })),
    ).toEqual(b.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y, radius: anchor.radius })))
  })

  it('different seeds yield different anchors', () => {
    const a = deriveLookFromDocument(blobDoc('look-seed-a'))
    const b = deriveLookFromDocument(blobDoc('look-seed-b'))
    expect(a.anchors).not.toEqual(b.anchors)
  })

  it('blob anchor count is always in [3, 4] and varies across seeds', () => {
    const counts = new Set<number>()
    for (let i = 0; i < 60; i += 1) {
      const look = deriveLookFromDocument(blobDoc(`blob-count-${i}`))
      expect(look.anchors.length).toBeGreaterThanOrEqual(3)
      expect(look.anchors.length).toBeLessThanOrEqual(4)
      expect(look.anchors.length).toBeLessThanOrEqual(MAX_ANCHORS)
      counts.add(look.anchors.length)
    }
    expect(counts.has(3)).toBe(true)
    expect(counts.has(4)).toBe(true)
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

    expect(softLook.anchors.map((a) => [a.x, a.y])).toEqual(baseLook.anchors.map((a) => [a.x, a.y]))
    expect(softLook.uniforms.softness).toBe(0.9)
    expect(softLook.uniforms.softness).not.toBe(baseLook.uniforms.softness)
  })
})

describe('deriveFlowLook', () => {
  it('same seed and schema yield identical flow uniforms and stops', () => {
    const doc = flowDoc('flow-seed-a')
    expect(deriveFlowLook(doc)).toEqual(deriveFlowLook(doc))
  })

  it('different seeds yield different flow field params', () => {
    const a = deriveFlowLook(flowDoc('flow-seed-a'))
    const b = deriveFlowLook(flowDoc('flow-seed-b'))
    expect(a).not.toEqual(b)
  })

  it('stop count is always in [3, 5] and packs rgb in [0, 1]', () => {
    const counts = new Set<number>()
    for (let i = 0; i < 40; i += 1) {
      const look = deriveFlowLook(flowDoc(`flow-stops-${i}`))
      expect(look.stops.length).toBeGreaterThanOrEqual(3)
      expect(look.stops.length).toBeLessThanOrEqual(5)
      expect(look.stops.length).toBeLessThanOrEqual(MAX_FLOW_STOPS)
      counts.add(look.stops.length)
      for (const rgb of look.stops) {
        for (const channel of rgb) {
          expect(channel).toBeGreaterThanOrEqual(0)
          expect(channel).toBeLessThanOrEqual(1)
        }
      }
    }
    expect(counts.size).toBeGreaterThan(1)
  })

  it('packs soft/grain/energy and seeded field params without Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    const doc = setParam(
      setParam(flowDoc('flow-uniforms'), 'softness', 'amount', 0.7),
      'grain',
      'amount',
      0.4,
    )
    const look = deriveFlowLook(doc)

    expect(look.uniforms.softness).toBe(0.7)
    expect(look.uniforms.grain).toBe(0.4)
    expect(look.uniforms.energy).toBe(doc.params.palette.energy)
    expect(look.uniforms.swirlStrength).toBeGreaterThan(0)
    expect(look.uniforms.fieldScale).toBeGreaterThan(0)
    expect(look.uniforms.phase).toHaveLength(2)
    expect(look.uniforms.seedHash).toBeTypeOf('number')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('deriveSilkLook', () => {
  it('same seed and schema yield identical silk uniforms and colors', () => {
    const doc = silkDoc('silk-seed-a')
    expect(deriveSilkLook(doc)).toEqual(deriveSilkLook(doc))
  })

  it('different seeds yield different silk fold params', () => {
    const a = deriveSilkLook(silkDoc('silk-seed-a'))
    const b = deriveSilkLook(silkDoc('silk-seed-b'))
    expect(a).not.toEqual(b)
  })

  it('always returns three rgb stops in [0, 1]', () => {
    for (let i = 0; i < 30; i += 1) {
      const look = deriveSilkLook(silkDoc(`silk-colors-${i}`))
      expect(look.colors).toHaveLength(SILK_COLOR_COUNT)
      for (const rgb of look.colors) {
        expect(rgb).toHaveLength(3)
        for (const channel of rgb) {
          expect(channel).toBeGreaterThanOrEqual(0)
          expect(channel).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('packs soft/grain/energy and seeded fold params without Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    const doc = setParam(
      setParam(silkDoc('silk-uniforms'), 'softness', 'amount', 0.65),
      'grain',
      'amount',
      0.35,
    )
    const look = deriveSilkLook(doc)

    expect(look.uniforms.softness).toBe(0.65)
    expect(look.uniforms.grain).toBe(0.35)
    expect(look.uniforms.energy).toBe(doc.params.palette.energy)
    expect(look.uniforms.foldAngle).toBeGreaterThanOrEqual(0)
    expect(look.uniforms.foldAngle).toBeLessThanOrEqual(Math.PI * 2)
    expect(look.uniforms.foldFreq).toBeGreaterThanOrEqual(4.5)
    expect(look.uniforms.foldFreq).toBeLessThanOrEqual(10.5)
    expect(look.uniforms.sheenStrength).toBeGreaterThanOrEqual(0.48)
    expect(look.uniforms.sheenStrength).toBeLessThanOrEqual(0.95)
    expect(look.uniforms.iterations).toBeGreaterThanOrEqual(4)
    expect(look.uniforms.iterations).toBeLessThanOrEqual(8)
    expect(look.uniforms.seedHash).toBeTypeOf('number')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('fold freq and sheen stay in tuned ranges across seeds', () => {
    for (let i = 0; i < 50; i += 1) {
      const look = deriveSilkLook(silkDoc(`silk-ranges-${i}`))
      expect(look.uniforms.foldFreq).toBeGreaterThanOrEqual(4.5)
      expect(look.uniforms.foldFreq).toBeLessThanOrEqual(10.5)
      expect(look.uniforms.sheenStrength).toBeGreaterThanOrEqual(0.48)
      expect(look.uniforms.sheenStrength).toBeLessThanOrEqual(0.95)
    }
  })

  it('iteration count varies across seeds within [4, 8]', () => {
    const counts = new Set<number>()
    for (let i = 0; i < 50; i += 1) {
      const look = deriveSilkLook(silkDoc(`silk-iters-${i}`))
      expect(look.uniforms.iterations).toBeGreaterThanOrEqual(4)
      expect(look.uniforms.iterations).toBeLessThanOrEqual(8)
      counts.add(look.uniforms.iterations)
    }
    expect(counts.size).toBeGreaterThan(1)
  })
})
