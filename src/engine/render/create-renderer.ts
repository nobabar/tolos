import type { GradientDocument } from '../document'
import { buildGlState, disposeGlState, paintDocument, type GlState } from './gl-paint'

export type Renderer = {
  draw: (doc: GradientDocument) => void
  resize: () => void
  dispose: () => void
}

export type CreateRendererResult =
  { ok: true; renderer: Renderer } | { ok: false; error: 'webgl2-unavailable' }

/**
 * Mount a WebGL2 renderer on `host`. UI must not call getContext.
 * Context-loss rebuilds GL objects and redraws the last document.
 */
export function createRenderer(host: HTMLElement): CreateRendererResult {
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  host.appendChild(canvas)

  const initialGl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  })
  if (!initialGl) {
    host.removeChild(canvas)
    return { ok: false, error: 'webgl2-unavailable' }
  }

  let state: GlState | null = buildGlState(initialGl)
  if (!state) {
    host.removeChild(canvas)
    return { ok: false, error: 'webgl2-unavailable' }
  }

  let lastDoc: GradientDocument | null = null
  let disposed = false
  let contextLost = false

  const syncSize = (): { width: number; height: number } => {
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const cssW = Math.max(1, host.clientWidth || canvas.clientWidth || 1)
    const cssH = Math.max(1, host.clientHeight || canvas.clientHeight || 1)
    const w = Math.max(1, Math.floor(cssW * dpr))
    const h = Math.max(1, Math.floor(cssH * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    return { width: canvas.width, height: canvas.height }
  }

  const paint = (doc: GradientDocument): void => {
    if (disposed || contextLost || !state) return
    const { width, height } = syncSize()
    paintDocument(state, doc, width, height)
  }

  const onLost = (event: Event): void => {
    event.preventDefault()
    contextLost = true
    state = null
  }

  const onRestored = (): void => {
    if (disposed) return
    contextLost = false
    const restored = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    })
    if (!restored) return
    state = buildGlState(restored)
    if (!state) return
    if (lastDoc) paint(lastDoc)
  }

  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  const renderer: Renderer = {
    draw(doc: GradientDocument): void {
      if (disposed) return
      lastDoc = doc
      paint(doc)
    },
    resize(): void {
      if (disposed || !lastDoc) {
        if (!disposed && !contextLost) syncSize()
        return
      }
      paint(lastDoc)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      if (state) disposeGlState(state)
      if (canvas.parentElement === host) host.removeChild(canvas)
      lastDoc = null
      state = null
    },
  }

  syncSize()
  return { ok: true, renderer }
}
