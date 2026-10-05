import { describe, expect, it, vi } from 'vitest'

import { createDocument, setLookFamily, setParam, type GradientDocument } from '@/engine/document'
import {
  MAX_ANCHORS,
  MAX_BLOOM_STOPS,
  MAX_FLOW_STOPS,
  SILK_COLOR_COUNT,
  deriveBloomLook,
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

function bloomDoc(seed: string): GradientDocument {
  return setLookFamily(createDocument(seed), 'bloom')
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

  it('swirl and field scale stay in tuned ranges across seeds', () => {
    for (let i = 0; i < 50; i += 1) {
      const look = deriveFlowLook(flowDoc(`flow-ranges-${i}`))
      expect(look.uniforms.swirlStrength).toBeGreaterThanOrEqual(0.28)
      expect(look.uniforms.swirlStrength).toBeLessThanOrEqual(0.83)
      expect(look.uniforms.fieldScale).toBeGreaterThanOrEqual(1.55)
      expect(look.uniforms.fieldScale).toBeLessThanOrEqual(3.9)
    }
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

describe('deriveBloomLook', () => {
  it('same seed and schema yield identical bloom uniforms and stops', () => {
    const doc = bloomDoc('bloom-seed-a')
    expect(deriveBloomLook(doc)).toEqual(deriveBloomLook(doc))
  })

  it('different seeds yield different bloom field params', () => {
    const a = deriveBloomLook(bloomDoc('bloom-seed-a'))
    const b = deriveBloomLook(bloomDoc('bloom-seed-b'))
    expect(a).not.toEqual(b)
  })

  it('stop count is always in [4, 5] and packs rgb in [0, 1]', () => {
    const counts = new Set<number>()
    for (let i = 0; i < 40; i += 1) {
      const look = deriveBloomLook(bloomDoc(`bloom-stops-${i}`))
      expect(look.stops.length).toBeGreaterThanOrEqual(4)
      expect(look.stops.length).toBeLessThanOrEqual(5)
      expect(look.stops.length).toBeLessThanOrEqual(MAX_BLOOM_STOPS)
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

  it('packs soft/grain/energy and seeded warp params without Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    const doc = setParam(
      setParam(
        setParam(bloomDoc('bloom-uniforms'), 'softness', 'amount', 0.72),
        'grain',
        'amount',
        0.38,
      ),
      'palette',
      'energy',
      0.55,
    )
    const look = deriveBloomLook(doc)

    expect(look.uniforms.softness).toBe(0.72)
    expect(look.uniforms.grain).toBe(0.38)
    expect(look.uniforms.energy).toBe(0.55)
    expect(look.uniforms.warpScale).toBeGreaterThan(0)
    expect(look.uniforms.warpAmp).toBeGreaterThan(0)
    expect(look.uniforms.fieldScale).toBeGreaterThan(0)
    expect(look.uniforms.seedHash).toBeTypeOf('number')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('higher softness lowers warp scale, amp, and field frequency for the same seed', () => {
    const seed = 'bloom-soft-map'
    const firm = deriveBloomLook(
      setParam(
        setParam(bloomDoc(seed), 'softness', 'amount', 0.05),
        'palette',
        'energy',
        0.5,
      ),
    )
    const soft = deriveBloomLook(
      setParam(
        setParam(bloomDoc(seed), 'softness', 'amount', 0.95),
        'palette',
        'energy',
        0.5,
      ),
    )

    expect(soft.uniforms.warpScale).toBeLessThan(firm.uniforms.warpScale)
    expect(soft.uniforms.warpAmp).toBeLessThan(firm.uniforms.warpAmp)
    expect(soft.uniforms.fieldScale).toBeLessThan(firm.uniforms.fieldScale)
    expect(soft.stops).toEqual(firm.stops)
  })

  it('higher energy raises warp amp and keeps stop chroma capped', () => {
    const seed = 'bloom-energy-map'
    const calm = deriveBloomLook(
      setParam(
        setParam(bloomDoc(seed), 'softness', 'amount', 0.4),
        'palette',
        'energy',
        0.05,
      ),
    )
    const vivid = deriveBloomLook(
      setParam(
        setParam(bloomDoc(seed), 'softness', 'amount', 0.4),
        'palette',
        'energy',
        0.95,
      ),
    )

    expect(vivid.uniforms.warpAmp).toBeGreaterThan(calm.uniforms.warpAmp)
    expect(vivid.uniforms.warpScale).toBe(calm.uniforms.warpScale)
    expect(vivid.uniforms.fieldScale).toBe(calm.uniforms.fieldScale)

    for (const rgb of vivid.stops) {
      const chroma = Math.max(...rgb) - Math.min(...rgb)
      expect(chroma).toBeLessThanOrEqual(0.72)
    }
  })

  it('grain packs 1:1 while soft/energy leave grain untouched', () => {
    const seed = 'bloom-grain-map'
    const low = deriveBloomLook(setParam(bloomDoc(seed), 'grain', 'amount', 0.05))
    const high = deriveBloomLook(setParam(bloomDoc(seed), 'grain', 'amount', 0.9))
    expect(low.uniforms.grain).toBe(0.05)
    expect(high.uniforms.grain).toBe(0.9)
    expect(high.uniforms.warpScale).toBe(low.uniforms.warpScale)
    expect(high.uniforms.warpAmp).toBe(low.uniforms.warpAmp)
    expect(high.uniforms.fieldScale).toBe(low.uniforms.fieldScale)
  })

  it('warp and field scales stay in tuned ranges across seeds at mid dials', () => {
    for (let i = 0; i < 50; i += 1) {
      const doc = setParam(
        setParam(
          setParam(bloomDoc(`bloom-ranges-${i}`), 'softness', 'amount', 0.5),
          'palette',
          'energy',
          0.5,
        ),
        'grain',
        'amount',
        0.5,
      )
      const look = deriveBloomLook(doc)
      expect(look.uniforms.warpScale).toBeGreaterThanOrEqual(0.8)
      expect(look.uniforms.warpScale).toBeLessThanOrEqual(2.6)
      expect(look.uniforms.warpAmp).toBeGreaterThanOrEqual(0.2)
      expect(look.uniforms.warpAmp).toBeLessThanOrEqual(1.15)
      expect(look.uniforms.fieldScale).toBeGreaterThanOrEqual(0.7)
      expect(look.uniforms.fieldScale).toBeLessThanOrEqual(1.8)
    }
  })

  it('bloom look data differs from blob anchors for the same seed', () => {
    const seed = 'bloom-vs-blob'
    const bloom = deriveBloomLook(bloomDoc(seed))
    const blob = deriveLookFromDocument(blobDoc(seed))
    expect(bloom.stops).toBeDefined()
    expect(blob.anchors).toBeDefined()
    expect(bloom).not.toEqual(blob)
  })
})
