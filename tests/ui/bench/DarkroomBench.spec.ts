import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'

import type { CreateRendererResult, Renderer } from '@/engine/render'
import { createDocument, createOpaqueSeed } from '@/engine/document'
import DarkroomBench from '@/ui/bench/DarkroomBench.vue'
import type { ApplySeedResult, UseGradientDocument } from '@/ui/bench/use-gradient-document'

const applyRandomize = vi.fn<() => void>()
const applyExport = vi.fn<() => Promise<void>>(async () => {})
const jobState = ref<'idle' | 'exposing' | 'exporting'>('idle')

vi.mock('@/engine/render', () => ({
  createRenderer: vi.fn<() => CreateRendererResult>(() => ({
    ok: true,
    renderer: {
      draw: vi.fn<Renderer['draw']>(),
      resize: vi.fn<Renderer['resize']>(),
      dispose: vi.fn<Renderer['dispose']>(),
    },
  })),
}))

vi.mock('@/ui/bench/use-gradient-document', async () => {
  const actual = await vi.importActual<typeof import('@/ui/bench/use-gradient-document')>(
    '@/ui/bench/use-gradient-document',
  )
  return {
    ...actual,
    useGradientDocument: () => {
      const doc = ref(createDocument(createOpaqueSeed()))
      const renderError = ref(null)
      return {
        doc,
        jobState,
        renderError,
        mountHost: vi.fn<UseGradientDocument['mountHost']>(),
        applyParam: vi.fn<UseGradientDocument['applyParam']>(),
        applyRandomize,
        applySeed: vi.fn<() => ApplySeedResult>(() => 'ok'),
        applyExport,
      }
    },
  }
})

describe('DarkroomBench instrument chrome', () => {
  beforeEach(() => {
    applyRandomize.mockClear()
    applyExport.mockClear()
    jobState.value = 'idle'
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('places brand skip before the print stage in tab order', () => {
    const wrapper = mount(DarkroomBench, { attachTo: document.body })

    const skip = wrapper.get('[data-testid="bench-skip"]')
    const print = wrapper.get('[data-testid="print-host"]')
    expect(skip.attributes('tabindex')).toBeUndefined()
    expect(print.attributes('tabindex')).toBe('0')

    const focusables = wrapper.element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    expect(focusables[0]).toBe(skip.element)

    wrapper.unmount()
  })

  it('skip control moves focus to the print host', async () => {
    const wrapper = mount(DarkroomBench, { attachTo: document.body })

    await wrapper.get('[data-testid="bench-skip"]').trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('[data-testid="print-host"]').element)

    wrapper.unmount()
  })

  it('Pull print is operative when idle and stays in tab order when busy', async () => {
    const wrapper = mount(DarkroomBench, { attachTo: document.body })

    const pull = wrapper.get('button.btn-primary')
    expect(pull.attributes('disabled')).toBeUndefined()
    expect(pull.attributes('aria-disabled')).toBeUndefined()
    expect(pull.classes()).not.toContain('is-disabled')

    await pull.trigger('click')
    expect(applyExport).toHaveBeenCalledTimes(1)

    jobState.value = 'exposing'
    await nextTick()
    expect(pull.attributes('aria-disabled')).toBe('true')
    expect(pull.attributes('tabindex')).toBe('0')

    wrapper.unmount()
  })

  it('uses DESIGN bench spacing tokens on the shell', () => {
    const wrapper = mount(DarkroomBench, { attachTo: document.body })
    const bench = wrapper.get('.bench')
    expect(getComputedStyle(bench.element).getPropertyValue('gap') || '').toBeDefined()
    expect(wrapper.find('.brand-mark').exists()).toBe(true)
    expect(wrapper.find('.control-rail').exists()).toBe(true)

    wrapper.unmount()
  })
})
