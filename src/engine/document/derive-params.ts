import { createPrng } from '../prng'
import { LOOK_FAMILIES, type GradientParams, type LookFamily } from './types'

export type DerivedDocumentFields = {
  lookFamily: LookFamily
  params: GradientParams
}

/**
 * Fixed PRNG draw order for seed -> document fields.
 *
 * Order:
 *   1. lookFamily (index into LOOK_FAMILIES; equal weight, domain = length)
 *   2. palette.energy
 *   3. softness.amount
 *   4. grain.amount
 */
export function deriveFromSeed(seed: string): DerivedDocumentFields {
  const prng = createPrng(seed)
  const familyCount = LOOK_FAMILIES.length
  const familyIndex = Math.min(familyCount - 1, Math.floor(prng.nextFloat01() * familyCount))
  const lookFamily = LOOK_FAMILIES[familyIndex]!
  return {
    lookFamily,
    params: {
      palette: { energy: prng.nextFloat01() },
      softness: { amount: prng.nextFloat01() },
      grain: { amount: prng.nextFloat01() },
    },
  }
}

/** Params only; uses the same draw order as deriveFromSeed (lookFamily draw runs first). */
export function deriveParamsFromSeed(seed: string): GradientParams {
  return deriveFromSeed(seed).params
}
