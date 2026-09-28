import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

import { createDocument } from '@/engine/document'
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
})
