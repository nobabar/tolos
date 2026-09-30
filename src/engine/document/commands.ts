import { deriveFromSeed } from './derive-params'
import {
  SCHEMA_VERSION,
  type GradientDocument,
  type GradientDocumentV1,
  type GradientDocumentV2,
  type GrainParams,
  type LookFamily,
  type LookFamilyMode,
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

function isLookFamilyMode(value: unknown): value is LookFamilyMode {
  return value === 'random' || isLookFamily(value)
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
    lookFamilyMode: 'random',
    params: derived.params,
  }
}

/**
 * New crypto seed -> derive lookFamily + params from prng(newSeed).
 * Fixed lookFamilyMode pins assigned family after the family PRNG draw.
 */
export function randomize(doc: GradientDocument): GradientDocument {
  const seed = createOpaqueSeed()
  const derived = deriveFromSeed(seed)
  const lookFamily =
    doc.lookFamilyMode === 'random' ? derived.lookFamily : doc.lookFamilyMode
  return {
    schemaVersion: SCHEMA_VERSION,
    seed,
    lookFamily,
    lookFamilyMode: doc.lookFamilyMode,
    params: derived.params,
  }
}

/** Replace seed only. Params, lookFamily, and lookFamilyMode stay as-is. */
export function setSeed(doc: GradientDocument, seed: string): GradientDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    seed,
    lookFamily: doc.lookFamily,
    lookFamilyMode: doc.lookFamilyMode,
    params: doc.params,
  }
}

/** Store discovery mode only. Seed, params, and lookFamily stay as-is. */
export function setLookFamilyMode(
  doc: GradientDocument,
  mode: LookFamilyMode,
): GradientDocument {
  if (!isLookFamilyMode(mode)) {
    return {
      schemaVersion: SCHEMA_VERSION,
      seed: doc.seed,
      lookFamily: doc.lookFamily,
      lookFamilyMode: doc.lookFamilyMode,
      params: doc.params,
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    seed: doc.seed,
    lookFamily: doc.lookFamily,
    lookFamilyMode: mode,
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
    schemaVersion: SCHEMA_VERSION,
    seed: doc.seed,
    lookFamily: doc.lookFamily,
    lookFamilyMode: doc.lookFamilyMode,
    params: {
      ...doc.params,
      [family]: {
        ...doc.params[family],
        [key]: value,
      },
    },
  }
}

export function normalizeDocument(
  doc: GradientDocument | GradientDocumentV1 | GradientDocumentV2,
): GradientDocument {
  if (doc.schemaVersion === 1) {
    return {
      schemaVersion: SCHEMA_VERSION,
      seed: doc.seed,
      lookFamily: 'blob',
      lookFamilyMode: 'random',
      params: doc.params,
    }
  }

  const lookFamily = isLookFamily(doc.lookFamily) ? doc.lookFamily : 'blob'
  const lookFamilyMode =
    'lookFamilyMode' in doc && isLookFamilyMode(doc.lookFamilyMode)
      ? doc.lookFamilyMode
      : 'random'

  if (
    doc.schemaVersion === SCHEMA_VERSION &&
    isLookFamily(doc.lookFamily) &&
    'lookFamilyMode' in doc &&
    isLookFamilyMode(doc.lookFamilyMode)
  ) {
    return doc
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    seed: doc.seed,
    lookFamily,
    lookFamilyMode,
    params: doc.params,
  }
}
