import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRenderer } from '@/engine/render'

describe('createRenderer WebGL2 capability', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns webgl2-unavailable when getContext cannot create WebGL2', () => {
    const getContext = vi.fn<HTMLCanvasElement['getContext']>().mockReturnValue(null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(getContext)

    const host = document.createElement('div')
    const result = createRenderer(host)

    expect(result).toEqual({ ok: false, error: 'webgl2-unavailable' })
    expect(getContext).toHaveBeenCalledWith(
      'webgl2',
      expect.objectContaining({
        alpha: false,
        antialias: false,
        preserveDrawingBuffer: true,
      }),
    )
    expect(getContext.mock.calls.every(([type]) => type === 'webgl2')).toBe(true)
    expect(host.querySelector('canvas')).toBeNull()
    expect(host.children.length).toBe(0)
  })

  it('does not fall back to 2d canvas when WebGL2 is missing', () => {
    const getContext = vi.fn<HTMLCanvasElement['getContext']>().mockReturnValue(null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(getContext)

    createRenderer(document.createElement('div'))

    expect(getContext).not.toHaveBeenCalledWith('2d')
    expect(getContext).not.toHaveBeenCalledWith('2d', expect.anything())
  })
})
