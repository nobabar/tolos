import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import ControlRail from '@/ui/bench/ControlRail.vue'

describe('ControlRail actions', () => {
  it('renders New exposure and inert Pull print', () => {
    const wrapper = mount(ControlRail, {
      props: {
        jobState: 'idle',
        applyRandomize: vi.fn<() => void>(),
      },
    })

    expect(wrapper.text()).toContain('New exposure')
    expect(wrapper.text()).toContain('Pull print')
    expect(wrapper.find('.control-rail').attributes('aria-hidden')).toBeUndefined()
  })

  it('click New exposure invokes applyRandomize when idle', async () => {
    const applyRandomize = vi.fn<() => void>()
    const wrapper = mount(ControlRail, {
      props: {
        jobState: 'idle',
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
        applyRandomize,
      },
    })

    const pull = wrapper.get('button.btn-primary')
    expect(pull.text()).toContain('Pull print')
    expect(pull.attributes('disabled')).toBeDefined()
    await pull.trigger('click')
    expect(applyRandomize).not.toHaveBeenCalled()
  })
})
