import { describe, expect, it, vi } from 'vitest'

import {
  createDocument,
  isValidSeed,
  randomize,
  setParam,
  setSeed,
  type GradientDocument,
} from '@/engine/document'

describe('GradientDocument', () => {
  it('creates a schemaVersion 1 document with palette, softness, and grain families', () => {
    const doc = createDocument('fixed-seed-for-create')
    expect(doc.schemaVersion).toBe(1)
    expect(doc.seed).toBe('fixed-seed-for-create')
    expect(doc.params.palette).toBeDefined()
    expect(doc.params.softness).toBeDefined()
    expect(doc.params.grain).toBeDefined()
    expect(typeof doc.params.palette.energy).toBe('number')
    expect(typeof doc.params.softness.amount).toBe('number')
    expect(typeof doc.params.grain.amount).toBe('number')
  })

  it('derives identical params for the same seed across two create paths', () => {
    const a = createDocument('same-seed-params')
    const b = createDocument('same-seed-params')
    expect(a.params).toEqual(b.params)
  })
})

describe('document commands', () => {
  it('setSeed replaces seed and keeps prior params', () => {
    const base = createDocument('original')
    const tuned = setParam(base, 'grain', 'amount', 0.42)
    const updated = setSeed(tuned, 'restored-seed')
    expect(updated.seed).toBe('restored-seed')
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

  it('setParam updates one param without changing seed', () => {
    const base = createDocument('param-seed')
    const updated = setParam(base, 'grain', 'amount', 0.42)
    expect(updated.seed).toBe(base.seed)
    expect(updated.params.grain.amount).toBe(0.42)
    expect(updated.params.palette).toEqual(base.params.palette)
    expect(updated.params.softness).toEqual(base.params.softness)
    expect(base.params.grain.amount).not.toBe(0.42)
  })

  it('randomize assigns a new crypto seed then derives params from that seed only', () => {
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
    expect(next.params).toEqual(createDocument(next.seed).params)
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

    expect(doc.schemaVersion).toBe(1)
    expect(spy).not.toHaveBeenCalled()

    spy.mockRestore()
    getRandomValues.mockRestore()
  })
})
