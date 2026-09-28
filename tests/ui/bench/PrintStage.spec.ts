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
  it('shows veil and Exposing... label while exposing', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: null,
        jobState: 'exposing',
      },
    })

    expect(wrapper.find('.print-stage__veil').exists()).toBe(true)
    expect(wrapper.text()).toContain('Exposing...')
  })

  it('announces Exposing... via aria-live polite', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: null,
        jobState: 'exposing',
      },
    })

    const live = wrapper.get('[aria-live="polite"]')
    expect(live.text()).toContain('Exposing...')
  })

  it('hides exposing veil when idle', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: null,
        jobState: 'idle',
      },
    })

    expect(wrapper.find('.print-stage__veil').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Exposing...')
  })

  it('does not show exposing veil over the WebGL blocker', () => {
    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: 'webgl2-unavailable',
        jobState: 'exposing',
      },
    })

    expect(wrapper.find('.print-stage__veil').exists()).toBe(false)
    expect(wrapper.find('.print-stage__blocker').exists()).toBe(true)
  })

  it('snaps exposing veil when prefers-reduced-motion is set', async () => {
    const matchMedia = vi.fn<(query: string) => MediaQueryList>((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn<() => void>(),
      removeListener: vi.fn<() => void>(),
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
      dispatchEvent: vi.fn<() => boolean>(() => false),
    }))
    vi.stubGlobal('matchMedia', matchMedia)

    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: null,
        jobState: 'exposing',
      },
    })
    await wrapper.vm.$nextTick()

    const veil = wrapper.get('.print-stage__veil')
    expect(veil.attributes('data-motion')).toBe('reduce')
    expect(veil.classes()).not.toContain('print-stage__veil--fade')

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('uses fade class when motion is allowed', async () => {
    const matchMedia = vi.fn<(query: string) => MediaQueryList>((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn<() => void>(),
      removeListener: vi.fn<() => void>(),
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
      dispatchEvent: vi.fn<() => boolean>(() => false),
    }))
    vi.stubGlobal('matchMedia', matchMedia)

    const wrapper = mount(PrintStage, {
      props: {
        mountHost: vi.fn<(host: HTMLElement) => void>(),
        renderError: null,
        jobState: 'exposing',
      },
    })
    await wrapper.vm.$nextTick()

    const veil = wrapper.get('.print-stage__veil')
    expect(veil.attributes('data-motion')).toBe('ok')
    expect(veil.classes()).toContain('print-stage__veil--fade')

    wrapper.unmount()
    vi.unstubAllGlobals()
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
