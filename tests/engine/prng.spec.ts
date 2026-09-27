import { describe, expect, it, vi } from 'vitest'

import { createPrng, hashSeedToUint32 } from '@/engine/prng'

describe('hashSeedToUint32', () => {
  it('returns a stable unsigned 32-bit integer for the same seed', () => {
    const a = hashSeedToUint32('tolos-seed-alpha')
    const b = hashSeedToUint32('tolos-seed-alpha')
    expect(a).toBe(b)
    expect(Number.isInteger(a)).toBe(true)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThanOrEqual(0xffffffff)
  })

  it('diverges for different seeds', () => {
    expect(hashSeedToUint32('seed-a')).not.toBe(hashSeedToUint32('seed-b'))
  })
})

describe('createPrng', () => {
  it('produces identical uint32 and float sequences for the same seed', () => {
    const run = (): { uints: number[]; floats: number[] } => {
      const prng = createPrng('deterministic-portfolio-seed')
      const uints = Array.from({ length: 8 }, () => prng.nextUint32())
      const floats = Array.from({ length: 8 }, () => prng.nextFloat01())
      return { uints, floats }
    }

    const first = run()
    const second = run()
    expect(first.uints).toEqual(second.uints)
    expect(first.floats).toEqual(second.floats)
  })

  it('keeps nextFloat01 in [0, 1)', () => {
    const prng = createPrng('float-range-seed')
    for (let i = 0; i < 64; i += 1) {
      const value = prng.nextFloat01()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('does not call Math.random on the generate path', () => {
    const spy = vi.spyOn(Math, 'random')
    const prng = createPrng('no-math-random')
    for (let i = 0; i < 32; i += 1) {
      prng.nextUint32()
      prng.nextFloat01()
    }
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
