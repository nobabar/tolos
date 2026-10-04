import type { GradientDocument } from '../document'
import {
  MAX_ANCHORS,
  MAX_FLOW_STOPS,
  SILK_COLOR_COUNT,
  deriveFlowLook,
  deriveLookFromDocument,
  deriveSilkLook,
} from './derive-look'
import flowFragSource from './flow.frag.glsl?raw'
import organicFragSource from './organic.frag.glsl?raw'
import silkFragSource from './silk.frag.glsl?raw'
import vertSource from './organic.vert.glsl?raw'

export type BlobProgramLocations = {
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
  uSketchMode: WebGLUniformLocation
}

/** Preview-only blob construction modes (1 dots, 2 contours, 3 mass). */
export type BlobSketchMode = 1 | 2 | 3

export type FlowProgramLocations = {
  program: WebGLProgram
  aPos: number
  uResolution: WebGLUniformLocation
  uSoftness: WebGLUniformLocation
  uGrain: WebGLUniformLocation
  uEnergy: WebGLUniformLocation
  uSeed: WebGLUniformLocation
  uSwirl: WebGLUniformLocation
  uFieldScale: WebGLUniformLocation
  uPhase: WebGLUniformLocation
  uStops: WebGLUniformLocation
  uStopCount: WebGLUniformLocation
  uSketchMode: WebGLUniformLocation
}

/** Preview-only flow construction modes (1 guides, 2 denser, 3 color). */
export type FlowSketchMode = 1 | 2 | 3

export type SilkProgramLocations = {
  program: WebGLProgram
  aPos: number
  uResolution: WebGLUniformLocation
  uSoftness: WebGLUniformLocation
  uGrain: WebGLUniformLocation
  uEnergy: WebGLUniformLocation
  uSeed: WebGLUniformLocation
  uFoldAngle: WebGLUniformLocation
  uFoldFreq: WebGLUniformLocation
  uSheen: WebGLUniformLocation
  uIterations: WebGLUniformLocation
  uColors: WebGLUniformLocation
  uSketchMode: WebGLUniformLocation
}

/** Preview-only silk construction modes (1 ridges, 2 deepen, 3 color). */
export type SilkSketchMode = 1 | 2 | 3

export type GlState = {
  gl: WebGL2RenderingContext
  blob: BlobProgramLocations
  flow: FlowProgramLocations
  silk: SilkProgramLocations
  vao: WebGLVertexArrayObject
  buffer: WebGLBuffer
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
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

function requireUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: string[],
): WebGLUniformLocation[] | null {
  const locs: WebGLUniformLocation[] = []
  for (const name of names) {
    const loc = gl.getUniformLocation(program, name)
    if (!loc) {
      gl.deleteProgram(program)
      return null
    }
    locs.push(loc)
  }
  return locs
}

function buildBlobProgram(
  gl: WebGL2RenderingContext,
  vert: WebGLShader,
): BlobProgramLocations | null {
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, organicFragSource)
  if (!frag) return null
  const program = linkProgram(gl, vert, frag)
  gl.deleteShader(frag)
  if (!program) return null

  const uniforms = requireUniforms(gl, program, [
    'u_resolution',
    'u_softness',
    'u_grain',
    'u_energy',
    'u_seed',
    'u_anchorPos',
    'u_anchorRgb',
    'u_anchorRadius',
    'u_sketchMode',
  ])
  if (!uniforms) return null
  const [
    uResolution,
    uSoftness,
    uGrain,
    uEnergy,
    uSeed,
    uAnchorPos,
    uAnchorRgb,
    uAnchorRadius,
    uSketchMode,
  ] = uniforms

  return {
    program,
    aPos: gl.getAttribLocation(program, 'a_pos'),
    uResolution: uResolution!,
    uSoftness: uSoftness!,
    uGrain: uGrain!,
    uEnergy: uEnergy!,
    uSeed: uSeed!,
    uAnchorPos: uAnchorPos!,
    uAnchorRgb: uAnchorRgb!,
    uAnchorRadius: uAnchorRadius!,
    uSketchMode: uSketchMode!,
  }
}

function buildFlowProgram(
  gl: WebGL2RenderingContext,
  vert: WebGLShader,
): FlowProgramLocations | null {
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, flowFragSource)
  if (!frag) return null
  const program = linkProgram(gl, vert, frag)
  gl.deleteShader(frag)
  if (!program) return null

  const uniforms = requireUniforms(gl, program, [
    'u_resolution',
    'u_softness',
    'u_grain',
    'u_energy',
    'u_seed',
    'u_swirl',
    'u_fieldScale',
    'u_phase',
    'u_stops',
    'u_stopCount',
    'u_sketchMode',
  ])
  if (!uniforms) return null
  const [
    uResolution,
    uSoftness,
    uGrain,
    uEnergy,
    uSeed,
    uSwirl,
    uFieldScale,
    uPhase,
    uStops,
    uStopCount,
    uSketchMode,
  ] = uniforms

  return {
    program,
    aPos: gl.getAttribLocation(program, 'a_pos'),
    uResolution: uResolution!,
    uSoftness: uSoftness!,
    uGrain: uGrain!,
    uEnergy: uEnergy!,
    uSeed: uSeed!,
    uSwirl: uSwirl!,
    uFieldScale: uFieldScale!,
    uPhase: uPhase!,
    uStops: uStops!,
    uStopCount: uStopCount!,
    uSketchMode: uSketchMode!,
  }
}

