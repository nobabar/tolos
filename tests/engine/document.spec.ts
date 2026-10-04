import { describe, expect, it, vi } from 'vitest'

import {
  LOOK_FAMILIES,
  SCHEMA_VERSION,
  createDocument,
  deriveFromSeed,
  isValidSeed,
  normalizeDocument,
  randomize,
  setLookFamily,
  setLookFamilyMode,
  setParam,
  setParamLock,
  setSeed,
  type GradientDocument,
  type GradientDocumentV1,
  type GradientDocumentV2,
  type GradientDocumentV3,
  type GradientDocumentV4,
} from '@/engine/document'

function stubCryptoBytes(fill: number): ReturnType<typeof vi.spyOn> {
  const bytes = new Uint8Array(16).fill(fill)
  return vi
    .spyOn(globalThis.crypto, 'getRandomValues')
    .mockImplementation(<T extends ArrayBufferView>(array: T): T => {
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(
        bytes.subarray(0, array.byteLength),
      )
      return array
    })
}

describe('GradientDocument', () => {
  it('creates a schemaVersion 5 document with unlocked dials and param families', () => {
    const doc = createDocument('fixed-seed-for-create')
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION)
    expect(SCHEMA_VERSION).toBe(5)
    expect(doc.seed).toBe('fixed-seed-for-create')
    expect(LOOK_FAMILIES).toEqual(['blob', 'flow', 'silk', 'bloom'])
    expect(LOOK_FAMILIES).toContain(doc.lookFamily)
    expect(doc.lookFamilyMode).toBe('random')
    expect(doc.paramLocks).toEqual({ palette: false, softness: false, grain: false })
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

  it('same seed can yield bloom and stays identical across derive calls', () => {
    let bloomSeed: string | null = null
    for (let i = 0; i < 200; i += 1) {
      const seed = `bloom-draw-${i}`
      if (deriveFromSeed(seed).lookFamily === 'bloom') {
        bloomSeed = seed
        break
      }
    }
    expect(bloomSeed).not.toBeNull()
    expect(deriveFromSeed(bloomSeed!).lookFamily).toBe('bloom')
    expect(deriveFromSeed(bloomSeed!)).toEqual(deriveFromSeed(bloomSeed!))
    expect(createDocument(bloomSeed!).lookFamily).toBe('bloom')
  })
})

describe('document commands', () => {
  it('setSeed replaces seed and keeps prior params, lookFamily, mode, and locks', () => {
    const base = setParamLock(setLookFamilyMode(createDocument('original'), 'silk'), 'grain', true)
    const tuned = setParam(base, 'grain', 'amount', 0.42)
    const updated = setSeed(tuned, 'restored-seed')
    expect(updated.seed).toBe('restored-seed')
    expect(updated.lookFamily).toBe(tuned.lookFamily)
    expect(updated.lookFamilyMode).toBe('silk')
    expect(updated.paramLocks).toEqual({ palette: false, softness: false, grain: true })
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

  it('setParam updates one param without changing seed, lookFamily, mode, or locks', () => {
    const base = setParamLock(
      setLookFamilyMode(createDocument('param-seed'), 'flow'),
      'palette',
      true,
    )
    const updated = setParam(base, 'grain', 'amount', 0.42)
    expect(updated.seed).toBe(base.seed)
    expect(updated.lookFamily).toBe(base.lookFamily)
    expect(updated.lookFamilyMode).toBe('flow')
    expect(updated.paramLocks).toEqual(base.paramLocks)
    expect(updated.params.grain.amount).toBe(0.42)
    expect(updated.params.palette).toEqual(base.params.palette)
    expect(updated.params.softness).toEqual(base.params.softness)
    expect(base.params.grain.amount).not.toBe(0.42)
  })

  it('setParam still updates a locked dial (locks constrain randomize only)', () => {
    const locked = setParamLock(createDocument('locked-tune'), 'softness', true)
    const updated = setParam(locked, 'softness', 'amount', 0.77)
    expect(updated.params.softness.amount).toBe(0.77)
    expect(updated.paramLocks.softness).toBe(true)
  })

  it('setLookFamilyMode changes mode only and leaves seed, params, lookFamily, and locks', () => {
    const base = setParamLock(createDocument('mode-only-seed'), 'palette', true)
    const updated = setLookFamilyMode(base, 'silk')
    expect(updated.lookFamilyMode).toBe('silk')
    expect(updated.seed).toBe(base.seed)
    expect(updated.lookFamily).toBe(base.lookFamily)
    expect(updated.params).toEqual(base.params)
    expect(updated.paramLocks).toEqual({ palette: true, softness: false, grain: false })
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

  it('setLookFamily changes lookFamily and keeps seed, params, and locks', () => {
    const base = setParamLock(
      setParam(setLookFamily(createDocument('family-switch-seed'), 'blob'), 'grain', 'amount', 0.37),
      'softness',
      true,
    )
    expect(base.lookFamilyMode).toBe('random')
    expect(base.lookFamily).toBe('blob')
    const next = setLookFamily(base, 'silk')
    expect(next.lookFamily).toBe('silk')
    expect(next.seed).toBe(base.seed)
    expect(next.params).toEqual(base.params)
    expect(next.lookFamilyMode).toBe('random')
    expect(next.paramLocks).toEqual({ palette: false, softness: true, grain: false })
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

  it('setParamLock toggles one flag only', () => {
    const base = createDocument('lock-toggle')
    const locked = setParamLock(base, 'palette', true)
    expect(locked.paramLocks).toEqual({ palette: true, softness: false, grain: false })
    expect(locked.seed).toBe(base.seed)
    expect(locked.params).toEqual(base.params)
    expect(locked.lookFamily).toBe(base.lookFamily)
    expect(locked.lookFamilyMode).toBe(base.lookFamilyMode)

    const unlocked = setParamLock(locked, 'palette', false)
    expect(unlocked.paramLocks).toEqual({ palette: false, softness: false, grain: false })
  })

  it('randomize with random mode matches createDocument for family and params', () => {
    const getRandomValues = stubCryptoBytes(0xab)
    const mathSpy = vi.spyOn(Math, 'random')
    const base = createDocument('before-randomize')
    expect(base.lookFamilyMode).toBe('random')
    const next = randomize(base)

    expect(getRandomValues).toHaveBeenCalled()
    expect(next.seed).not.toBe(base.seed)
    expect(next.seed).toMatch(/^[0-9a-f]+$/)
    expect(next.lookFamilyMode).toBe('random')
    expect(next.paramLocks).toEqual(base.paramLocks)
    const fresh = createDocument(next.seed)
    expect(next.lookFamily).toBe(fresh.lookFamily)
    expect(next.params).toEqual(fresh.params)
    expect(mathSpy).not.toHaveBeenCalled()

    getRandomValues.mockRestore()
    mathSpy.mockRestore()
  })

  it('randomize with fixed mode always yields that lookFamily and preserves mode', () => {
    const getRandomValues = stubCryptoBytes(0xcd)

    for (const mode of ['blob', 'flow', 'silk', 'bloom'] as const) {
      getRandomValues.mockClear()
      const base = setLookFamilyMode(createDocument('fixed-mode-base'), mode)
      const next = randomize(base)
      expect(next.lookFamily).toBe(mode)
      expect(next.lookFamilyMode).toBe(mode)
      expect(next.seed).not.toBe(base.seed)
    }

    getRandomValues.mockRestore()
  })

  it('setLookFamily bloom keeps seed and params', () => {
    const base = setParam(createDocument('bloom-switch-seed'), 'softness', 'amount', 0.41)
    const next = setLookFamily(base, 'bloom')
    expect(next.lookFamily).toBe('bloom')
    expect(next.seed).toBe(base.seed)
    expect(next.params).toEqual(base.params)
    expect(next.lookFamilyMode).toBe('random')
  })

  it('fixed-mode randomize params still match createDocument for the new seed', () => {
    const getRandomValues = stubCryptoBytes(0xef)

    const base = setLookFamilyMode(createDocument('consume-draw-base'), 'silk')
    const next = randomize(base)
    const fresh = createDocument(next.seed)
    expect(next.params).toEqual(fresh.params)
    expect(next.lookFamily).toBe('silk')
    expect(next.lookFamily).not.toBe(fresh.lookFamily)

    getRandomValues.mockRestore()
  })

  it('randomize with one lock preserves that dial and matches derived for unlocked', () => {
    const getRandomValues = stubCryptoBytes(0x11)
    const base = setParam(
      setParamLock(createDocument('one-lock-base'), 'grain', true),
      'grain',
      'amount',
      0.91,
    )
    const next = randomize(base)
    const fresh = createDocument(next.seed)

    expect(next.seed).not.toBe(base.seed)
    expect(next.paramLocks).toEqual({ palette: false, softness: false, grain: true })
    expect(next.params.grain.amount).toBe(0.91)
    expect(next.params.palette).toEqual(fresh.params.palette)
    expect(next.params.softness).toEqual(fresh.params.softness)
    expect(next.params.grain.amount).not.toBe(fresh.params.grain.amount)

    getRandomValues.mockRestore()
  })

  it('unlock then randomize lets the previously locked dial change', () => {
    const getRandomValues = stubCryptoBytes(0x22)
    const locked = setParam(
      setParamLock(createDocument('unlock-then'), 'palette', true),
      'palette',
      'energy',
      0.12,
    )
    const unlocked = setParamLock(locked, 'palette', false)
    const next = randomize(unlocked)
    const fresh = createDocument(next.seed)

    expect(next.params.palette.energy).toBe(fresh.params.palette.energy)
    expect(next.paramLocks.palette).toBe(false)

    getRandomValues.mockRestore()
  })

  it('all three locked with fixed mode keeps dial amounts and family across randomizes', () => {
    let fill = 0x30
    const getRandomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation(<T extends ArrayBufferView>(array: T): T => {
        const bytes = new Uint8Array(16).fill(fill)
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(
          bytes.subarray(0, array.byteLength),
        )
        return array
      })

    for (const mode of ['blob', 'flow', 'silk', 'bloom'] as const) {
      let doc = setLookFamilyMode(createDocument(`all-locked-${mode}`), mode)
      doc = setParam(doc, 'palette', 'energy', 0.15)
      doc = setParam(doc, 'softness', 'amount', 0.25)
      doc = setParam(doc, 'grain', 'amount', 0.35)
      doc = setParamLock(doc, 'palette', true)
      doc = setParamLock(doc, 'softness', true)
      doc = setParamLock(doc, 'grain', true)

      const seeds = new Set<string>()
      for (let i = 0; i < 3; i++) {
        fill = 0x40 + i
        doc = randomize(doc)
        seeds.add(doc.seed)
        expect(doc.lookFamily).toBe(mode)
        expect(doc.lookFamilyMode).toBe(mode)
        expect(doc.params.palette.energy).toBe(0.15)
        expect(doc.params.softness.amount).toBe(0.25)
        expect(doc.params.grain.amount).toBe(0.35)
        expect(doc.paramLocks).toEqual({
          palette: true,
          softness: true,
          grain: true,
        })
      }
      expect(seeds.size).toBe(3)
    }

    getRandomValues.mockRestore()
  })

  it('partial locks: unlocked keys equal derived, locked keys equal prior', () => {
    const getRandomValues = stubCryptoBytes(0x55)
    const base = setParam(
      setParam(
        setParamLock(setParamLock(createDocument('partial-locks'), 'palette', true), 'grain', true),
        'palette',
        'energy',
        0.44,
      ),
      'grain',
      'amount',
      0.66,
    )
    const next = randomize(base)
    const fresh = createDocument(next.seed)

    expect(next.params.palette.energy).toBe(0.44)
    expect(next.params.grain.amount).toBe(0.66)
    expect(next.params.softness).toEqual(fresh.params.softness)

    getRandomValues.mockRestore()
  })

  it('does not expose free-form field mutation helpers on the public API', async () => {
    const mod = await import('@/engine/document')
    expect(mod).not.toHaveProperty('setDocument')
    expect(mod).not.toHaveProperty('patchDocument')
    expect(mod).not.toHaveProperty('updateDocument')
    expect(mod).toHaveProperty('setLookFamilyMode')
    expect(mod).toHaveProperty('setLookFamily')
    expect(mod).toHaveProperty('setParamLock')
  })
})

describe('normalizeDocument', () => {
  it('defaults v1 documents to unlocked locks without re-deriving', () => {
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
    expect(normalized.schemaVersion).toBe(SCHEMA_VERSION)
    expect(normalized.lookFamily).toBe('blob')
    expect(normalized.lookFamilyMode).toBe('random')
    expect(normalized.paramLocks).toEqual({
      palette: false,
      softness: false,
      grain: false,
    })
    expect(normalized.params).toEqual(v1.params)
    expect(normalized.seed).toBe(v1.seed)
  })

  it('migrates v2 documents to schema 5 with mode random and unlocked locks', () => {
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
    expect(normalized.schemaVersion).toBe(SCHEMA_VERSION)
    expect(normalized.lookFamily).toBe('flow')
    expect(normalized.lookFamilyMode).toBe('random')
    expect(normalized.paramLocks).toEqual({
      palette: false,
      softness: false,
      grain: false,
    })
    expect(normalized.params).toEqual(v2.params)
    expect(normalized.seed).toBe(v2.seed)
  })

  it('migrates v3 documents to schema 5 with unlocked locks', () => {
    const v3: GradientDocumentV3 = {
      schemaVersion: 3,
      seed: 'v3-seed',
      lookFamily: 'silk',
      lookFamilyMode: 'blob',
      params: {
        palette: { energy: 0.7 },
        softness: { amount: 0.8 },
        grain: { amount: 0.9 },
      },
    }
    const normalized = normalizeDocument(v3)
    expect(normalized.schemaVersion).toBe(SCHEMA_VERSION)
    expect(normalized.lookFamily).toBe('silk')
    expect(normalized.lookFamilyMode).toBe('blob')
    expect(normalized.paramLocks).toEqual({
      palette: false,
      softness: false,
      grain: false,
    })
    expect(normalized.params).toEqual(v3.params)
    expect(normalized.seed).toBe(v3.seed)
  })

  it('migrates v4 documents to schema 5 without re-deriving lookFamily', () => {
    const v4: GradientDocumentV4 = {
      schemaVersion: 4,
      seed: 'v4-seed',
      lookFamily: 'silk',
      lookFamilyMode: 'random',
      paramLocks: { palette: true, softness: false, grain: false },
      params: {
        palette: { energy: 0.21 },
        softness: { amount: 0.32 },
        grain: { amount: 0.43 },
      },
    }
    const normalized = normalizeDocument(v4)
    expect(normalized.schemaVersion).toBe(SCHEMA_VERSION)
    expect(normalized.lookFamily).toBe('silk')
    expect(normalized.lookFamilyMode).toBe('random')
    expect(normalized.paramLocks).toEqual(v4.paramLocks)
    expect(normalized.params).toEqual(v4.params)
    expect(normalized.seed).toBe(v4.seed)
  })

  it('normalizeDocument accepts bloom when present', () => {
    const doc = setLookFamily(createDocument('normalize-bloom'), 'bloom')
    expect(normalizeDocument(doc)).toEqual(doc)
  })

  it('returns current-schema documents unchanged when fields are valid', () => {
    const doc = setParamLock(setLookFamilyMode(createDocument('v5-seed'), 'blob'), 'softness', true)
    expect(normalizeDocument(doc)).toEqual(doc)
  })
})

describe('generate-path Math.random ban', () => {
  it('createDocument / setSeed / setParam / setParamLock / mode / family / randomize never call Math.random', () => {
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
    doc = setParamLock(doc, 'grain', true)
    doc = setLookFamilyMode(doc, 'flow')
    doc = setLookFamily(doc, 'silk')
    doc = setLookFamilyMode(doc, 'bloom')
    doc = setLookFamily(doc, 'bloom')
    doc = randomize(doc)

    expect(doc.schemaVersion).toBe(SCHEMA_VERSION)
    expect(spy).not.toHaveBeenCalled()

    spy.mockRestore()
    getRandomValues.mockRestore()
  })
})
