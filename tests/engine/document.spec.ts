import { describe, expect, it, vi } from 'vitest'

import {
  createDocument,
  isValidSeed,
  normalizeDocument,
  randomize,
  setLookFamily,
  setLookFamilyMode,
  setParam,
  setSeed,
  type GradientDocument,
  type GradientDocumentV1,
  type GradientDocumentV2,
} from '@/engine/document'

describe('GradientDocument', () => {
  it('creates a schemaVersion 3 document with lookFamilyMode random and param families', () => {
    const doc = createDocument('fixed-seed-for-create')
    expect(doc.schemaVersion).toBe(3)
    expect(doc.seed).toBe('fixed-seed-for-create')
    expect(['blob', 'flow', 'silk']).toContain(doc.lookFamily)
    expect(doc.lookFamilyMode).toBe('random')
    expect(doc.params.palette).toBeDefined()
    expect(doc.params.softness).toBeDefined()
    expect(doc.params.grain).toBeDefined()
    expect(typeof doc.params.palette.energy).toBe('number')
    expect(typeof doc.params.softness.amount).toBe('number')
    expect(typeof doc.params.grain.amount).toBe('number')
  })

  it('derives identical lookFamily and params for the same seed across two create paths', () => {
    const a = createDocument('same-seed-params')
    const b = createDocument('same-seed-params')
    expect(a.lookFamily).toBe(b.lookFamily)
    expect(a.params).toEqual(b.params)
  })
})

describe('document commands', () => {
  it('setSeed replaces seed and keeps prior params, lookFamily, and lookFamilyMode', () => {
    const base = setLookFamilyMode(createDocument('original'), 'silk')
    const tuned = setParam(base, 'grain', 'amount', 0.42)
    const updated = setSeed(tuned, 'restored-seed')
    expect(updated.seed).toBe('restored-seed')
    expect(updated.lookFamily).toBe(tuned.lookFamily)
    expect(updated.lookFamilyMode).toBe('silk')
    expect(updated.params).toEqual(tuned.params)
    expect(updated.params).not.toEqual(createDocument('restored-seed').params)
    expect(tuned.seed).toBe('original')
  })

  it('isValidSeed accepts trimmed non-empty strings and rejects blank', () => {
    expect(isValidSeed('abc')).toBe(true)
    expect(isValidSeed('  abc  ')).toBe(true)
    expect(isValidSeed('')).toBe(false)
    expect(isValidSeed('   ')).toBe(false)
  })

  it('setParam updates one param without changing seed, lookFamily, or lookFamilyMode', () => {
    const base = setLookFamilyMode(createDocument('param-seed'), 'flow')
    const updated = setParam(base, 'grain', 'amount', 0.42)
    expect(updated.seed).toBe(base.seed)
    expect(updated.lookFamily).toBe(base.lookFamily)
    expect(updated.lookFamilyMode).toBe('flow')
    expect(updated.params.grain.amount).toBe(0.42)
    expect(updated.params.palette).toEqual(base.params.palette)
    expect(updated.params.softness).toEqual(base.params.softness)
    expect(base.params.grain.amount).not.toBe(0.42)
  })

  it('setLookFamilyMode changes mode only and leaves seed, params, and lookFamily identical', () => {
    const base = createDocument('mode-only-seed')
    const updated = setLookFamilyMode(base, 'silk')
    expect(updated.lookFamilyMode).toBe('silk')
    expect(updated.seed).toBe(base.seed)
    expect(updated.lookFamily).toBe(base.lookFamily)
    expect(updated.params).toEqual(base.params)
    expect(base.lookFamilyMode).toBe('random')
  })

  it('setLookFamilyMode ignores invalid mode values', () => {
    const base = setLookFamilyMode(createDocument('invalid-mode-seed'), 'flow')
    const updated = setLookFamilyMode(base, 'nope' as 'random')
    expect(updated.lookFamilyMode).toBe('flow')
    expect(updated.seed).toBe(base.seed)
    expect(updated.lookFamily).toBe(base.lookFamily)
    expect(updated.params).toEqual(base.params)
  })

  it('setLookFamily changes lookFamily and keeps seed and params', () => {
    const base = setParam(createDocument('family-switch-seed'), 'grain', 'amount', 0.37)
    expect(base.lookFamilyMode).toBe('random')
    const next = setLookFamily(base, 'silk')
    expect(next.lookFamily).toBe('silk')
    expect(next.seed).toBe(base.seed)
    expect(next.params).toEqual(base.params)
    expect(next.lookFamilyMode).toBe('random')
    expect(base.lookFamily).not.toBe('silk')
  })

  it('setLookFamily with random mode keeps mode random', () => {
    const base = createDocument('family-random-mode')
    expect(base.lookFamilyMode).toBe('random')
    const next = setLookFamily(base, 'flow')
    expect(next.lookFamily).toBe('flow')
    expect(next.lookFamilyMode).toBe('random')
  })

  it('setLookFamily with fixed mode aligns mode to the selected family', () => {
    const base = setLookFamilyMode(createDocument('family-fixed-mode'), 'blob')
    const next = setLookFamily(base, 'silk')
    expect(next.lookFamily).toBe('silk')
    expect(next.lookFamilyMode).toBe('silk')
    expect(next.seed).toBe(base.seed)
    expect(next.params).toEqual(base.params)
  })

  it('setLookFamily ignores invalid family values', () => {
    const base = setLookFamily(createDocument('invalid-family-seed'), 'flow')
    const updated = setLookFamily(base, 'nope' as 'blob')
    expect(updated.lookFamily).toBe('flow')
    expect(updated.lookFamilyMode).toBe(base.lookFamilyMode)
    expect(updated.seed).toBe(base.seed)
    expect(updated.params).toEqual(base.params)
  })

  it('randomize with random mode matches createDocument for family and params', () => {
    const bytes = new Uint8Array(16).fill(0xab)
    const getRandomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation(<T extends ArrayBufferView>(array: T): T => {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(
          bytes.subarray(0, array.byteLength),
        )
        return array
      })

    const mathSpy = vi.spyOn(Math, 'random')
    const base = createDocument('before-randomize')
    expect(base.lookFamilyMode).toBe('random')
    const next = randomize(base)

    expect(getRandomValues).toHaveBeenCalled()
    expect(next.seed).not.toBe(base.seed)
    expect(next.seed).toMatch(/^[0-9a-f]+$/)
    expect(next.lookFamilyMode).toBe('random')
    const fresh = createDocument(next.seed)
    expect(next.lookFamily).toBe(fresh.lookFamily)
    expect(next.params).toEqual(fresh.params)
    expect(mathSpy).not.toHaveBeenCalled()

    getRandomValues.mockRestore()
    mathSpy.mockRestore()
  })

  it('randomize with fixed mode always yields that lookFamily and preserves mode', () => {
    const bytes = new Uint8Array(16).fill(0xcd)
    const getRandomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation(<T extends ArrayBufferView>(array: T): T => {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(
          bytes.subarray(0, array.byteLength),
        )
        return array
      })

    for (const mode of ['blob', 'flow', 'silk'] as const) {
      getRandomValues.mockClear()
      const base = setLookFamilyMode(createDocument('fixed-mode-base'), mode)
      const next = randomize(base)
      expect(next.lookFamily).toBe(mode)
      expect(next.lookFamilyMode).toBe(mode)
      expect(next.seed).not.toBe(base.seed)
    }

    getRandomValues.mockRestore()
  })

  it('fixed-mode randomize params still match createDocument for the new seed', () => {
    const bytes = new Uint8Array(16).fill(0xef)
    const getRandomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation(<T extends ArrayBufferView>(array: T): T => {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(
          bytes.subarray(0, array.byteLength),
        )
        return array
      })

    const base = setLookFamilyMode(createDocument('consume-draw-base'), 'silk')
    const next = randomize(base)
    const fresh = createDocument(next.seed)
    expect(next.params).toEqual(fresh.params)
    expect(next.lookFamily).toBe('silk')
    expect(next.lookFamily).not.toBe(fresh.lookFamily)

    getRandomValues.mockRestore()
  })

  it('does not expose free-form field mutation helpers on the public API', async () => {
    const mod = await import('@/engine/document')
    expect(mod).not.toHaveProperty('setDocument')
    expect(mod).not.toHaveProperty('patchDocument')
    expect(mod).not.toHaveProperty('updateDocument')
    expect(mod).toHaveProperty('setLookFamilyMode')
    expect(mod).toHaveProperty('setLookFamily')
  })
})

