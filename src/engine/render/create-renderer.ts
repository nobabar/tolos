import type { GradientDocument } from '../document'
import { ANCHOR_COUNT, deriveLookFromDocument } from './derive-look'
import fragSource from './organic.frag.glsl?raw'
import vertSource from './organic.vert.glsl?raw'

export type Renderer = {
  draw: (doc: GradientDocument) => void
  resize: () => void
  dispose: () => void
}

export type CreateRendererResult =
  | { ok: true; renderer: Renderer }
  | { ok: false; error: 'webgl2-unavailable' }

type ProgramLocations = {
  program: WebGLProgram
  aPos: number
  uResolution: WebGLUniformLocation
  uSoftness: WebGLUniformLocation
  uGrain: WebGLUniformLocation
  uEnergy: WebGLUniformLocation
  uSeed: WebGLUniformLocation
  uAnchorPos: WebGLUniformLocation
  uAnchorRgb: WebGLUniformLocation
  uAnchorRadius: WebGLUniformLocation
}

type GlState = {
  gl: WebGL2RenderingContext
  locations: ProgramLocations
  vao: WebGLVertexArrayObject
  buffer: WebGLBuffer
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function linkProgram(
  gl: WebGL2RenderingContext,
  vert: WebGLShader,
  frag: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }
  return program
}

function buildProgram(gl: WebGL2RenderingContext): ProgramLocations | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSource)
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSource)
  if (!vert || !frag) {
    if (vert) gl.deleteShader(vert)
    if (frag) gl.deleteShader(frag)
    return null
  }
  const program = linkProgram(gl, vert, frag)
  gl.deleteShader(vert)
  gl.deleteShader(frag)
  if (!program) return null

  const uResolution = gl.getUniformLocation(program, 'u_resolution')
  const uSoftness = gl.getUniformLocation(program, 'u_softness')
  const uGrain = gl.getUniformLocation(program, 'u_grain')
  const uEnergy = gl.getUniformLocation(program, 'u_energy')
  const uSeed = gl.getUniformLocation(program, 'u_seed')
  const uAnchorPos = gl.getUniformLocation(program, 'u_anchorPos')
  const uAnchorRgb = gl.getUniformLocation(program, 'u_anchorRgb')
  const uAnchorRadius = gl.getUniformLocation(program, 'u_anchorRadius')
  if (
    !uResolution ||
    !uSoftness ||
    !uGrain ||
    !uEnergy ||
    !uSeed ||
    !uAnchorPos ||
    !uAnchorRgb ||
    !uAnchorRadius
  ) {
    gl.deleteProgram(program)
    return null
  }

  return {
    program,
    aPos: gl.getAttribLocation(program, 'a_pos'),
    uResolution,
    uSoftness,
    uGrain,
    uEnergy,
    uSeed,
    uAnchorPos,
    uAnchorRgb,
    uAnchorRadius,
  }
}

function buildGlState(gl: WebGL2RenderingContext): GlState | null {
  const locations = buildProgram(gl)
  if (!locations) return null
  const vao = gl.createVertexArray()
  const buffer = gl.createBuffer()
  if (!vao || !buffer) return null

  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(locations.aPos)
  gl.vertexAttribPointer(locations.aPos, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  return { gl, locations, vao, buffer }
}

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

  let state = buildGlState(initialGl)
  if (!state) {
    host.removeChild(canvas)
    return { ok: false, error: 'webgl2-unavailable' }
  }

  let lastDoc: GradientDocument | null = null
  let disposed = false
  let contextLost = false

  const syncSize = (): void => {
    if (disposed || contextLost || !state) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const cssW = Math.max(1, host.clientWidth || canvas.clientWidth || 1)
    const cssH = Math.max(1, host.clientHeight || canvas.clientHeight || 1)
    const w = Math.max(1, Math.floor(cssW * dpr))
    const h = Math.max(1, Math.floor(cssH * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    state.gl.viewport(0, 0, canvas.width, canvas.height)
  }

  const paint = (doc: GradientDocument): void => {
    if (disposed || contextLost || !state) return
    syncSize()
    const { gl, locations, vao } = state
    const look = deriveLookFromDocument(doc)
    const { anchors, uniforms } = look

    const pos = new Float32Array(ANCHOR_COUNT * 2)
    const rgb = new Float32Array(ANCHOR_COUNT * 3)
    const radii = new Float32Array(ANCHOR_COUNT)
    for (let i = 0; i < ANCHOR_COUNT; i += 1) {
      const a = anchors[i]
      if (!a) continue
      pos[i * 2] = a.x
      pos[i * 2 + 1] = a.y
      rgb[i * 3] = a.rgb[0]
      rgb[i * 3 + 1] = a.rgb[1]
      rgb[i * 3 + 2] = a.rgb[2]
      radii[i] = a.radius
    }

    gl.useProgram(locations.program)
    gl.uniform2f(locations.uResolution, canvas.width, canvas.height)
    gl.uniform1f(locations.uSoftness, uniforms.softness)
    gl.uniform1f(locations.uGrain, uniforms.grain)
    gl.uniform1f(locations.uEnergy, uniforms.energy)
    gl.uniform1f(locations.uSeed, uniforms.seedHash)
    gl.uniform2fv(locations.uAnchorPos, pos)
    gl.uniform3fv(locations.uAnchorRgb, rgb)
    gl.uniform1fv(locations.uAnchorRadius, radii)

    gl.bindVertexArray(vao)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
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
        syncSize()
        return
      }
      paint(lastDoc)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      if (state) {
        state.gl.deleteBuffer(state.buffer)
        state.gl.deleteVertexArray(state.vao)
        state.gl.deleteProgram(state.locations.program)
      }
      if (canvas.parentElement === host) host.removeChild(canvas)
      lastDoc = null
      state = null
    },
  }

  syncSize()
  return { ok: true, renderer }
}
