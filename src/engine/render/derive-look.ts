import { createPrng, hashSeedToUint32 } from '../prng'
import type { GradientDocument } from '../document'

/** Shader / uniform slot capacity. Active blob anchors are 4-6. */
export const MAX_ANCHORS = 6 as const

/** Alias for MAX_ANCHORS (uniform buffer length). */
export const ANCHOR_COUNT = MAX_ANCHORS

export type ColorAnchor = {
  x: number
  y: number
  radius: number
  rgb: [number, number, number]
}

export type LookUniforms = {
  softness: number
  grain: number
  energy: number
  seedHash: number
}

export type DerivedLook = {
  anchors: ColorAnchor[]
  uniforms: LookUniforms
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 1) + 1) % 1
  const sat = Math.min(1, Math.max(0, s))
  const lit = Math.min(1, Math.max(0, l))
  if (sat === 0) return [lit, lit, lit]

  const q = lit < 0.5 ? lit * (1 + sat) : lit + sat - lit * sat
  const p = 2 * lit - q
  const hk = (t: number): number => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [hk(hue + 1 / 3), hk(hue), hk(hue - 1 / 3)]
}

/**
 * Blob composition from stream `look:${seed}`. Draw order:
 * 1. baseHue
 * 2. anchorCount -> integer in [4, 6]
 * 3. biasAxis -> 0 = horizontal off-center, 1 = vertical third
 * 4. biasThird -> 0..2 (left/center/right or top/mid/bottom)
 * 5. biasStrength
 * 6. per active anchor: x, y, pullMix, radius, hueJitter, satNoise, litNoise
 * Inactive slots are omitted from `anchors` (paint zeros remaining uniform slots).
 */
function deriveBlobLook(doc: GradientDocument): DerivedLook {
  const prng = createPrng(`look:${doc.seed}`)
  const energy = doc.params.palette.energy

  const baseHue = prng.nextFloat01()
  const anchorCount = 4 + Math.floor(prng.nextFloat01() * 3)
  const biasAxis = prng.nextFloat01() < 0.5 ? 0 : 1
  const biasThird = Math.floor(prng.nextFloat01() * 3)
  const biasStrength = 0.35 + prng.nextFloat01() * 0.4
  const biasCenter = (biasThird + 0.5) / 3

  const hueOffsets = [0, 0.08, 0.42, 0.55, 0.78, 0.22]
  const anchors: ColorAnchor[] = []

  for (let i = 0; i < anchorCount; i += 1) {
    let x = 0.08 + prng.nextFloat01() * 0.84
    let y = 0.08 + prng.nextFloat01() * 0.84
    const pull = biasStrength * (0.45 + prng.nextFloat01() * 0.55)
    if (biasAxis === 0) {
      x = x + (biasCenter - x) * pull
    } else {
      y = y + (biasCenter - y) * pull
    }

    const radius = 0.38 + prng.nextFloat01() * 0.55
    const hueJitter = (prng.nextFloat01() - 0.5) * 0.06
    const hue = baseHue + (hueOffsets[i] ?? 0) + hueJitter
    const sat = 0.55 + energy * 0.4 + prng.nextFloat01() * 0.12
    const lit = 0.32 + prng.nextFloat01() * 0.42 + energy * 0.1
    anchors.push({
      x,
      y,
      radius,
      rgb: hslToRgb(hue, Math.min(1, sat), Math.min(0.82, lit)),
    })
  }

  return {
    anchors,
    uniforms: {
      softness: doc.params.softness.amount,
      grain: doc.params.grain.amount,
      energy,
      seedHash: hashSeedToUint32(doc.seed) / 4294967296,
    },
  }
}

export function deriveLookFromDocument(doc: GradientDocument): DerivedLook {
  switch (doc.lookFamily) {
    case 'blob':
      return deriveBlobLook(doc)
    case 'flow':
    case 'silk':
      // Temporary: blob composition until family shaders land.
      return deriveBlobLook(doc)
  }
}
