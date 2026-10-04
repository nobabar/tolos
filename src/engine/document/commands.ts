import { deriveFromSeed } from './derive-params'
import {
  LOOK_FAMILIES,
  SCHEMA_VERSION,
  type GradientDocument,
  type GradientDocumentV1,
  type GradientDocumentV2,
  type GradientDocumentV3,
  type GradientDocumentV4,
  type GrainParams,
  type LookFamily,
  type LookFamilyMode,
  type PaletteParams,
  type ParamLocks,
  type SoftnessParams,
} from './types'

export type ParamFamily = 'palette' | 'softness' | 'grain'

type FamilyKeyMap = {
  palette: keyof PaletteParams
  softness: keyof SoftnessParams
  grain: keyof GrainParams
}

const UNLOCKED: ParamLocks = {
  palette: false,
  softness: false,
  grain: false,
}

function isLookFamily(value: unknown): value is LookFamily {
  return typeof value === 'string' && (LOOK_FAMILIES as readonly string[]).includes(value)
}

function isLookFamilyMode(value: unknown): value is LookFamilyMode {
  return value === 'random' || isLookFamily(value)
}

function isParamLocks(value: unknown): value is ParamLocks {
  if (typeof value !== 'object' || value === null) return false
  const locks = value as Record<string, unknown>
  return (
    typeof locks.palette === 'boolean' &&
    typeof locks.softness === 'boolean' &&
    typeof locks.grain === 'boolean'
  )
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
    paramLocks: { ...UNLOCKED },
    params: derived.params,
  }
}

/**
 * New crypto seed -> derive lookFamily + params from prng(newSeed).
 * Fixed lookFamilyMode pins assigned family after the family PRNG draw.
 * Locked dials keep prior amounts after the full derive stream is consumed.
 */
export function randomize(doc: GradientDocument): GradientDocument {
  const seed = createOpaqueSeed()
  const derived = deriveFromSeed(seed)
  const lookFamily = doc.lookFamilyMode === 'random' ? derived.lookFamily : doc.lookFamilyMode
  return {
    schemaVersion: SCHEMA_VERSION,
    seed,
    lookFamily,
    lookFamilyMode: doc.lookFamilyMode,
    paramLocks: doc.paramLocks,
    params: {
      palette: {
        energy: doc.paramLocks.palette ? doc.params.palette.energy : derived.params.palette.energy,
      },
      softness: {
        amount: doc.paramLocks.softness
          ? doc.params.softness.amount
          : derived.params.softness.amount,
      },
      grain: {
        amount: doc.paramLocks.grain ? doc.params.grain.amount : derived.params.grain.amount,
      },
    },
  }
}

/** Replace seed only. Params, lookFamily, mode, and locks stay as-is. */
export function setSeed(doc: GradientDocument, seed: string): GradientDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    seed,
    lookFamily: doc.lookFamily,
    lookFamilyMode: doc.lookFamilyMode,
    paramLocks: doc.paramLocks,
    params: doc.params,
  }
}

/** Store discovery mode only. Seed, params, lookFamily, and locks stay as-is. */
export function setLookFamilyMode(doc: GradientDocument, mode: LookFamilyMode): GradientDocument {
  if (!isLookFamilyMode(mode)) {
    return {
      schemaVersion: SCHEMA_VERSION,
      seed: doc.seed,
      lookFamily: doc.lookFamily,
      lookFamilyMode: doc.lookFamilyMode,
      paramLocks: doc.paramLocks,
      params: doc.params,
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    seed: doc.seed,
    lookFamily: doc.lookFamily,
    lookFamilyMode: mode,
    paramLocks: doc.paramLocks,
    params: doc.params,
  }
}

/**
 * Switch active lookFamily without a new seed.
 * Fixed mode aligns to the family; random mode stays random.
 */
export function setLookFamily(doc: GradientDocument, family: LookFamily): GradientDocument {
  if (!isLookFamily(family)) {
    return {
      schemaVersion: SCHEMA_VERSION,
      seed: doc.seed,
      lookFamily: doc.lookFamily,
      lookFamilyMode: doc.lookFamilyMode,
      paramLocks: doc.paramLocks,
      params: doc.params,
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    seed: doc.seed,
    lookFamily: family,
    lookFamilyMode: doc.lookFamilyMode === 'random' ? 'random' : family,
    paramLocks: doc.paramLocks,
    params: doc.params,
  }
}

/** Toggle one dial lock. Seed, params, lookFamily, and mode stay as-is. */
export function setParamLock(
  doc: GradientDocument,
  family: ParamFamily,
  locked: boolean,
): GradientDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    seed: doc.seed,
    lookFamily: doc.lookFamily,
    lookFamilyMode: doc.lookFamilyMode,
    paramLocks: {
      ...doc.paramLocks,
      [family]: locked,
    },
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
    paramLocks: doc.paramLocks,
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
  doc:
    | GradientDocument
    | GradientDocumentV1
    | GradientDocumentV2
    | GradientDocumentV3
    | GradientDocumentV4,
): GradientDocument {
  if (doc.schemaVersion === 1) {
    return {
      schemaVersion: SCHEMA_VERSION,
      seed: doc.seed,
      lookFamily: 'blob',
      lookFamilyMode: 'random',
      paramLocks: { ...UNLOCKED },
      params: doc.params,
    }
  }

  const lookFamily = isLookFamily(doc.lookFamily) ? doc.lookFamily : 'blob'
  const lookFamilyMode =
    'lookFamilyMode' in doc && isLookFamilyMode(doc.lookFamilyMode) ? doc.lookFamilyMode : 'random'
  const paramLocks =
    'paramLocks' in doc && isParamLocks(doc.paramLocks) ? doc.paramLocks : { ...UNLOCKED }

  if (
    doc.schemaVersion === SCHEMA_VERSION &&
    isLookFamily(doc.lookFamily) &&
    'lookFamilyMode' in doc &&
    isLookFamilyMode(doc.lookFamilyMode) &&
    'paramLocks' in doc &&
    isParamLocks(doc.paramLocks)
  ) {
    return doc
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    seed: doc.seed,
    lookFamily,
    lookFamilyMode,
    paramLocks,
    params: doc.params,
  }
}
