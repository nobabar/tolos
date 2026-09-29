export const SCHEMA_VERSION = 2 as const

export type LookFamily = 'blob' | 'flow' | 'silk'

export const LOOK_FAMILIES: readonly LookFamily[] = ['blob', 'flow', 'silk']

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

export type GradientDocument = {
  schemaVersion: typeof SCHEMA_VERSION
  seed: string
  lookFamily: LookFamily
  params: GradientParams
}

export type GradientDocumentV1 = {
  schemaVersion: 1
  seed: string
  params: GradientParams
}
