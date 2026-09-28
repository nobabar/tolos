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

describe('ControlRail actions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders New exposure and inert Pull print', () => {
    const wrapper = mount(ControlRail, {
      props: {
        jobState: 'idle',
        doc: sampleDoc(),
        applyParam: mockApplyParam(),
        applyRandomize: vi.fn<() => void>(),
      },
    })

    expect(wrapper.text()).toContain('New exposure')
    expect(wrapper.text()).toContain('Pull print')
    expect(wrapper.find('.control-rail').attributes('aria-hidden')).toBeUndefined()
  })

  it('renders Softness, Grain, and Palette dials', () => {
    const wrapper = mount(ControlRail, {
      props: {
        jobState: 'idle',
        doc: sampleDoc(),
        applyParam: mockApplyParam(),
        applyRandomize: vi.fn<() => void>(),
      },
    })

    expect(wrapper.text()).toContain('Softness')
    expect(wrapper.text()).toContain('Grain')
    expect(wrapper.text()).toContain('Palette')
    expect(wrapper.findAll('input[type="range"]')).toHaveLength(3)
  })

  it('click New exposure invokes applyRandomize when idle', async () => {
    const applyRandomize = vi.fn<() => void>()
    const wrapper = mount(ControlRail, {
      props: {
        jobState: 'idle',
        doc: sampleDoc(),
        applyParam: mockApplyParam(),
        applyRandomize,
      },
    })

    await wrapper.get('button.btn-ghost').trigger('click')
    expect(applyRandomize).toHaveBeenCalledTimes(1)
  })

  it('New exposure is non-operative while exposing', async () => {
    const applyRandomize = vi.fn<() => void>()
    const wrapper = mount(ControlRail, {
      props: {
        jobState: 'exposing',
        doc: sampleDoc(),
        applyParam: mockApplyParam(),
        applyRandomize,
      },
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
      props: {
        jobState: 'exporting',
        doc: sampleDoc(),
        applyParam: mockApplyParam(),
        applyRandomize,
      },
    })

    const button = wrapper.get('button.btn-ghost')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(applyRandomize).not.toHaveBeenCalled()
  })

  it('Pull print is present and inert', async () => {
    const applyRandomize = vi.fn<() => void>()
    const wrapper = mount(ControlRail, {
      props: {
        jobState: 'idle',
        doc: sampleDoc(),
        applyParam: mockApplyParam(),
        applyRandomize,
      },
    })

    const pull = wrapper.get('button.btn-primary')
    expect(pull.text()).toContain('Pull print')
    expect(pull.attributes('disabled')).toBeDefined()
    await pull.trigger('click')
    expect(applyRandomize).not.toHaveBeenCalled()
  })

  it('dial input commits applyParam after debounce when idle', async () => {
    const applyParam = mockApplyParam()
    const doc = sampleDoc()
    const wrapper = mount(ControlRail, {
      props: {
        jobState: 'idle',
        doc,
        applyParam,
        applyRandomize: vi.fn<() => void>(),
      },
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
      props: {
        jobState: 'idle',
        doc: sampleDoc(),
        applyParam,
        applyRandomize: vi.fn<() => void>(),
      },
    })

    const softness = wrapper.get('input[type="range"]')
    await softness.setValue('0.42')
    await wrapper.setProps({ jobState: 'exposing' })
    await vi.advanceTimersByTimeAsync(150)
    expect(applyParam).not.toHaveBeenCalled()
  })

  it('dials are disabled while exposing', () => {
    const wrapper = mount(ControlRail, {
      props: {
        jobState: 'exposing',
        doc: sampleDoc(),
        applyParam: mockApplyParam(),
        applyRandomize: vi.fn<() => void>(),
      },
    })

    for (const input of wrapper.findAll('input[type="range"]')) {
      expect(input.attributes('disabled')).toBeDefined()
    }
  })
})
