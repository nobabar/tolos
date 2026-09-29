import { deriveFromSeed } from './derive-params'
import {
  SCHEMA_VERSION,
  type GradientDocument,
  type GradientDocumentV1,
  type GrainParams,
  type LookFamily,
  type PaletteParams,
  type SoftnessParams,
} from './types'

export type ParamFamily = 'palette' | 'softness' | 'grain'

type FamilyKeyMap = {
  palette: keyof PaletteParams
  softness: keyof SoftnessParams
  grain: keyof GrainParams
}

function isLookFamily(value: unknown): value is LookFamily {
  return value === 'blob' || value === 'flow' || value === 'silk'
}

/** Encode entropy bytes as an opaque hex seed. */
export function createOpaqueSeed(randomSource: Crypto = globalThis.crypto): string {
  const bytes = new Uint8Array(16)
  randomSource.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function createDocument(seed: string): GradientDocument {
  const derived = deriveFromSeed(seed)
  return {
    schemaVersion: SCHEMA_VERSION,
    seed,
    lookFamily: derived.lookFamily,
    params: derived.params,
  }
}

/** New crypto seed -> derive lookFamily + params from prng(newSeed). */
export function randomize(doc: GradientDocument): GradientDocument {
  const seed = createOpaqueSeed()
  const derived = deriveFromSeed(seed)
  return {
    schemaVersion: doc.schemaVersion,
    seed,
    lookFamily: derived.lookFamily,
    params: derived.params,
  }
}

/** Replace seed only. Params and lookFamily stay as-is. */
export function setSeed(doc: GradientDocument, seed: string): GradientDocument {
  return {
    schemaVersion: doc.schemaVersion,
    seed,
    lookFamily: doc.lookFamily,
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
    lookFamily: doc.lookFamily,
    params: {
      ...doc.params,
      [family]: {
        ...doc.params[family],
        [key]: value,
      },
    },
  }
}

export function normalizeDocument(doc: GradientDocument | GradientDocumentV1): GradientDocument {
  if (doc.schemaVersion === 1) {
    return {
      schemaVersion: SCHEMA_VERSION,
      seed: doc.seed,
      lookFamily: 'blob',
      params: doc.params,
    }
  }
  if (isLookFamily(doc.lookFamily)) {
    return doc
  }
  return {
    ...doc,
    lookFamily: 'blob',
  }
}
