import { hashSeedToUint32 } from '@/engine/prng'

import bloomFragSource from './bloom-spike.frag.glsl?raw'
import vertSource from '../organic.vert.glsl?raw'

/** Temporary fixed seeds. */
export const FIXED_BLOOM_SPIKE_SEEDS = [
  'bloom-petal-01',
  'bloom-cloud-02',
  'bloom-macro-03',
] as const

export type BloomSpikeSeed = (typeof FIXED_BLOOM_SPIKE_SEEDS)[number]

export type BloomSpikeParams = {
  seed: string
  width: number
  height: number
  softness: number
  grain: number
  energy: number
}

export type BloomSpikeProgram = {
  program: WebGLProgram
  aPos: number
  uResolution: WebGLUniformLocation
  uSoftness: WebGLUniformLocation
  uGrain: WebGLUniformLocation
  uEnergy: WebGLUniformLocation
  uSeed: WebGLUniformLocation
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
    console.error('[tolos] bloom spike shader compile failed', gl.getShaderInfoLog(shader))
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
    console.error('[tolos] bloom spike program link failed', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

function requireUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation | null {
  const loc = gl.getUniformLocation(program, name)
  if (!loc) {
    gl.deleteProgram(program)
    return null
  }
  return loc
}

/** Compile/link bloom spike program against organic.vert fullscreen triangle. */
export function buildBloomSpikeProgram(gl: WebGL2RenderingContext): BloomSpikeProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSource)
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, bloomFragSource)
  if (!vert || !frag) {
    if (vert) gl.deleteShader(vert)
    if (frag) gl.deleteShader(frag)
    return null
  }

  const program = linkProgram(gl, vert, frag)
  gl.deleteShader(vert)
  gl.deleteShader(frag)
  if (!program) return null

  const uResolution = requireUniform(gl, program, 'u_resolution')
  const uSoftness = requireUniform(gl, program, 'u_softness')
  const uGrain = requireUniform(gl, program, 'u_grain')
  const uEnergy = requireUniform(gl, program, 'u_energy')
  const uSeed = requireUniform(gl, program, 'u_seed')
  if (!uResolution || !uSoftness || !uGrain || !uEnergy || !uSeed) return null

  const vao = gl.createVertexArray()
  const buffer = gl.createBuffer()
  if (!vao || !buffer) {
    gl.deleteProgram(program)
    return null
  }

  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'a_pos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  return {
    program,
    aPos,
    uResolution,
    uSoftness,
    uGrain,
    uEnergy,
    uSeed,
    vao,
    buffer,
  }
}

export function disposeBloomSpikeProgram(
  gl: WebGL2RenderingContext,
  spike: BloomSpikeProgram,
): void {
  gl.deleteBuffer(spike.buffer)
  gl.deleteVertexArray(spike.vao)
  gl.deleteProgram(spike.program)
}

/** Seed string -> deterministic float uniform in [0, 1). No Math.random. */
export function seedToUniform(seed: string): number {
  return hashSeedToUint32(seed) / 4294967296
}

/** Paint one bloom spike still. Isolated from paintDocument / buildGlState. */
export function paintBloomSpike(
  gl: WebGL2RenderingContext,
  spike: BloomSpikeProgram,
  params: BloomSpikeParams,
): void {
  const { width, height, softness, grain, energy, seed } = params
  gl.viewport(0, 0, width, height)
  gl.useProgram(spike.program)
  gl.bindVertexArray(spike.vao)
  gl.uniform2f(spike.uResolution, width, height)
  gl.uniform1f(spike.uSoftness, softness)
  gl.uniform1f(spike.uGrain, grain)
  gl.uniform1f(spike.uEnergy, energy)
  gl.uniform1f(spike.uSeed, seedToUniform(seed))
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.bindVertexArray(null)
}
