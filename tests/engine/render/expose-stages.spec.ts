import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDocument, createOpaqueSeed } from '@/engine/document'
import {
  EXPOSE_BEAT_COUNT,
  EXPOSE_TOTAL_MS,
  isFinalExposeStage,
  paintExposeStage,
  planExpose,
} from '@/engine/render/expose-stages'
import * as GlPaint from '@/engine/render/gl-paint'
import type { GlState } from '@/engine/render/gl-paint'

describe('expose stages', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('plans a fixed beat count in 3-5 and total duration in ~0.8-1.5s', () => {
    const doc = createDocument(createOpaqueSeed())
    const plan = planExpose(doc)

    expect(EXPOSE_BEAT_COUNT).toBeGreaterThanOrEqual(3)
    expect(EXPOSE_BEAT_COUNT).toBeLessThanOrEqual(5)
    expect(EXPOSE_TOTAL_MS).toBeGreaterThanOrEqual(800)
    expect(EXPOSE_TOTAL_MS).toBeLessThanOrEqual(1500)
    expect(plan.beatCount).toBe(EXPOSE_BEAT_COUNT)
    expect(plan.totalMs).toBe(EXPOSE_TOTAL_MS)
    expect(plan.beatMs * plan.beatCount).toBe(plan.totalMs)
  })

  it('marks only the last beat as the final stage', () => {
    expect(isFinalExposeStage(0, 4)).toBe(false)
    expect(isFinalExposeStage(2, 4)).toBe(false)
    expect(isFinalExposeStage(3, 4)).toBe(true)
  })

  it('final stage paints through paintDocument', () => {
    const doc = createDocument(createOpaqueSeed())
    const plan = planExpose(doc)
    const state = { gl: {} } as GlState
    const paintSpy = vi.spyOn(GlPaint, 'paintDocument').mockImplementation(() => undefined)

    paintExposeStage(state, doc, 64, 36, plan.beatCount - 1)

    expect(paintSpy).toHaveBeenCalledTimes(1)
    expect(paintSpy).toHaveBeenCalledWith(state, doc, 64, 36)
  })

  it('non-final placeholder stages still use document-derived paintDocument path', () => {
    const doc = createDocument(createOpaqueSeed())
    const state = { gl: {} } as GlState
    const paintSpy = vi.spyOn(GlPaint, 'paintDocument').mockImplementation(() => undefined)

    paintExposeStage(state, doc, 64, 36, 0)

    expect(paintSpy).toHaveBeenCalledTimes(1)
    expect(paintSpy).toHaveBeenCalledWith(state, doc, 64, 36)
  })
})
