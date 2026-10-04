import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  FIXED_BLOOM_SPIKE_SEEDS,
  buildBloomSpikeProgram,
  disposeBloomSpikeProgram,
  paintBloomSpike,
  seedToUniform,
} from '@/engine/render/spike/bloom-spike-paint'
import { hashSeedToUint32 } from '@/engine/prng'
import * as renderBarrel from '@/engine/render'

function createMockGl(): WebGL2RenderingContext {
  const loc = {} as WebGLUniformLocation
  const program = {} as WebGLProgram
  const shader = {} as WebGLShader
  const buffer = {} as WebGLBuffer
  const vao = {} as WebGLVertexArrayObject

  return {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    createShader: vi.fn<() => WebGLShader>(() => shader),
    shaderSource: vi.fn<() => void>(),
    compileShader: vi.fn<() => void>(),
    getShaderParameter: vi.fn<() => boolean>(() => true),
    getShaderInfoLog: vi.fn<() => string>(() => ''),
    deleteShader: vi.fn<() => void>(),
    createProgram: vi.fn<() => WebGLProgram>(() => program),
    attachShader: vi.fn<() => void>(),
    linkProgram: vi.fn<() => void>(),
    getProgramParameter: vi.fn<() => boolean>(() => true),
    getProgramInfoLog: vi.fn<() => string>(() => ''),
    deleteProgram: vi.fn<() => void>(),
    getUniformLocation: vi.fn<() => WebGLUniformLocation>(() => loc),
    getAttribLocation: vi.fn<() => number>(() => 0),
    createVertexArray: vi.fn<() => WebGLVertexArrayObject>(() => vao),
    createBuffer: vi.fn<() => WebGLBuffer>(() => buffer),
    bindVertexArray: vi.fn<() => void>(),
    bindBuffer: vi.fn<() => void>(),
    bufferData: vi.fn<() => void>(),
    enableVertexAttribArray: vi.fn<() => void>(),
    vertexAttribPointer: vi.fn<() => void>(),
    viewport: vi.fn<() => void>(),
    useProgram: vi.fn<() => void>(),
    uniform2f: vi.fn<() => void>(),
    uniform1f: vi.fn<() => void>(),
    drawArrays: vi.fn<() => void>(),
    deleteBuffer: vi.fn<() => void>(),
    deleteVertexArray: vi.fn<() => void>(),
  } as unknown as WebGL2RenderingContext
}

describe('bloom craft spike', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes three named fixed seeds for go/no-go compare', () => {
    expect(FIXED_BLOOM_SPIKE_SEEDS).toEqual([
      'bloom-petal-01',
      'bloom-cloud-02',
      'bloom-macro-03',
    ])
  })

  it('maps seed strings deterministically without Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    const a = seedToUniform('bloom-petal-01')
    const b = seedToUniform('bloom-petal-01')
    const c = seedToUniform('bloom-cloud-02')
    expect(a).toBe(b)
    expect(a).toBe(hashSeedToUint32('bloom-petal-01') / 4294967296)
    expect(c).not.toBe(a)
    expect(spy).not.toHaveBeenCalled()
  })

  it('compiles the spike program and issues drawArrays for a fixed seed', () => {
    const gl = createMockGl()
    const spike = buildBloomSpikeProgram(gl)
    expect(spike).not.toBeNull()
    if (!spike) return

    paintBloomSpike(gl, spike, {
      seed: FIXED_BLOOM_SPIKE_SEEDS[0],
      width: 640,
      height: 360,
      softness: 0.4,
      grain: 0.3,
      energy: 0.6,
    })

    expect(gl.createShader).toHaveBeenCalled()
    expect(gl.linkProgram).toHaveBeenCalled()
    expect(gl.viewport).toHaveBeenCalledWith(0, 0, 640, 360)
    expect(gl.uniform1f).toHaveBeenCalled()
    expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLES, 0, 3)

    disposeBloomSpikeProgram(gl, spike)
    expect(gl.deleteProgram).toHaveBeenCalled()
  })

  it('is not exported from the public engine/render barrel', () => {
    expect(renderBarrel).not.toHaveProperty('paintBloomSpike')
    expect(renderBarrel).not.toHaveProperty('buildBloomSpikeProgram')
    expect(renderBarrel).not.toHaveProperty('FIXED_BLOOM_SPIKE_SEEDS')
  })
})
