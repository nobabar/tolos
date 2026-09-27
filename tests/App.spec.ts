import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import type { CreateRendererResult, Renderer } from '@/engine/render'

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

import { createRenderer } from '@/engine/render'
import App from '@/App.vue'

describe('App', () => {
  beforeEach(() => {
    vi.mocked(createRenderer).mockReset()
    vi.mocked(createRenderer).mockReturnValue({
      ok: true,
      renderer: {
        draw: vi.fn<Renderer['draw']>(),
        resize: vi.fn<Renderer['resize']>(),
        dispose: vi.fn<Renderer['dispose']>(),
      },
    })
  })

  it('cold open shows tolos brand on the darkroom bench', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('tolos')
    expect(wrapper.find('.bench').exists()).toBe(true)
    expect(wrapper.find('.print-stage').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('tolos needs WebGL in this browser.')
  })

  it('shows WebGL blocker copy when createRenderer fails', async () => {
    vi.mocked(createRenderer).mockReturnValue({
      ok: false,
      error: 'webgl2-unavailable',
    })
    const wrapper = mount(App)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('tolos')
    expect(wrapper.text()).toContain('tolos needs WebGL in this browser.')
    expect(wrapper.find('.print-stage__blocker').exists()).toBe(true)
    expect(wrapper.find('[data-quality-standin]').exists()).toBe(false)
    expect(wrapper.find('.print-stage__host canvas').exists()).toBe(false)
    expect(wrapper.find('.control-rail').exists()).toBe(false)
  })
})
