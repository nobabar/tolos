import { describe, expect, it, vi } from 'vitest'

import {
  createDocument,
  isValidSeed,
  normalizeDocument,
  randomize,
  setParam,
  setSeed,
  type GradientDocument,
  type GradientDocumentV1,
} from '@/engine/document'

describe('GradientDocument', () => {
  it('creates a schemaVersion 2 document with lookFamily and param families', () => {
    const doc = createDocument('fixed-seed-for-create')
    expect(doc.schemaVersion).toBe(2)
    expect(doc.seed).toBe('fixed-seed-for-create')
    expect(['blob', 'flow', 'silk']).toContain(doc.lookFamily)
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
  it('setSeed replaces seed and keeps prior params and lookFamily', () => {
    const base = createDocument('original')
    const tuned = setParam(base, 'grain', 'amount', 0.42)
    const updated = setSeed(tuned, 'restored-seed')
    expect(updated.seed).toBe('restored-seed')
    expect(updated.lookFamily).toBe(tuned.lookFamily)
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

  it('setParam updates one param without changing seed or lookFamily', () => {
    const base = createDocument('param-seed')
    const updated = setParam(base, 'grain', 'amount', 0.42)
    expect(updated.seed).toBe(base.seed)
    expect(updated.lookFamily).toBe(base.lookFamily)
    expect(updated.params.grain.amount).toBe(0.42)
    expect(updated.params.palette).toEqual(base.params.palette)
    expect(updated.params.softness).toEqual(base.params.softness)
    expect(base.params.grain.amount).not.toBe(0.42)
  })

  it('randomize assigns a new crypto seed then derives lookFamily and params from that seed only', () => {
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
    const next = randomize(base)

    expect(getRandomValues).toHaveBeenCalled()
    expect(next.seed).not.toBe(base.seed)
    expect(next.seed).toMatch(/^[0-9a-f]+$/)
    const fresh = createDocument(next.seed)
    expect(next.lookFamily).toBe(fresh.lookFamily)
    expect(next.params).toEqual(fresh.params)
    expect(mathSpy).not.toHaveBeenCalled()

    getRandomValues.mockRestore()
    mathSpy.mockRestore()
  })

  it('does not expose free-form field mutation helpers on the public API', async () => {
    const mod = await import('@/engine/document')
    expect(mod).not.toHaveProperty('setDocument')
    expect(mod).not.toHaveProperty('patchDocument')
    expect(mod).not.toHaveProperty('updateDocument')
  })
})

describe('normalizeDocument', () => {
  it('defaults v1 documents to lookFamily blob without re-deriving params', () => {
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
    expect(normalized.schemaVersion).toBe(2)
    expect(normalized.lookFamily).toBe('blob')
    expect(normalized.params).toEqual(v1.params)
    expect(normalized.seed).toBe(v1.seed)
  })

  it('returns v2 documents unchanged when lookFamily is valid', () => {
    const doc = createDocument('v2-seed')
    expect(normalizeDocument(doc)).toEqual(doc)
  })
})

describe('generate-path Math.random ban', () => {
  it('createDocument / setSeed / setParam / randomize never call Math.random', () => {
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
    doc = randomize(doc)

    expect(doc.schemaVersion).toBe(2)
    expect(spy).not.toHaveBeenCalled()

    spy.mockRestore()
    getRandomValues.mockRestore()
  })
})
