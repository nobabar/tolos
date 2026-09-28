import type { GradientDocument } from '../document'
import { buildGlState, disposeGlState, paintDocument } from '../render/gl-paint'

/** Export geometry owned by engine/export (not preview backing-store). */
export const EXPORT_WIDTH = 1920
export const EXPORT_HEIGHT = 1080
export const EXPORT_ASPECT_RATIO = 16 / 9

export type ExportPngOptions = {
  width?: number
  height?: number
}

export type ExportPngResult = { ok: true; blob: Blob } | { ok: false; error: 'webgl2-unavailable' }

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

/**
 * Re-render `doc` through the organic WebGL path at export policy pixels.
 * Uses a detached canvas; never mutates the live preview target.
 */
export async function exportPng(
  doc: GradientDocument,
  options?: ExportPngOptions,
): Promise<ExportPngResult> {
  const width = options?.width ?? EXPORT_WIDTH
  const height = options?.height ?? EXPORT_HEIGHT

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  })
  if (!gl) {
    return { ok: false, error: 'webgl2-unavailable' }
  }

  const state = buildGlState(gl)
  if (!state) {
    return { ok: false, error: 'webgl2-unavailable' }
  }

  try {
    paintDocument(state, doc, width, height)
    const blob = await canvasToPngBlob(canvas)
    if (!blob) {
      return { ok: false, error: 'webgl2-unavailable' }
    }
    return { ok: true, blob }
  } finally {
    disposeGlState(state)
  }
}
