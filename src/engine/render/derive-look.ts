import { createPrng, hashSeedToUint32 } from '../prng'
import type { GradientDocument } from '../document'

export const ANCHOR_COUNT = 5 as const

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

export function deriveLookFromDocument(doc: GradientDocument): DerivedLook {
  const prng = createPrng(`look:${doc.seed}`)
  const energy = doc.params.palette.energy
  const anchors: ColorAnchor[] = []

  const baseHue = prng.nextFloat01()
  const hueOffsets = [0, 0.08, 0.42, 0.55, 0.78]

  for (let i = 0; i < ANCHOR_COUNT; i += 1) {
    const x = 0.08 + prng.nextFloat01() * 0.84
    const y = 0.08 + prng.nextFloat01() * 0.84
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
