import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDocument, createOpaqueSeed, setLookFamily } from '@/engine/document'
import { deriveLookFromDocument } from '@/engine/render/derive-look'
import {
  EXPOSE_BEAT_COUNT,
  EXPOSE_TOTAL_MS,
  blobSketchMarks,
  isFinalExposeStage,
  paintExposeStage,
  planExpose,
} from '@/engine/render/expose-stages'
import * as GlPaint from '@/engine/render/gl-paint'
import type { GlState } from '@/engine/render/gl-paint'

function blobDoc(seed: string) {
  return setLookFamily(createDocument(seed), 'blob')
}

function familyDoc(seed: string, family: 'flow' | 'silk') {
  return setLookFamily(createDocument(seed), family)
}

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

  it('blob sketch marks match deriveLook anchors and stay seed-stable', () => {
    const doc = blobDoc('blob-sketch-marks')
    const look = deriveLookFromDocument(doc)
    const marks = blobSketchMarks(doc)

    expect(marks).toEqual(
      look.anchors.map((a) => ({ x: a.x, y: a.y, radius: a.radius })),
    )
    expect(marks.length).toBeGreaterThanOrEqual(3)
    expect(marks.length).toBeLessThanOrEqual(4)
    expect(blobSketchMarks(doc)).toEqual(marks)
    expect(blobSketchMarks(blobDoc('blob-sketch-other'))).not.toEqual(marks)
  })

  it('blob non-final stages paint sketch modes, not paintDocument', () => {
    const doc = blobDoc('blob-sketch-stages')
    const state = { gl: {} } as GlState
    const sketchSpy = vi.spyOn(GlPaint, 'paintBlobSketch').mockImplementation(() => undefined)
    const paintSpy = vi.spyOn(GlPaint, 'paintDocument').mockImplementation(() => undefined)

    paintExposeStage(state, doc, 64, 36, 0)
    expect(sketchSpy).toHaveBeenCalledWith(state, doc, 64, 36, 1)
    expect(paintSpy).not.toHaveBeenCalled()

    sketchSpy.mockClear()
    paintExposeStage(state, doc, 64, 36, 1)
    expect(sketchSpy).toHaveBeenCalledWith(state, doc, 64, 36, 2)
    expect(paintSpy).not.toHaveBeenCalled()

    sketchSpy.mockClear()
    paintExposeStage(state, doc, 64, 36, 2)
    expect(sketchSpy).toHaveBeenCalledWith(state, doc, 64, 36, 3)
    expect(paintSpy).not.toHaveBeenCalled()
  })

  it('blob final stage still dispatches paintDocument', () => {
    const doc = blobDoc('blob-sketch-final')
    const plan = planExpose(doc)
    const state = { gl: {} } as GlState
    const sketchSpy = vi.spyOn(GlPaint, 'paintBlobSketch').mockImplementation(() => undefined)
    const paintSpy = vi.spyOn(GlPaint, 'paintDocument').mockImplementation(() => undefined)

    paintExposeStage(state, doc, 64, 36, plan.beatCount - 1)

    expect(paintSpy).toHaveBeenCalledTimes(1)
    expect(paintSpy).toHaveBeenCalledWith(state, doc, 64, 36)
    expect(sketchSpy).not.toHaveBeenCalled()
  })

  it('flow and silk non-final stages keep placeholder paintDocument path', () => {
    const state = { gl: {} } as GlState
    const sketchSpy = vi.spyOn(GlPaint, 'paintBlobSketch').mockImplementation(() => undefined)
    const paintSpy = vi.spyOn(GlPaint, 'paintDocument').mockImplementation(() => undefined)

    paintExposeStage(state, familyDoc('flow-placeholder', 'flow'), 64, 36, 0)
    paintExposeStage(state, familyDoc('silk-placeholder', 'silk'), 64, 36, 1)

    expect(paintSpy).toHaveBeenCalledTimes(2)
    expect(sketchSpy).not.toHaveBeenCalled()
  })
})
