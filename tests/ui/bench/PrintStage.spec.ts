import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import PrintStage from '@/ui/bench/PrintStage.vue'

describe('PrintStage WebGL blocker', () => {
  it('shows EXPERIENCE blocker copy when WebGL2 is unavailable', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: 'webgl2-unavailable',
      },
    })

    expect(wrapper.text()).toContain('tolos needs WebGL in this browser.')
    expect(wrapper.find('.print-stage__blocker').exists()).toBe(true)
  })

  it('does not paint a CSS quality stand-in when blocked', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: 'webgl2-unavailable',
      },
    })

    const host = wrapper.find('.print-stage__host')
    expect(host.exists()).toBe(true)
    expect(host.element.querySelector('canvas')).toBeNull()

    const hostStyle = getComputedStyle(host.element)
    expect(hostStyle.backgroundImage).toBe('none')
    expect(wrapper.find('[data-quality-standin]').exists()).toBe(false)
  })

  it('does not mount the blocker when render succeeds', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: null,
      },
    })

    expect(wrapper.find('.print-stage__blocker').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('tolos needs WebGL in this browser.')
  })
})
