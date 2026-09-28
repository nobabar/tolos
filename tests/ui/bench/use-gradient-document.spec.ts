import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

import { createDocument } from '@/engine/document'
import type { ExportPngResult } from '@/engine/export'
import type { CreateRendererResult, Renderer } from '@/engine/render'
import {
  useGradientDocument,
  type UseGradientDocument,
} from '@/ui/bench/use-gradient-document'

const draw = vi.fn<Renderer['draw']>()
const resize = vi.fn<Renderer['resize']>()
const dispose = vi.fn<Renderer['dispose']>()

vi.mock('@/engine/render', () => ({
  createRenderer: vi.fn<() => CreateRendererResult>(() => ({
    ok: true,
    renderer: { draw, resize, dispose },
  })),
}))

vi.mock('@/engine/export', () => ({
  exportPng: vi.fn<() => Promise<ExportPngResult>>(),
}))

import { exportPng } from '@/engine/export'
import { createRenderer } from '@/engine/render'

function flushFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function mountComposable(): {
  api: UseGradientDocument
  wrapper: ReturnType<typeof mount>
} {
  const box: { api?: UseGradientDocument } = {}
  const Host = defineComponent({
    setup() {
      box.api = useGradientDocument()
      return () => null
    },
  })
  const wrapper = mount(Host)
  if (!box.api) throw new Error('composable did not initialize')
  return { api: box.api, wrapper }
}

