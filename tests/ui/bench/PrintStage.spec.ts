import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import PrintStage from '@/ui/bench/PrintStage.vue'

describe('PrintStage WebGL blocker', () => {
  it('shows EXPERIENCE blocker copy when WebGL2 is unavailable', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: 'webgl2-unavailable',
        jobState: 'idle',
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
        jobState: 'idle',
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
        jobState: 'idle',
      },
    })

    expect(wrapper.find('.print-stage__blocker').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('tolos needs WebGL in this browser.')
  })
})

describe('PrintStage exposing chrome', () => {
  it('announces Exposing... via aria-live polite while progressive stages run', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: null,
        jobState: 'exposing',
      },
    })

    const status = wrapper.get('[role="status"][aria-live="polite"]')
    expect(status.text()).toContain('Exposing...')
    expect(wrapper.find('.print-stage__status').exists()).toBe(true)
  })

  it('does not use a heavy opaque veil as the primary progress signal', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: null,
        jobState: 'exposing',
      },
    })

    // Progressive stages on the print are the progress read; no opaque veil cover.
    expect(wrapper.find('.print-stage__veil').exists()).toBe(false)
    expect(wrapper.find('.print-stage__status').exists()).toBe(true)
    expect(wrapper.find('.print-stage__status--opaque').exists()).toBe(false)
  })

  it('keeps a readable label chip while stages remain visible', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: null,
        jobState: 'exposing',
      },
    })

    const label = wrapper.get('.print-stage__exposing-label')
    expect(label.text()).toBe('Exposing...')
    expect(label.classes()).toContain('print-stage__exposing-label')
  })

  it('does not show exposing status while exporting', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: null,
        jobState: 'exporting',
      },
    })

    expect(wrapper.find('.print-stage__status').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Exposing...')
  })

  it('hides exposing status when idle', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: null,
        jobState: 'idle',
      },
    })

    expect(wrapper.find('.print-stage__status').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Exposing...')
  })

  it('does not show exposing status over the WebGL blocker', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: 'webgl2-unavailable',
        jobState: 'exposing',
      },
    })

    expect(wrapper.find('.print-stage__status').exists()).toBe(false)
    expect(wrapper.find('.print-stage__veil').exists()).toBe(false)
    expect(wrapper.find('.print-stage__blocker').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Exposing...')
  })

  it('print host is focusable for tab order', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: null,
        jobState: 'idle',
      },
    })

    const host = wrapper.get('[data-testid="print-host"]')
    expect(host.attributes('tabindex')).toBe('0')
    expect(host.attributes('role')).toBe('img')
  })
})
