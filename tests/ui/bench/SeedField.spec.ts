import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

import SeedField from '@/ui/bench/SeedField.vue'
import type { ApplySeedResult } from '@/ui/bench/use-gradient-document'

describe('SeedField', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows the current seed in the mono field', () => {
    const wrapper = mount(SeedField, {
      props: {
        seed: 'visible-seed',
        applySeed: vi.fn<() => ApplySeedResult>(() => 'ok'),
      },
    })

    expect(wrapper.text()).toContain('Seed')
    expect(wrapper.get('#seed-input').element).toHaveProperty('value', 'visible-seed')
  })

  it('Copy writes the seed string and shows Copied. feedback', async () => {
    const writeText = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const wrapper = mount(SeedField, {
      props: {
        seed: 'copy-me',
        applySeed: vi.fn<() => ApplySeedResult>(() => 'ok'),
      },
    })

    await wrapper.get('.seed-field__copy').trigger('click')
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('copy-me')
    expect(wrapper.text()).toContain('Copied.')
  })

  it('Enter with blank draft shows Seed not recognized. and keeps draft', async () => {
    const applySeed = vi.fn<() => ApplySeedResult>(() => 'invalid')
    const wrapper = mount(SeedField, {
      props: {
        seed: 'good-seed',
        applySeed,
      },
    })

    const input = wrapper.get('#seed-input')
    await input.trigger('focus')
    await input.setValue('   ')
    await input.trigger('keydown', { key: 'Enter' })

    expect(applySeed).toHaveBeenCalledWith('   ')
    expect(wrapper.text()).toContain('Seed not recognized.')
    expect((input.element as HTMLInputElement).value).toBe('   ')
  })

  it('Enter commits a valid draft through applySeed', async () => {
    const applySeed = vi.fn<() => ApplySeedResult>(() => 'ok')
    const wrapper = mount(SeedField, {
      props: {
        seed: 'good-seed',
        applySeed,
      },
    })

    const input = wrapper.get('#seed-input')
    await input.trigger('focus')
    await input.setValue('restored-seed')
    await input.trigger('keydown', { key: 'Enter' })

    expect(applySeed).toHaveBeenCalledWith('restored-seed')
    expect(wrapper.text()).not.toContain('Seed not recognized.')
  })

  it('does not commit while disabled', async () => {
    const applySeed = vi.fn<() => ApplySeedResult>(() => 'ok')
    const wrapper = mount(SeedField, {
      props: {
        seed: 'good-seed',
        disabled: true,
        applySeed,
      },
    })

    const input = wrapper.get('#seed-input')
    expect(input.attributes('disabled')).toBeDefined()
    await input.trigger('keydown', { key: 'Enter' })
    expect(applySeed).not.toHaveBeenCalled()
  })
})
