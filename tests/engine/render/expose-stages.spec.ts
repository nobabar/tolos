import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDocument, createOpaqueSeed, setLookFamily } from '@/engine/document'
import {
  deriveFlowLook,
  deriveLookFromDocument,
  deriveSilkLook,
} from '@/engine/render/derive-look'
import {
  EXPOSE_BEAT_COUNT,
  EXPOSE_TOTAL_MS,
  blobSketchMarks,
  flowSketchField,
  isFinalExposeStage,
  paintExposeStage,
  planExpose,
  silkSketchField,
  sketchModeForStage,
} from '@/engine/render/expose-stages'
import * as GlPaint from '@/engine/render/gl-paint'
import type { GlState } from '@/engine/render/gl-paint'

function blobDoc(seed: string) {
  return setLookFamily(createDocument(seed), 'blob')
}

function silkDoc(seed: string) {
  return setLookFamily(createDocument(seed), 'silk')
}

function flowDoc(seed: string) {
  return setLookFamily(createDocument(seed), 'flow')
}

function bloomDoc(seed: string) {
  return setLookFamily(createDocument(seed), 'bloom')
}

describe('expose stages', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('plans a fixed beat count in 3-5 and total duration in ~2-2.5s', () => {
    const doc = createDocument(createOpaqueSeed())
    const plan = planExpose(doc)

    expect(EXPOSE_BEAT_COUNT).toBeGreaterThanOrEqual(3)
    expect(EXPOSE_BEAT_COUNT).toBeLessThanOrEqual(5)
    expect(EXPOSE_TOTAL_MS).toBeGreaterThanOrEqual(2000)
    expect(EXPOSE_TOTAL_MS).toBeLessThanOrEqual(2800)
    expect(plan.beatCount).toBe(EXPOSE_BEAT_COUNT)
    expect(plan.totalMs).toBe(EXPOSE_TOTAL_MS)
    expect(plan.beatMs * plan.beatCount).toBe(plan.totalMs)
  })

  it('marks only the last beat as the final stage', () => {
    expect(isFinalExposeStage(0, 4)).toBe(false)
    expect(isFinalExposeStage(2, 4)).toBe(false)
    expect(isFinalExposeStage(2.99, 4)).toBe(false)
    expect(isFinalExposeStage(3, 4)).toBe(true)
  })

  it('maps continuous stage clock to blending sketch phases', () => {
    expect(sketchModeForStage(0)).toBe(1)
    expect(sketchModeForStage(0.5)).toBe(1.5)
    expect(sketchModeForStage(1)).toBe(2)
    expect(sketchModeForStage(2)).toBe(3)
    expect(sketchModeForStage(2.5)).toBe(3.5)
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
    paintExposeStage(state, doc, 64, 36, 0.5)
    expect(sketchSpy).toHaveBeenCalledWith(state, doc, 64, 36, 1.5)
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

  it('flow sketch field matches deriveFlowLook curl levers and stays seed-stable', () => {
    const doc = flowDoc('flow-sketch-field')
    const look = deriveFlowLook(doc)
    const field = flowSketchField(doc)

    expect(field).toEqual({
      swirlStrength: look.uniforms.swirlStrength,
      fieldScale: look.uniforms.fieldScale,
      phase: look.uniforms.phase,
    })
    expect(flowSketchField(doc)).toEqual(field)
    expect(flowSketchField(flowDoc('flow-sketch-other'))).not.toEqual(field)
  })

  it('flow non-final stages paint sketch modes, not paintDocument', () => {
    const doc = flowDoc('flow-sketch-stages')
    const state = { gl: {} } as GlState
    const sketchSpy = vi.spyOn(GlPaint, 'paintFlowSketch').mockImplementation(() => undefined)
    const paintSpy = vi.spyOn(GlPaint, 'paintDocument').mockImplementation(() => undefined)

    paintExposeStage(state, doc, 64, 36, 0)
    expect(sketchSpy).toHaveBeenCalledWith(state, doc, 64, 36, 1)
    expect(paintSpy).not.toHaveBeenCalled()

    sketchSpy.mockClear()
    paintExposeStage(state, doc, 64, 36, 1.25)
    expect(sketchSpy).toHaveBeenCalledWith(state, doc, 64, 36, 2.25)
    expect(paintSpy).not.toHaveBeenCalled()

    sketchSpy.mockClear()
    paintExposeStage(state, doc, 64, 36, 2)
    expect(sketchSpy).toHaveBeenCalledWith(state, doc, 64, 36, 3)
    expect(paintSpy).not.toHaveBeenCalled()
  })

  it('flow final stage still dispatches paintDocument', () => {
    const doc = flowDoc('flow-sketch-final')
    const plan = planExpose(doc)
    const state = { gl: {} } as GlState
    const sketchSpy = vi.spyOn(GlPaint, 'paintFlowSketch').mockImplementation(() => undefined)
    const paintSpy = vi.spyOn(GlPaint, 'paintDocument').mockImplementation(() => undefined)

    paintExposeStage(state, doc, 64, 36, plan.beatCount - 1)

    expect(paintSpy).toHaveBeenCalledTimes(1)
    expect(paintSpy).toHaveBeenCalledWith(state, doc, 64, 36)
    expect(sketchSpy).not.toHaveBeenCalled()
  })

  it('silk sketch field matches deriveSilkLook fold levers and stays seed-stable', () => {
    const doc = silkDoc('silk-sketch-field')
    const look = deriveSilkLook(doc)
    const field = silkSketchField(doc)

    expect(field).toEqual({
      foldAngle: look.uniforms.foldAngle,
      foldFreq: look.uniforms.foldFreq,
      sheenStrength: look.uniforms.sheenStrength,
      iterations: look.uniforms.iterations,
    })
    expect(silkSketchField(doc)).toEqual(field)
    expect(silkSketchField(silkDoc('silk-sketch-other'))).not.toEqual(field)
  })

  it('silk non-final stages paint sketch modes, not paintDocument', () => {
    const doc = silkDoc('silk-sketch-stages')
    const state = { gl: {} } as GlState
    const sketchSpy = vi.spyOn(GlPaint, 'paintSilkSketch').mockImplementation(() => undefined)
    const paintSpy = vi.spyOn(GlPaint, 'paintDocument').mockImplementation(() => undefined)

    paintExposeStage(state, doc, 64, 36, 0)
    expect(sketchSpy).toHaveBeenCalledWith(state, doc, 64, 36, 1)
    expect(paintSpy).not.toHaveBeenCalled()

    sketchSpy.mockClear()
    paintExposeStage(state, doc, 64, 36, 2.25)
    expect(sketchSpy).toHaveBeenCalledWith(state, doc, 64, 36, 3.25)
    expect(paintSpy).not.toHaveBeenCalled()

    sketchSpy.mockClear()
    paintExposeStage(state, doc, 64, 36, 2)
    expect(sketchSpy).toHaveBeenCalledWith(state, doc, 64, 36, 3)
    expect(paintSpy).not.toHaveBeenCalled()
  })

  it('silk final stage still dispatches paintDocument', () => {
    const doc = silkDoc('silk-sketch-final')
    const plan = planExpose(doc)
    const state = { gl: {} } as GlState
    const sketchSpy = vi.spyOn(GlPaint, 'paintSilkSketch').mockImplementation(() => undefined)
    const paintSpy = vi.spyOn(GlPaint, 'paintDocument').mockImplementation(() => undefined)

    paintExposeStage(state, doc, 64, 36, plan.beatCount - 1)

    expect(paintSpy).toHaveBeenCalledTimes(1)
    expect(paintSpy).toHaveBeenCalledWith(state, doc, 64, 36)
    expect(sketchSpy).not.toHaveBeenCalled()
  })

  it('bloom non-final stages fall through to paintDocument', () => {
    const doc = bloomDoc('bloom-expose-stages')
    const state = { gl: {} } as GlState
    const blobSpy = vi.spyOn(GlPaint, 'paintBlobSketch').mockImplementation(() => undefined)
    const paintSpy = vi.spyOn(GlPaint, 'paintDocument').mockImplementation(() => undefined)

    paintExposeStage(state, doc, 64, 36, 0)
    expect(paintSpy).toHaveBeenCalledWith(state, doc, 64, 36)
    expect(blobSpy).not.toHaveBeenCalled()

    paintSpy.mockClear()
    paintExposeStage(state, doc, 64, 36, 1.5)
    expect(paintSpy).toHaveBeenCalledWith(state, doc, 64, 36)
    expect(blobSpy).not.toHaveBeenCalled()
  })

  it('bloom final stage still dispatches paintDocument', () => {
    const doc = bloomDoc('bloom-expose-final')
    const plan = planExpose(doc)
    const state = { gl: {} } as GlState
    const blobSpy = vi.spyOn(GlPaint, 'paintBlobSketch').mockImplementation(() => undefined)
    const paintSpy = vi.spyOn(GlPaint, 'paintDocument').mockImplementation(() => undefined)

    paintExposeStage(state, doc, 64, 36, plan.beatCount - 1)

    expect(paintSpy).toHaveBeenCalledTimes(1)
    expect(paintSpy).toHaveBeenCalledWith(state, doc, 64, 36)
    expect(blobSpy).not.toHaveBeenCalled()
  })
})
