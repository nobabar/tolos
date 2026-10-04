import type { GradientDocument } from '../document'
import { deriveLookFromDocument } from './derive-look'
import { paintBlobSketch, paintDocument, type BlobSketchMode, type GlState } from './gl-paint'

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

function blobSketchModeForStage(stage: ExposeStageIndex): BlobSketchMode {
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
  // Flow/silk placeholders until their construction land.
  paintDocument(state, doc, width, height)
}
