import type { GradientDocument } from '../document'
import { paintDocument, type GlState } from './gl-paint'

/** Progressive expose: 4 beats over 1100ms (within 3-5 beats, ~0.8-1.5s). */
export const EXPOSE_BEAT_COUNT = 4
export const EXPOSE_TOTAL_MS = 1100

export type ExposePlan = {
  beatCount: number
  beatMs: number
  totalMs: number
}

export type ExposeStageIndex = number

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
  // Placeholder: same document-derived final path (no decorative overlay).
  paintDocument(state, doc, width, height)
}