function buildSilkProgram(
  gl: WebGL2RenderingContext,
  vert: WebGLShader,
): SilkProgramLocations | null {
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, silkFragSource)
  if (!frag) return null
  const program = linkProgram(gl, vert, frag)
  gl.deleteShader(frag)
  if (!program) return null

  const uniforms = requireUniforms(gl, program, [
    'u_resolution',
    'u_softness',
    'u_grain',
    'u_energy',
    'u_seed',
    'u_foldAngle',
    'u_foldFreq',
    'u_sheen',
    'u_iterations',
    'u_colors',
    'u_sketchMode',
  ])
  if (!uniforms) return null
  const [
    uResolution,
    uSoftness,
    uGrain,
    uEnergy,
    uSeed,
    uFoldAngle,
    uFoldFreq,
    uSheen,
    uIterations,
    uColors,
    uSketchMode,
  ] = uniforms

  return {
    program,
    aPos: gl.getAttribLocation(program, 'a_pos'),
    uResolution: uResolution!,
    uSoftness: uSoftness!,
    uGrain: uGrain!,
    uEnergy: uEnergy!,
    uSeed: uSeed!,
    uFoldAngle: uFoldAngle!,
    uFoldFreq: uFoldFreq!,
    uSheen: uSheen!,
    uIterations: uIterations!,
    uColors: uColors!,
    uSketchMode: uSketchMode!,
  }
}

/** Build blob, flow, and silk programs with a shared fullscreen triangle. */
export function buildGlState(gl: WebGL2RenderingContext): GlState | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSource)
  if (!vert) return null

  const blob = buildBlobProgram(gl, vert)
  const flow = buildFlowProgram(gl, vert)
  const silk = buildSilkProgram(gl, vert)
  gl.deleteShader(vert)
  if (!blob || !flow || !silk) {
    if (blob) gl.deleteProgram(blob.program)
    if (flow) gl.deleteProgram(flow.program)
    if (silk) gl.deleteProgram(silk.program)
    return null
  }

  const vao = gl.createVertexArray()
  const buffer = gl.createBuffer()
  if (!vao || !buffer) {
    gl.deleteProgram(blob.program)
    gl.deleteProgram(flow.program)
    gl.deleteProgram(silk.program)
    return null
  }

  // All programs use layout(location = 0) for a_pos.
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  return { gl, blob, flow, silk, vao, buffer }
}

/** Upload blob uniforms and draw. sketchMode 0 is the final still path. */
function paintBlobWithMode(
  state: GlState,
  doc: GradientDocument,
  width: number,
  height: number,
  sketchMode: number,
): void {
  const { gl, blob, vao } = state
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
  gl.useProgram(blob.program)
  gl.uniform2f(blob.uResolution, width, height)
  gl.uniform1f(blob.uSoftness, uniforms.softness)
  gl.uniform1f(blob.uGrain, uniforms.grain)
  gl.uniform1f(blob.uEnergy, uniforms.energy)
  gl.uniform1f(blob.uSeed, uniforms.seedHash)
  gl.uniform2fv(blob.uAnchorPos, pos)
  gl.uniform3fv(blob.uAnchorRgb, rgb)
  gl.uniform1fv(blob.uAnchorRadius, radii)
  gl.uniform1f(blob.uSketchMode, sketchMode)

  gl.bindVertexArray(vao)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.bindVertexArray(null)
}

/** Organic anchor + warp path (blob family). Zero-radius slots stay inactive. */
function paintBlobDocument(
  state: GlState,
  doc: GradientDocument,
  width: number,
  height: number,
): void {
  paintBlobWithMode(state, doc, width, height, 0)
}

/** Preview-only blob construction sketch. Same deriveLook anchors as the final still. */
export function paintBlobSketch(
  state: GlState,
  doc: GradientDocument,
  width: number,
  height: number,
  sketchMode: BlobSketchMode,
): void {
  paintBlobWithMode(state, doc, width, height, sketchMode)
}

