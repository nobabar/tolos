import type { GradientDocument } from '../document'
import {
  deriveBloomLook,
  deriveFlowLook,
  deriveLookFromDocument,
  deriveSilkLook,
} from './derive-look'
import {
  paintBlobSketch,
  paintBloomSketch,
  paintDocument,
  paintFlowSketch,
  paintSilkSketch,
  type GlState,
} from './gl-paint'

/** Progressive expose: 4 beats over 2400ms (~2-2.5s). */
export const EXPOSE_BEAT_COUNT = 4
export const EXPOSE_TOTAL_MS = 2400

export type ExposePlan = {
  beatCount: number
  beatMs: number
  totalMs: number
}

/** Continuous stage clock in [0, beatCount - 1]. Integer beats still valid. */
export type ExposeStageIndex = number

export type BlobSketchMark = {
  x: number
  y: number
  radius: number
}

export type SilkSketchField = {
  foldAngle: number
  foldFreq: number
  sheenStrength: number
  iterations: number
}

export type FlowSketchField = {
  swirlStrength: number
  fieldScale: number
  phase: [number, number]
}

export type BloomSketchField = {
  warpScale: number
  warpAmp: number
  fieldScale: number
}

/** Fixed short stage plan for preview choreography. */
export function planExpose(_doc: GradientDocument): ExposePlan {
  return {
    beatCount: EXPOSE_BEAT_COUNT,
    beatMs: EXPOSE_TOTAL_MS / EXPOSE_BEAT_COUNT,
    totalMs: EXPOSE_TOTAL_MS,
  }
}

export function isFinalExposeStage(stage: ExposeStageIndex, beatCount: number): boolean {
  return stage >= beatCount - 1
}

/**
 * Map stage clock to sketch phase.
 * 1 = first construction layer, 2 = second, 3 = color develop, (3..4) blends toward final.
 */
export function sketchModeForStage(stage: ExposeStageIndex): number {
  return 1 + Math.max(0, stage)
}

/** Live blob anchor marks for construction sketch (same derive path as final). */
export function blobSketchMarks(doc: GradientDocument): BlobSketchMark[] {
  return deriveLookFromDocument(doc).anchors.map((a) => ({
    x: a.x,
    y: a.y,
    radius: a.radius,
  }))
}

/** Silk fold field levers for construction sketch (same derive path as final). */
export function silkSketchField(doc: GradientDocument): SilkSketchField {
  const { uniforms } = deriveSilkLook(doc)
  return {
    foldAngle: uniforms.foldAngle,
    foldFreq: uniforms.foldFreq,
    sheenStrength: uniforms.sheenStrength,
    iterations: uniforms.iterations,
  }
}

/** Flow curl field levers for construction sketch (same derive path as final). */
export function flowSketchField(doc: GradientDocument): FlowSketchField {
  const { uniforms } = deriveFlowLook(doc)
  return {
    swirlStrength: uniforms.swirlStrength,
    fieldScale: uniforms.fieldScale,
    phase: uniforms.phase,
  }
}

/** Bloom warp field levers for construction sketch (same derive path as final). */
export function bloomSketchField(doc: GradientDocument): BloomSketchField {
  const { uniforms } = deriveBloomLook(doc)
  return {
    warpScale: uniforms.warpScale,
    warpAmp: uniforms.warpAmp,
    fieldScale: uniforms.fieldScale,
  }
}

/**
 * Preview stage paint. Final stage is bit-identical to direct paintDocument.
 * Fractional stages blend adjacent construction layers in the family shader.
 */
export function paintExposeStage(
  state: GlState,
  doc: GradientDocument,
  width: number,
  height: number,
  stage: ExposeStageIndex,
): void {
  const plan = planExpose(doc)
  if (isFinalExposeStage(stage, plan.beatCount)) {
    paintDocument(state, doc, width, height)
    return
  }
  const sketchMode = sketchModeForStage(stage)
  if (doc.lookFamily === 'bloom') {
    paintBloomSketch(state, doc, width, height, sketchMode)
    return
  }
  if (doc.lookFamily === 'blob') {
    paintBlobSketch(state, doc, width, height, sketchMode)
    return
  }
  if (doc.lookFamily === 'silk') {
    paintSilkSketch(state, doc, width, height, sketchMode)
    return
  }
  if (doc.lookFamily === 'flow') {
    paintFlowSketch(state, doc, width, height, sketchMode)
    return
  }
}