describe('useGradientDocument', () => {
  beforeEach(() => {
    draw.mockClear()
    resize.mockClear()
    dispose.mockClear()
    vi.mocked(createRenderer).mockClear()
    vi.mocked(exportPng).mockReset()
    vi.mocked(exportPng).mockResolvedValue({
      ok: true,
      blob: new Blob(['png'], { type: 'image/png' }),
    })
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn<() => string>(() => 'blob:tolos-export'),
      revokeObjectURL: vi.fn<() => void>(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('cold open yields a seeded live document', () => {
    const { api, wrapper } = mountComposable()
    expect(api.doc.value.seed.length).toBeGreaterThan(0)
    expect(api.doc.value.params.softness.amount).toBeGreaterThanOrEqual(0)
    expect(api.jobState.value).toBe('idle')
    wrapper.unmount()
  })

  it('idle applyParam updates param and leaves seed unchanged', async () => {
    const { api, wrapper } = mountComposable()
    const seedBefore = api.doc.value.seed
    api.applyParam('softness', 'amount', 0.42)
    await nextTick()
    expect(api.doc.value.params.softness.amount).toBe(0.42)
    expect(api.doc.value.seed).toBe(seedBefore)
    await flushFrame()
    wrapper.unmount()
  })

  it('busy applyParam leaves document unchanged while exposing', async () => {
    const { api, wrapper } = mountComposable()
    const seedBefore = api.doc.value.seed
    const paramsBefore = structuredClone(api.doc.value.params)
    api.jobState.value = 'exposing'
    api.applyParam('softness', 'amount', 0.42)
    await nextTick()
    expect(api.doc.value.seed).toBe(seedBefore)
    expect(api.doc.value.params).toEqual(paramsBefore)
    wrapper.unmount()
  })

  it('busy applyParam leaves document unchanged while exporting', async () => {
    const { api, wrapper } = mountComposable()
    const seedBefore = api.doc.value.seed
    const paramsBefore = structuredClone(api.doc.value.params)
    api.jobState.value = 'exporting'
    api.applyParam('palette', 'energy', 0.77)
    await nextTick()
    expect(api.doc.value.seed).toBe(seedBefore)
    expect(api.doc.value.params).toEqual(paramsBefore)
    wrapper.unmount()
  })

  it('idle applyParam enters exposing then returns to idle after paint', async () => {
    const { api, wrapper } = mountComposable()
    const host = document.createElement('div')
    api.mountHost(host)
    draw.mockClear()

    api.applyParam('grain', 'amount', 0.55)
    expect(api.jobState.value).toBe('exposing')
    await flushFrame()
    expect(draw).toHaveBeenCalledWith(api.doc.value)
    expect(api.jobState.value).toBe('idle')
    wrapper.unmount()
  })

  it('applyRandomize replaces seed via document command', async () => {
    const { api, wrapper } = mountComposable()
    const seedBefore = api.doc.value.seed
    api.applyRandomize()
    await nextTick()
    expect(api.doc.value.seed).not.toBe(seedBefore)
    await flushFrame()
    wrapper.unmount()
  })

  it('idle applyRandomize yields params reproducible from the new seed', async () => {
    const { api, wrapper } = mountComposable()
    api.applyRandomize()
    await nextTick()
    expect(api.doc.value.params).toEqual(createDocument(api.doc.value.seed).params)
    await flushFrame()
    wrapper.unmount()
  })

  it('idle applyRandomize enters exposing then returns to idle after paint', async () => {
    const { api, wrapper } = mountComposable()
    const host = document.createElement('div')
    api.mountHost(host)
    draw.mockClear()

    api.applyRandomize()
    expect(api.jobState.value).toBe('exposing')
    await flushFrame()
    expect(draw).toHaveBeenCalledWith(api.doc.value)
    expect(api.jobState.value).toBe('idle')
    wrapper.unmount()
  })

  it('applyRandomize leaves seed and params unchanged while exposing', async () => {
    const { api, wrapper } = mountComposable()
    const seedBefore = api.doc.value.seed
    const paramsBefore = structuredClone(api.doc.value.params)
    api.jobState.value = 'exposing'
    api.applyRandomize()
    await nextTick()
    expect(api.doc.value.seed).toBe(seedBefore)
    expect(api.doc.value.params).toEqual(paramsBefore)
    wrapper.unmount()
  })

  it('applyRandomize leaves seed and params unchanged while exporting', async () => {
    const { api, wrapper } = mountComposable()
    const seedBefore = api.doc.value.seed
    const paramsBefore = structuredClone(api.doc.value.params)
    api.jobState.value = 'exporting'
    api.applyRandomize()
    await nextTick()
    expect(api.doc.value.seed).toBe(seedBefore)
    expect(api.doc.value.params).toEqual(paramsBefore)
    wrapper.unmount()
  })

  it('idle applySeed updates seed and keeps dial params', async () => {
    const { api, wrapper } = mountComposable()
    api.applyParam('grain', 'amount', 0.42)
    await flushFrame()
    const paramsBefore = structuredClone(api.doc.value.params)
    const result = api.applySeed('restored-look')
    await nextTick()
    expect(result).toBe('ok')
    expect(api.doc.value.seed).toBe('restored-look')
    expect(api.doc.value.params).toEqual(paramsBefore)
    expect(api.doc.value.params).not.toEqual(createDocument('restored-look').params)
    await flushFrame()
    wrapper.unmount()
  })

  it('idle applySeed trims whitespace before commit', async () => {
    const { api, wrapper } = mountComposable()
    const result = api.applySeed('  padded-seed  ')
    await nextTick()
    expect(result).toBe('ok')
    expect(api.doc.value.seed).toBe('padded-seed')
    await flushFrame()
    wrapper.unmount()
  })

  it('invalid applySeed leaves document unchanged', async () => {
    const { api, wrapper } = mountComposable()
    const seedBefore = api.doc.value.seed
    const paramsBefore = structuredClone(api.doc.value.params)
    const result = api.applySeed('   ')
    await nextTick()
    expect(result).toBe('invalid')
    expect(api.doc.value.seed).toBe(seedBefore)
    expect(api.doc.value.params).toEqual(paramsBefore)
    wrapper.unmount()
  })

  it('applySeed leaves document unchanged while exposing', async () => {
    const { api, wrapper } = mountComposable()
    const seedBefore = api.doc.value.seed
    const paramsBefore = structuredClone(api.doc.value.params)
    api.jobState.value = 'exposing'
    const result = api.applySeed('busy-seed')
    await nextTick()
    expect(result).toBe('ok')
    expect(api.doc.value.seed).toBe(seedBefore)
    expect(api.doc.value.params).toEqual(paramsBefore)
    wrapper.unmount()
  })

  it('applySeed leaves document unchanged while exporting', async () => {
    const { api, wrapper } = mountComposable()
    const seedBefore = api.doc.value.seed
    const paramsBefore = structuredClone(api.doc.value.params)
    api.jobState.value = 'exporting'
    api.applySeed('busy-seed')
    await nextTick()
    expect(api.doc.value.seed).toBe(seedBefore)
    expect(api.doc.value.params).toEqual(paramsBefore)
    wrapper.unmount()
  })

  it('idle applySeed enters exposing then returns to idle after paint', async () => {
    const { api, wrapper } = mountComposable()
    const host = document.createElement('div')
    api.mountHost(host)
    draw.mockClear()

    api.applySeed('expose-seed')
    expect(api.jobState.value).toBe('exposing')
    await flushFrame()
    expect(draw).toHaveBeenCalledWith(api.doc.value)
    expect(api.jobState.value).toBe('idle')
    wrapper.unmount()
  })

  it('mountHost draws through engine renderer only', () => {
    const { api, wrapper } = mountComposable()
    const host = document.createElement('div')
    api.mountHost(host)
    expect(createRenderer).toHaveBeenCalledWith(host)
    expect(draw).toHaveBeenCalledWith(api.doc.value)
    expect(api.renderError.value).toBeNull()
    wrapper.unmount()
  })

  it('mountHost surfaces webgl2-unavailable without drawing', () => {
    vi.mocked(createRenderer).mockReturnValueOnce({
      ok: false,
      error: 'webgl2-unavailable',
    })
    const { api, wrapper } = mountComposable()
    const host = document.createElement('div')
    api.mountHost(host)
    expect(api.renderError.value).toBe('webgl2-unavailable')
    expect(draw).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('document revision redraws without remounting host', async () => {
    const { api, wrapper } = mountComposable()
    const host = document.createElement('div')
    api.mountHost(host)
    draw.mockClear()
    api.applyParam('grain', 'amount', 0.55)
    await flushFrame()
    expect(draw).toHaveBeenCalledTimes(1)
    expect(draw).toHaveBeenCalledWith(api.doc.value)
    wrapper.unmount()
  })

  it('idle applyExport sets exporting then returns to idle', async () => {
    const { api, wrapper } = mountComposable()
    const host = document.createElement('div')
    api.mountHost(host)

    let resolveExport!: (value: ExportPngResult) => void
    vi.mocked(exportPng).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExport = resolve
      }),
    )

    const pending = api.applyExport()
    expect(api.jobState.value).toBe('exporting')
    expect(exportPng).toHaveBeenCalledWith(api.doc.value)

    resolveExport({ ok: true, blob: new Blob(['png'], { type: 'image/png' }) })
    await pending
    expect(api.jobState.value).toBe('idle')
    wrapper.unmount()
  })

  it('second applyExport is ignored while exporting', async () => {
    const { api, wrapper } = mountComposable()
    const host = document.createElement('div')
    api.mountHost(host)

    let resolveExport!: (value: ExportPngResult) => void
    vi.mocked(exportPng).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExport = resolve
      }),
    )

    const first = api.applyExport()
    expect(api.jobState.value).toBe('exporting')
    await api.applyExport()
    expect(exportPng).toHaveBeenCalledTimes(1)

    resolveExport({ ok: true, blob: new Blob(['png'], { type: 'image/png' }) })
    await first
    wrapper.unmount()
  })

  it('while exporting, param randomize and seed leave document unchanged', async () => {
    const { api, wrapper } = mountComposable()
    const host = document.createElement('div')
    api.mountHost(host)

    let resolveExport!: (value: ExportPngResult) => void
    vi.mocked(exportPng).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExport = resolve
      }),
    )

    const pending = api.applyExport()
    const seedBefore = api.doc.value.seed
    const paramsBefore = structuredClone(api.doc.value.params)
    api.applyParam('softness', 'amount', 0.42)
    api.applyRandomize()
    api.applySeed('busy-seed')
    await nextTick()
    expect(api.doc.value.seed).toBe(seedBefore)
    expect(api.doc.value.params).toEqual(paramsBefore)

    resolveExport({ ok: true, blob: new Blob(['png'], { type: 'image/png' }) })
    await pending
    wrapper.unmount()
  })

  it('applyExport is ignored when WebGL is unavailable', async () => {
    vi.mocked(createRenderer).mockReturnValueOnce({
      ok: false,
      error: 'webgl2-unavailable',
    })
    const { api, wrapper } = mountComposable()
    const host = document.createElement('div')
    api.mountHost(host)

    await api.applyExport()
    expect(exportPng).not.toHaveBeenCalled()
    expect(api.jobState.value).toBe('idle')
    wrapper.unmount()
  })

  it('applyExport returns to idle when encode fails', async () => {
    const { api, wrapper } = mountComposable()
    const host = document.createElement('div')
    api.mountHost(host)
    vi.mocked(exportPng).mockResolvedValueOnce({ ok: false, error: 'webgl2-unavailable' })

    await api.applyExport()
    expect(api.jobState.value).toBe('idle')
    wrapper.unmount()
  })

  it('successful export triggers a tolos.png download', async () => {
    const { api, wrapper } = mountComposable()
    const host = document.createElement('div')
    api.mountHost(host)

    const blob = new Blob(['png'], { type: 'image/png' })
    vi.mocked(exportPng).mockResolvedValueOnce({ ok: true, blob })

    let downloaded: HTMLAnchorElement | undefined
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreate(tagName)
      if (tagName === 'a') {
        downloaded = el as HTMLAnchorElement
      }
      return el
    })

    await api.applyExport()

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:tolos-export')
    expect(downloaded).toBeDefined()
    expect(downloaded!.download).toBe('tolos.png')
    expect(downloaded!.getAttribute('href')).toBe('blob:tolos-export')

    wrapper.unmount()
  })
})
