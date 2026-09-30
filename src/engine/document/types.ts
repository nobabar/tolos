export const SCHEMA_VERSION = 4 as const

export type LookFamily = 'blob' | 'flow' | 'silk'

export const LOOK_FAMILIES: readonly LookFamily[] = ['blob', 'flow', 'silk']

export type LookFamilyMode = 'random' | LookFamily

export type PaletteParams = {
  energy: number
}

export type SoftnessParams = {
  amount: number
}

export type GrainParams = {
  amount: number
}

export type GradientParams = {
  palette: PaletteParams
  softness: SoftnessParams
  grain: GrainParams
}

export type ParamLocks = {
  palette: boolean
  softness: boolean
  grain: boolean
}

export type GradientDocument = {
  schemaVersion: typeof SCHEMA_VERSION
  seed: string
  lookFamily: LookFamily
  lookFamilyMode: LookFamilyMode
  paramLocks: ParamLocks
  params: GradientParams
}

export type GradientDocumentV1 = {
  schemaVersion: 1
  seed: string
  params: GradientParams
}

/** Schema 2: lookFamily present, no lookFamilyMode. */
export type GradientDocumentV2 = {
  schemaVersion: 2
  seed: string
  lookFamily: LookFamily
  params: GradientParams
}

/** Schema 3: lookFamilyMode present, no paramLocks. */
export type GradientDocumentV3 = {
  schemaVersion: 3
  seed: string
  lookFamily: LookFamily
  lookFamilyMode: LookFamilyMode
  params: GradientParams
}
