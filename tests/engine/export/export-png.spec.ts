import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDocument, createOpaqueSeed } from '@/engine/document'
import {
  EXPORT_ASPECT_RATIO,
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  exportPng,
} from '@/engine/export'

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
    deleteShader: vi.fn<() => void>(),
    createProgram: vi.fn<() => WebGLProgram>(() => program),
    attachShader: vi.fn<() => void>(),
    linkProgram: vi.fn<() => void>(),
    getProgramParameter: vi.fn<() => boolean>(() => true),
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
    uniform2fv: vi.fn<() => void>(),
    uniform3fv: vi.fn<() => void>(),
    uniform1fv: vi.fn<() => void>(),
    drawArrays: vi.fn<() => void>(),
    deleteBuffer: vi.fn<() => void>(),
    deleteVertexArray: vi.fn<() => void>(),
  } as unknown as WebGL2RenderingContext
}

describe('exportPng', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to 1920 by 1080 at 16:9', () => {
    expect(EXPORT_WIDTH).toBe(1920)
    expect(EXPORT_HEIGHT).toBe(1080)
    expect(EXPORT_ASPECT_RATIO).toBe(16 / 9)
    expect(EXPORT_WIDTH / EXPORT_HEIGHT).toBe(EXPORT_ASPECT_RATIO)
  })

  it('returns webgl2-unavailable when WebGL2 context cannot be created', async () => {
    const getContext = vi.fn<HTMLCanvasElement['getContext']>().mockReturnValue(null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(getContext)

    const result = await exportPng(createDocument(createOpaqueSeed()))

    expect(result).toEqual({ ok: false, error: 'webgl2-unavailable' })
    expect(getContext).toHaveBeenCalledWith(
      'webgl2',
      expect.objectContaining({
        alpha: false,
        antialias: false,
        preserveDrawingBuffer: true,
      }),
    )
    expect(getContext).not.toHaveBeenCalledWith('2d')
  })

  it('renders at policy size by default, not a preview backing-store size', async () => {
    const gl = createMockGl()
    const getContext = vi.fn<HTMLCanvasElement['getContext']>().mockReturnValue(gl)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(getContext)

    const pngBlob = new Blob(['png'], { type: 'image/png' })
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function (this: HTMLCanvasElement, callback, type) {
        expect(this.width).toBe(EXPORT_WIDTH)
        expect(this.height).toBe(EXPORT_HEIGHT)
        expect(type).toBe('image/png')
        callback(pngBlob)
      })

    const result = await exportPng(createDocument(createOpaqueSeed()))

    expect(result).toEqual({ ok: true, blob: pngBlob })
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
    expect(gl.viewport).toHaveBeenCalledWith(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
    expect(gl.uniform2f).toHaveBeenCalledWith(expect.anything(), EXPORT_WIDTH, EXPORT_HEIGHT)
    expect(gl.deleteProgram).toHaveBeenCalled()
  })

  it('honors optional width and height overrides', async () => {
    const gl = createMockGl()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl)

    const pngBlob = new Blob(['png'], { type: 'image/png' })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
    ) {
      expect(this.width).toBe(640)
      expect(this.height).toBe(360)
      callback(pngBlob)
    })

    const result = await exportPng(createDocument(createOpaqueSeed()), {
      width: 640,
      height: 360,
    })

    expect(result).toEqual({ ok: true, blob: pngBlob })
    expect(gl.viewport).toHaveBeenCalledWith(0, 0, 640, 360)
  })

  it('renders silk documents through paintDocument without mock GL gaps', async () => {
    const gl = createMockGl()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl)

    const pngBlob = new Blob(['png'], { type: 'image/png' })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(pngBlob)
    })

    const doc = { ...createDocument(createOpaqueSeed()), lookFamily: 'silk' as const }
    const result = await exportPng(doc)

    expect(result).toEqual({ ok: true, blob: pngBlob })
    expect(gl.viewport).toHaveBeenCalledWith(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
    expect(gl.uniform3fv).toHaveBeenCalled()
    expect(gl.drawArrays).toHaveBeenCalled()
    expect(gl.deleteProgram).toHaveBeenCalled()
  })
})
