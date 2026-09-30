import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

import { createDocument, createOpaqueSeed } from '@/engine/document'
import ControlRail from '@/ui/bench/ControlRail.vue'
import type { UseGradientDocument } from '@/ui/bench/use-gradient-document'

function sampleDoc() {
  return createDocument(createOpaqueSeed())
}

function mockApplyParam() {
  return vi.fn<UseGradientDocument['applyParam']>()
}

function railProps(
  overrides: Partial<{
    jobState: 'idle' | 'exposing' | 'exporting'
    doc: ReturnType<typeof sampleDoc>
    applyParam: UseGradientDocument['applyParam']
    applyRandomize: () => void
    applySeed: UseGradientDocument['applySeed']
    applyExport: () => Promise<void>
  }> = {},
) {
  return {
    jobState: 'idle' as const,
    doc: sampleDoc(),
    applyParam: mockApplyParam(),
    applyRandomize: vi.fn<() => void>(),
    applySeed: vi.fn<UseGradientDocument['applySeed']>(() => 'ok'),
    applyExport: vi.fn<() => Promise<void>>(async () => {}),
    ...overrides,
  }
}

describe('ControlRail actions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders New exposure and operative Pull print when idle', () => {
    const wrapper = mount(ControlRail, {
      props: railProps(),
    })

    expect(wrapper.text()).toContain('New exposure')
    expect(wrapper.text()).toContain('Pull print')
    expect(wrapper.find('.control-rail').attributes('aria-hidden')).toBeUndefined()

    const pull = wrapper.get('button.btn-primary')
    expect(pull.attributes('aria-disabled')).toBeUndefined()
    expect(pull.classes()).not.toContain('is-disabled')
  })

  it('renders Softness, Grain, and Palette dials', () => {
    const wrapper = mount(ControlRail, {
      props: railProps(),
    })

    expect(wrapper.text()).toContain('Softness')
    expect(wrapper.text()).toContain('Grain')
    expect(wrapper.text()).toContain('Palette')
    expect(wrapper.findAll('input[type="range"]')).toHaveLength(3)
  })

  it('renders Seed field between dials and actions', () => {
    const doc = sampleDoc()
    const wrapper = mount(ControlRail, {
      props: railProps({ doc }),
    })

    expect(wrapper.text()).toContain('Seed')
    expect(wrapper.get('#seed-input').element).toHaveProperty('value', doc.seed)
  })

  it('click New exposure invokes applyRandomize when idle', async () => {
    const applyRandomize = vi.fn<() => void>()
    const wrapper = mount(ControlRail, {
      props: railProps({ applyRandomize }),
    })

    await wrapper.get('button.btn-ghost').trigger('click')
    expect(applyRandomize).toHaveBeenCalledTimes(1)
  })

  it('New exposure is non-operative while exposing', async () => {
    const applyRandomize = vi.fn<() => void>()
    const wrapper = mount(ControlRail, {
      props: railProps({ jobState: 'exposing', applyRandomize }),
    })

    const button = wrapper.get('button.btn-ghost')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.classes()).toContain('is-disabled')
    await button.trigger('click')
    expect(applyRandomize).not.toHaveBeenCalled()
  })

  it('New exposure is non-operative while exporting', async () => {
    const applyRandomize = vi.fn<() => void>()
    const wrapper = mount(ControlRail, {
      props: railProps({ jobState: 'exporting', applyRandomize }),
    })

    const button = wrapper.get('button.btn-ghost')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(applyRandomize).not.toHaveBeenCalled()
  })

  it('idle click on Pull print calls applyExport once', async () => {
    const applyExport = vi.fn<() => Promise<void>>(async () => {})
    const wrapper = mount(ControlRail, {
      props: railProps({ applyExport }),
    })

    const pull = wrapper.get('button.btn-primary')
    expect(pull.text()).toContain('Pull print')
    expect(pull.attributes('disabled')).toBeUndefined()
    expect(pull.attributes('aria-disabled')).toBeUndefined()
    await pull.trigger('click')
    expect(applyExport).toHaveBeenCalledTimes(1)
  })

  it('Pull print is non-operative while exposing and stays in tab order', async () => {
    const applyExport = vi.fn<() => Promise<void>>(async () => {})
    const wrapper = mount(ControlRail, {
      props: railProps({ jobState: 'exposing', applyExport }),
    })

    const pull = wrapper.get('button.btn-primary')
    expect(pull.attributes('disabled')).toBeUndefined()
    expect(pull.attributes('aria-disabled')).toBe('true')
    expect(pull.attributes('tabindex')).toBe('0')
    expect(pull.classes()).toContain('is-disabled')
    await pull.trigger('click')
    expect(applyExport).not.toHaveBeenCalled()
  })

  it('shows Pulling print... while exporting and ignores click', async () => {
    const applyExport = vi.fn<() => Promise<void>>(async () => {})
    const wrapper = mount(ControlRail, {
      props: railProps({ jobState: 'exporting', applyExport }),
    })

    const pull = wrapper.get('button.btn-primary')
    expect(pull.text()).toContain('Pulling print...')
    expect(pull.attributes('aria-disabled')).toBe('true')
    expect(pull.classes()).toContain('is-disabled')
    await pull.trigger('click')
    expect(applyExport).not.toHaveBeenCalled()
  })

  it('shows quiet ~1920px resolution hint beneath Pull print', () => {
    const wrapper = mount(ControlRail, {
      props: railProps(),
    })

    expect(wrapper.text()).toContain('~1920px')
    expect(wrapper.find('.control-rail__hint').exists()).toBe(true)
  })

  it('dial aria-valuetext announces name and value', () => {
    const doc = sampleDoc()
    const wrapper = mount(ControlRail, {
      props: railProps({ doc }),
    })

    const softness = wrapper.get('#dial-Softness')
    const amount = doc.params.softness.amount.toFixed(2)
    expect(softness.attributes('aria-valuetext')).toBe(`Softness ${amount}`)
  })

  it('dial input commits applyParam after debounce when idle', async () => {
    const applyParam = mockApplyParam()
    const doc = sampleDoc()
    const wrapper = mount(ControlRail, {
      props: railProps({ doc, applyParam }),
    })

    const softness = wrapper.get('input[type="range"]')
    await softness.setValue('0.42')
    expect(applyParam).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(150)
    expect(applyParam).toHaveBeenCalledWith('softness', 'amount', 0.42)
  })

  it('dial commit is dropped when job becomes busy before debounce fires', async () => {
    const applyParam = mockApplyParam()
    const wrapper = mount(ControlRail, {
      props: railProps({ applyParam }),
    })

    const softness = wrapper.get('input[type="range"]')
    await softness.setValue('0.42')
    await wrapper.setProps({ jobState: 'exposing' })
    await vi.advanceTimersByTimeAsync(150)
    expect(applyParam).not.toHaveBeenCalled()
  })

  it('dials are disabled while exposing', () => {
    const wrapper = mount(ControlRail, {
      props: railProps({ jobState: 'exposing' }),
    })

    for (const input of wrapper.findAll('input[type="range"]')) {
      expect(input.attributes('disabled')).toBeDefined()
    }
  })

  it('seed field is disabled while exposing', () => {
    const wrapper = mount(ControlRail, {
      props: railProps({ jobState: 'exposing' }),
    })

    expect(wrapper.get('#seed-input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.seed-field__copy').attributes('disabled')).toBeDefined()
  })
})
