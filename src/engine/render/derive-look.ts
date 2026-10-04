import { createPrng, hashSeedToUint32 } from '../prng'
import type { GradientDocument } from '../document'

/** Shader / uniform slot capacity. Active blob anchors are 4-6. */
export const MAX_ANCHORS = 6 as const

/** Alias for MAX_ANCHORS (uniform buffer length). */
export const ANCHOR_COUNT = MAX_ANCHORS

/** Flow palette stops uploaded to the shader (active count is 3-5). */
export const MAX_FLOW_STOPS = 5 as const

/** Silk always mixes three RGB stops. */
export const SILK_COLOR_COUNT = 3 as const

/** Shader iteration cap (main-thread full-screen). Seeded count is 4-8. */
export const SILK_MAX_ITERATIONS = 8 as const

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

export type FlowUniforms = {
  softness: number
  grain: number
  energy: number
  seedHash: number
  swirlStrength: number
  fieldScale: number
  phase: [number, number]
}

export type DerivedFlowLook = {
  stops: [number, number, number][]
  uniforms: FlowUniforms
}

export type SilkUniforms = {
  softness: number
  grain: number
  energy: number
  seedHash: number
  foldAngle: number
  foldFreq: number
  sheenStrength: number
  iterations: number
}

export type DerivedSilkLook = {
  colors: [[number, number, number], [number, number, number], [number, number, number]]
  uniforms: SilkUniforms
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
 * 2. anchorCount -> integer in [3, 4]
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
  const anchorCount = 3 + Math.floor(prng.nextFloat01() * 2)
  const biasAxis = prng.nextFloat01() < 0.5 ? 0 : 1
  const biasThird = Math.floor(prng.nextFloat01() * 3)
  const biasStrength = 0.18 + prng.nextFloat01() * 0.28
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

    const radius = 0.58 + prng.nextFloat01() * 0.4
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

/**
 * Flow field + palette from stream `look:${seed}`. Draw order:
 * 1. baseHue
 * 2. stopCount -> integer in [3, 5]
 * 3. swirlStrength
 * 4. fieldScale
 * 5. phaseX, phaseY
 * 6. per active stop: hueJitter, satNoise, litNoise
 */
export function deriveFlowLook(doc: GradientDocument): DerivedFlowLook {
  const prng = createPrng(`look:${doc.seed}`)
  const energy = doc.params.palette.energy

  const baseHue = prng.nextFloat01()
  const stopCount = 3 + Math.floor(prng.nextFloat01() * 3)
  // Slightly stronger swirl / field so nested warp reads on more seeds.
  const swirlStrength = 0.28 + prng.nextFloat01() * 0.55
  const fieldScale = 1.55 + prng.nextFloat01() * 2.35
  const phase: [number, number] = [
    prng.nextFloat01() * Math.PI * 2,
    prng.nextFloat01() * Math.PI * 2,
  ]

  const hueSpans = [0, 0.14, 0.38, 0.62, 0.86]
  const stops: [number, number, number][] = []
  for (let i = 0; i < stopCount; i += 1) {
    const hueJitter = (prng.nextFloat01() - 0.5) * 0.08
    // Sky-leaning stops: lower sat, higher lit so energy does not push neon.
    const sat = 0.32 + energy * 0.28 + prng.nextFloat01() * 0.12
    const lit = 0.36 + prng.nextFloat01() * 0.4 + energy * 0.06
    const hue = baseHue + (hueSpans[i] ?? 0) + hueJitter
    stops.push(hslToRgb(hue, Math.min(0.78, sat), Math.min(0.88, lit)))
  }

  return {
    stops,
    uniforms: {
      softness: doc.params.softness.amount,
      grain: doc.params.grain.amount,
      energy,
      seedHash: hashSeedToUint32(doc.seed) / 4294967296,
      swirlStrength,
      fieldScale,
      phase,
    },
  }
}

/**
 * Silk folds + tri-color from stream `look:${seed}`. Draw order:
 * 1. baseHue
 * 2. foldAngle
 * 3. foldFreq
 * 4. sheenStrength
 * 5. iterations -> integer in [4, 8]
 * 6. per color (3): hueJitter, satNoise, litNoise
 */
export function deriveSilkLook(doc: GradientDocument): DerivedSilkLook {
  const prng = createPrng(`look:${doc.seed}`)
  const energy = doc.params.palette.energy

  const baseHue = prng.nextFloat01()
  const foldAngle = prng.nextFloat01() * Math.PI * 2
  // Multi-fold draped volume: enough cycles to cross the frame, not one ribbon.
  const foldFreq = 4.5 + prng.nextFloat01() * 6.0
  const sheenStrength = 0.48 + prng.nextFloat01() * 0.47
  const iterations = 4 + Math.floor(prng.nextFloat01() * (SILK_MAX_ITERATIONS - 3))

  // Wider hue span helps iridescent wrap without neon sat.
  const hueSpans = [0, 0.22, 0.48]
  const colors: [[number, number, number], [number, number, number], [number, number, number]] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let i = 0; i < SILK_COLOR_COUNT; i += 1) {
    const hueJitter = (prng.nextFloat01() - 0.5) * 0.07
    // Pastel-leaning stops so color-wrap reads iridescent, not stripe neon.
    const sat = 0.28 + energy * 0.32 + prng.nextFloat01() * 0.14
    const lit = 0.4 + prng.nextFloat01() * 0.38 + energy * 0.06
    const hue = baseHue + (hueSpans[i] ?? 0) + hueJitter
    colors[i] = hslToRgb(hue, Math.min(1, sat), Math.min(0.92, lit))
  }

  return {
    colors,
    uniforms: {
      softness: doc.params.softness.amount,
      grain: doc.params.grain.amount,
      energy,
      seedHash: hashSeedToUint32(doc.seed) / 4294967296,
      foldAngle,
      foldFreq,
      sheenStrength,
      iterations,
    },
  }
}

export function deriveLookFromDocument(doc: GradientDocument): DerivedLook {
  switch (doc.lookFamily) {
    case 'blob':
      return deriveBlobLook(doc)
    case 'flow':
      // Flow paint uses deriveFlowLook.
      return deriveBlobLook(doc)
    case 'silk':
      // Silk paint uses deriveSilkLook.
      return deriveBlobLook(doc)
    case 'bloom':
      // Temporary: blob look data for fallback paint.
      return deriveBlobLook(doc)
  }
}