describe('normalizeDocument', () => {
  it('defaults v1 documents to lookFamily blob and lookFamilyMode random without re-deriving', () => {
    const v1: GradientDocumentV1 = {
      schemaVersion: 1,
      seed: 'legacy-seed',
      params: {
        palette: { energy: 0.11 },
        softness: { amount: 0.22 },
        grain: { amount: 0.33 },
      },
    }
    const normalized = normalizeDocument(v1)
    expect(normalized.schemaVersion).toBe(3)
    expect(normalized.lookFamily).toBe('blob')
    expect(normalized.lookFamilyMode).toBe('random')
    expect(normalized.params).toEqual(v1.params)
    expect(normalized.seed).toBe(v1.seed)
  })

  it('migrates v2 documents to schema 3 with lookFamilyMode random', () => {
    const v2: GradientDocumentV2 = {
      schemaVersion: 2,
      seed: 'v2-seed',
      lookFamily: 'flow',
      params: {
        palette: { energy: 0.4 },
        softness: { amount: 0.5 },
        grain: { amount: 0.6 },
      },
    }
    const normalized = normalizeDocument(v2)
    expect(normalized.schemaVersion).toBe(3)
    expect(normalized.lookFamily).toBe('flow')
    expect(normalized.lookFamilyMode).toBe('random')
    expect(normalized.params).toEqual(v2.params)
    expect(normalized.seed).toBe(v2.seed)
  })

  it('returns v3 documents unchanged when lookFamily and lookFamilyMode are valid', () => {
    const doc = setLookFamilyMode(createDocument('v3-seed'), 'blob')
    expect(normalizeDocument(doc)).toEqual(doc)
  })
})

describe('generate-path Math.random ban', () => {
  it('createDocument / setSeed / setParam / setLookFamilyMode / setLookFamily / randomize never call Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    const getRandomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation(<T extends ArrayBufferView>(array: T): T => {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(1)
        return array
      })

    let doc: GradientDocument = createDocument('ban-math-random')
    doc = setSeed(doc, 'ban-math-random-2')
    doc = setParam(doc, 'palette', 'energy', 0.5)
    doc = setLookFamilyMode(doc, 'flow')
    doc = setLookFamily(doc, 'silk')
    doc = randomize(doc)

    expect(doc.schemaVersion).toBe(3)
    expect(spy).not.toHaveBeenCalled()

    spy.mockRestore()
    getRandomValues.mockRestore()
  })
})
