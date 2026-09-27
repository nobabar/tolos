import { createPrng } from '../prng'
import type { GradientParams } from './types'

/**
 * Fixed PRNG draw order for seed → params.
 *
 * Order:
 *   1. palette.energy
 *   2. softness.amount
 *   3. grain.amount
 */
export function deriveParamsFromSeed(seed: string): GradientParams {
  const prng = createPrng(seed)
  return {
    palette: { energy: prng.nextFloat01() },
    softness: { amount: prng.nextFloat01() },
    grain: { amount: prng.nextFloat01() },
  }
}