/** Upload flow uniforms and draw. sketchMode 0 is the final still path. */
function paintFlowWithMode(
  state: GlState,
  doc: GradientDocument,
  width: number,
  height: number,
  sketchMode: number,
): void {
  const { gl, flow, vao } = state
  const look = deriveFlowLook(doc)
  const { stops, uniforms } = look

  const stopRgb = new Float32Array(MAX_FLOW_STOPS * 3)
  const last = stops[stops.length - 1] ?? [0, 0, 0]
  for (let i = 0; i < MAX_FLOW_STOPS; i += 1) {
    const rgb = stops[i] ?? last
    stopRgb[i * 3] = rgb[0]
    stopRgb[i * 3 + 1] = rgb[1]
    stopRgb[i * 3 + 2] = rgb[2]
  }

  gl.viewport(0, 0, width, height)
  gl.useProgram(flow.program)
  gl.uniform2f(flow.uResolution, width, height)
  gl.uniform1f(flow.uSoftness, uniforms.softness)
  gl.uniform1f(flow.uGrain, uniforms.grain)
  gl.uniform1f(flow.uEnergy, uniforms.energy)
  gl.uniform1f(flow.uSeed, uniforms.seedHash)
  gl.uniform1f(flow.uSwirl, uniforms.swirlStrength)
  gl.uniform1f(flow.uFieldScale, uniforms.fieldScale)
  gl.uniform2f(flow.uPhase, uniforms.phase[0], uniforms.phase[1])
  gl.uniform3fv(flow.uStops, stopRgb)
  gl.uniform1f(flow.uStopCount, stops.length)
  gl.uniform1f(flow.uSketchMode, sketchMode)

  gl.bindVertexArray(vao)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.bindVertexArray(null)
}

/** Curl / swirl field path (flow family). Unused stop slots repeat the last color. */
function paintFlowDocument(
  state: GlState,
  doc: GradientDocument,
  width: number,
  height: number,
): void {
  paintFlowWithMode(state, doc, width, height, 0)
}

/** Preview-only flow construction sketch. Same deriveFlowLook field as the final still. */
export function paintFlowSketch(
  state: GlState,
  doc: GradientDocument,
  width: number,
  height: number,
  sketchMode: FlowSketchMode,
): void {
  paintFlowWithMode(state, doc, width, height, sketchMode)
}

/** Upload silk uniforms and draw. sketchMode 0 is the final still path. */
function paintSilkWithMode(
  state: GlState,
  doc: GradientDocument,
  width: number,
  height: number,
  sketchMode: number,
): void {
  const { gl, silk, vao } = state
  const look = deriveSilkLook(doc)
  const { colors, uniforms } = look

  const colorRgb = new Float32Array(SILK_COLOR_COUNT * 3)
  for (let i = 0; i < SILK_COLOR_COUNT; i += 1) {
    const rgb = colors[i] ?? [0, 0, 0]
    colorRgb[i * 3] = rgb[0]
    colorRgb[i * 3 + 1] = rgb[1]
    colorRgb[i * 3 + 2] = rgb[2]
  }

  gl.viewport(0, 0, width, height)
  gl.useProgram(silk.program)
  gl.uniform2f(silk.uResolution, width, height)
  gl.uniform1f(silk.uSoftness, uniforms.softness)
  gl.uniform1f(silk.uGrain, uniforms.grain)
  gl.uniform1f(silk.uEnergy, uniforms.energy)
  gl.uniform1f(silk.uSeed, uniforms.seedHash)
  gl.uniform1f(silk.uFoldAngle, uniforms.foldAngle)
  gl.uniform1f(silk.uFoldFreq, uniforms.foldFreq)
  gl.uniform1f(silk.uSheen, uniforms.sheenStrength)
  gl.uniform1f(silk.uIterations, uniforms.iterations)
  gl.uniform3fv(silk.uColors, colorRgb)
  gl.uniform1f(silk.uSketchMode, sketchMode)

  gl.bindVertexArray(vao)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.bindVertexArray(null)
}

/** Directional fold + sheen path (silk family). */
function paintSilkDocument(
  state: GlState,
  doc: GradientDocument,
  width: number,
  height: number,
): void {
  paintSilkWithMode(state, doc, width, height, 0)
}

/** Preview-only silk construction sketch. Same deriveSilkLook field as the final still. */
export function paintSilkSketch(
  state: GlState,
  doc: GradientDocument,
  width: number,
  height: number,
  sketchMode: SilkSketchMode,
): void {
  paintSilkWithMode(state, doc, width, height, sketchMode)
}

/** Paint a document at an explicit pixel size (shared by preview and export). */
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
      paintFlowDocument(state, doc, width, height)
      return
    case 'silk':
      paintSilkDocument(state, doc, width, height)
      return
  }
}

/** Release GL objects owned by a paint target. */
export function disposeGlState(state: GlState): void {
  state.gl.deleteBuffer(state.buffer)
  state.gl.deleteVertexArray(state.vao)
  state.gl.deleteProgram(state.blob.program)
  state.gl.deleteProgram(state.flow.program)
  state.gl.deleteProgram(state.silk.program)
}
