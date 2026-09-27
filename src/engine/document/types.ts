export const SCHEMA_VERSION = 1 as const

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
  params: GradientParams
}
