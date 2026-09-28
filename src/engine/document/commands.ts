import { deriveParamsFromSeed } from './derive-params'
import {
  SCHEMA_VERSION,
  type GradientDocument,
  type GrainParams,
  type PaletteParams,
  type SoftnessParams,
} from './types'

export type ParamFamily = 'palette' | 'softness' | 'grain'

type FamilyKeyMap = {
  palette: keyof PaletteParams
  softness: keyof SoftnessParams
  grain: keyof GrainParams
}

/** Encode entropy bytes as an opaque hex seed. */
export function createOpaqueSeed(randomSource: Crypto = globalThis.crypto): string {
  const bytes = new Uint8Array(16)
  randomSource.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function createDocument(seed: string): GradientDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    seed,
    params: deriveParamsFromSeed(seed),
  }
}

/** New crypto seed - derive all look fields from prng(newSeed). */
export function randomize(doc: GradientDocument): GradientDocument {
  const seed = createOpaqueSeed()
  return {
    schemaVersion: doc.schemaVersion,
    seed,
    params: deriveParamsFromSeed(seed),
  }
}

/** Replace seed only. Params stay as-is. */
export function setSeed(doc: GradientDocument, seed: string): GradientDocument {
  return {
    schemaVersion: doc.schemaVersion,
    seed,
    params: doc.params,
  }
}

/** Non-empty after trim. Engine hashes any opaque seed string. */
export function isValidSeed(seed: string): boolean {
  return seed.trim().length > 0
}

export function setParam<F extends ParamFamily>(
  doc: GradientDocument,
  family: F,
  key: FamilyKeyMap[F],
  value: number,
): GradientDocument {
  return {
    schemaVersion: doc.schemaVersion,
    seed: doc.seed,
    params: {
      ...doc.params,
      [family]: {
        ...doc.params[family],
        [key]: value,
      },
    },
  }
}
