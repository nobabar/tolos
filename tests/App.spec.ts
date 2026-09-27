import { describe, it, expect, vi } from 'vitest'
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

import App from '@/App.vue'

describe('App', () => {
  it('cold open shows tolos brand on the darkroom bench', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('tolos')
    expect(wrapper.find('.bench').exists()).toBe(true)
    expect(wrapper.find('.print-stage').exists()).toBe(true)
  })
})
