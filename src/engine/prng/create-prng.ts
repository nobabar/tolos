/** cyrb53 - compact string → uint32 hash. */
export function hashSeedToUint32(seed: string): number {
  let h1 = 0xdeadbeef ^ seed.length
  let h2 = 0x41c6ce57 ^ seed.length
  for (let i = 0; i < seed.length; i += 1) {
    const ch = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return h2 >>> 0
}

export type Prng = {
  nextUint32: () => number
  nextFloat01: () => number
}

/** mulberry32 - tiny sync PRNG seeded from a uint32; yields unsigned 32-bit ints. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return (): number => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return (r ^ (r >>> 14)) >>> 0
  }
}

export function createPrng(seed: string): Prng {
  const next = mulberry32(hashSeedToUint32(seed))
  return {
    nextUint32: (): number => next(),
    nextFloat01: (): number => next() / 4294967296,
  }
}
