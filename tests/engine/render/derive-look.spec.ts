import { describe, expect, it, vi } from 'vitest'

import { createDocument, setParam } from '@/engine/document'
import { deriveLookFromDocument } from '@/engine/render/derive-look'

describe('deriveLookFromDocument', () => {
  it('same seed and params yield identical anchors and uniforms', () => {
    const doc = createDocument('look-seed-a')
    expect(deriveLookFromDocument(doc)).toEqual(deriveLookFromDocument(doc))
  })

  it('different seeds yield different anchors', () => {
    const a = deriveLookFromDocument(createDocument('look-seed-a'))
    const b = deriveLookFromDocument(createDocument('look-seed-b'))
    expect(a.anchors).not.toEqual(b.anchors)
  })

  it('returns five anchors with positions in [0,1] and rgb in [0,1]', () => {
    const look = deriveLookFromDocument(createDocument('bounds-seed'))
    expect(look.anchors).toHaveLength(5)
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
    const doc = createDocument('uniform-seed')
    const look = deriveLookFromDocument(doc)

    expect(look.uniforms.softness).toBe(doc.params.softness.amount)
    expect(look.uniforms.grain).toBe(doc.params.grain.amount)
    expect(look.uniforms.energy).toBe(doc.params.palette.energy)
    expect(look.uniforms.seedHash).toBeTypeOf('number')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('setParam soft/grain/energy changes uniforms but not anchor positions', () => {
    const base = createDocument('param-look')
    const soft = setParam(base, 'softness', 'amount', 0.9)
    const baseLook = deriveLookFromDocument(base)
    const softLook = deriveLookFromDocument(soft)

    expect(softLook.anchors.map((a) => [a.x, a.y])).toEqual(
      baseLook.anchors.map((a) => [a.x, a.y]),
    )
    expect(softLook.uniforms.softness).toBe(0.9)
    expect(softLook.uniforms.softness).not.toBe(baseLook.uniforms.softness)
  })
})
