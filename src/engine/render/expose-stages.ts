import type { GradientDocument } from '../document'
import { deriveLookFromDocument, deriveSilkLook } from './derive-look'
import {
  paintBlobSketch,
  paintDocument,
  paintSilkSketch,
  type BlobSketchMode,
  type GlState,
  type SilkSketchMode,
} from './gl-paint'

/** Progressive expose: 4 beats over 2400ms (~2-2.5s). */
export const EXPOSE_BEAT_COUNT = 4
export const EXPOSE_TOTAL_MS = 2400

export type ExposePlan = {
  beatCount: number
  beatMs: number
  totalMs: number
}

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

function blobSketchModeForStage(stage: ExposeStageIndex): BlobSketchMode {
  if (stage <= 0) return 1
  if (stage === 1) return 2
  return 3
}

function silkSketchModeForStage(stage: ExposeStageIndex): SilkSketchMode {
  if (stage <= 0) return 1
  if (stage === 1) return 2
  return 3
}

/**
 * Preview stage paint. Final stage is bit-identical to direct paintDocument.
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
  if (doc.lookFamily === 'blob') {
    paintBlobSketch(state, doc, width, height, blobSketchModeForStage(stage))
    return
  }
  if (doc.lookFamily === 'silk') {
    paintSilkSketch(state, doc, width, height, silkSketchModeForStage(stage))
    return
  }
  // Flow placeholder until its construction lands.
  paintDocument(state, doc, width, height)
}
