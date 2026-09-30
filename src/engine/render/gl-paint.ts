import type { GradientDocument } from '../document'
import { MAX_ANCHORS, deriveLookFromDocument } from './derive-look'
import fragSource from './organic.frag.glsl?raw'
import vertSource from './organic.vert.glsl?raw'

export type ProgramLocations = {
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

export type GlState = {
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
    console.error('[tolos] shader compile failed', gl.getShaderInfoLog(shader))
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
    console.error('[tolos] program link failed', gl.getProgramInfoLog(program))
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

/** Build shader program + fullscreen triangle for a WebGL2 context. */
export function buildGlState(gl: WebGL2RenderingContext): GlState | null {
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

/** Organic anchor + warp path (blob family). Zero-radius slots stay inactive. */
function paintBlobDocument(
  state: GlState,
  doc: GradientDocument,
  width: number,
  height: number,
): void {
  const { gl, locations, vao } = state
  const look = deriveLookFromDocument(doc)
  const { anchors, uniforms } = look

  const pos = new Float32Array(MAX_ANCHORS * 2)
  const rgb = new Float32Array(MAX_ANCHORS * 3)
  const radii = new Float32Array(MAX_ANCHORS)
  for (let i = 0; i < MAX_ANCHORS; i += 1) {
    const a = anchors[i]
    if (!a) {
      radii[i] = 0
      continue
    }
    pos[i * 2] = a.x
    pos[i * 2 + 1] = a.y
    rgb[i * 3] = a.rgb[0]
    rgb[i * 3 + 1] = a.rgb[1]
    rgb[i * 3 + 2] = a.rgb[2]
    radii[i] = a.radius
  }

  gl.viewport(0, 0, width, height)
  gl.useProgram(locations.program)
  gl.uniform2f(locations.uResolution, width, height)
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

/**
 * Paint a document at an explicit pixel size (shared by preview and export).
 * flow/silk temporarily reuse the blob path until family shaders land.
 */
export function paintDocument(
  state: GlState,
  doc: GradientDocument,
  width: number,
  height: number,
): void {
  switch (doc.lookFamily) {
    case 'blob':
      paintBlobDocument(state, doc, width, height)
      return
    case 'flow':
    case 'silk':
      // Temporary fallback: same organic paint until family shaders land.
      paintBlobDocument(state, doc, width, height)
      return
  }
}

/** Release GL objects owned by a paint target. */
export function disposeGlState(state: GlState): void {
  state.gl.deleteBuffer(state.buffer)
  state.gl.deleteVertexArray(state.vao)
  state.gl.deleteProgram(state.locations.program)
}
