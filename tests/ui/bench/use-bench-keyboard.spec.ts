import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

import { useBenchKeyboard } from '@/ui/bench/use-bench-keyboard'
import type { JobState } from '@/ui/bench/use-gradient-document'

function mountKeyboardHost(options: {
  jobState?: JobState
  applyRandomize?: () => void
  applyExport?: () => Promise<void>
}) {
  const jobState = ref<JobState>(options.jobState ?? 'idle')
  const applyRandomize = options.applyRandomize ?? vi.fn<() => void>()
  const applyExport = options.applyExport ?? vi.fn<() => Promise<void>>(async () => {})

  const Host = defineComponent({
    setup() {
      useBenchKeyboard({ jobState, applyRandomize, applyExport })
      return () =>
        h('div', [
          h('input', { id: 'seed-input', type: 'text' }),
          h('button', { type: 'button' }, 'New exposure'),
        ])
    },
  })

  const wrapper = mount(Host, { attachTo: document.body })
  return { wrapper, jobState, applyRandomize, applyExport }
}

describe('useBenchKeyboard', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('R triggers applyRandomize when idle', async () => {
    const applyRandomize = vi.fn<() => void>()
    const { wrapper } = mountKeyboardHost({ applyRandomize })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', bubbles: true }))
    await nextTick()
    expect(applyRandomize).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('Space triggers applyRandomize when idle', async () => {
    const applyRandomize = vi.fn<() => void>()
    const { wrapper } = mountKeyboardHost({ applyRandomize })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await nextTick()
    expect(applyRandomize).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('ignores R and Space while exposing', async () => {
    const applyRandomize = vi.fn<() => void>()
    const { wrapper } = mountKeyboardHost({ jobState: 'exposing', applyRandomize })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await nextTick()
    expect(applyRandomize).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('ignores R and Space while exporting', async () => {
    const applyRandomize = vi.fn<() => void>()
    const { wrapper } = mountKeyboardHost({ jobState: 'exporting', applyRandomize })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await nextTick()
    expect(applyRandomize).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('ignores shortcuts when focus is in the seed input', async () => {
    const applyRandomize = vi.fn<() => void>()
    const { wrapper } = mountKeyboardHost({ applyRandomize })

    const input = document.getElementById('seed-input')
    expect(input).toBeTruthy()
    input!.focus()

    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', bubbles: true }))
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await nextTick()
    expect(applyRandomize).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('does not steal Space from a focused button', async () => {
    const applyRandomize = vi.fn<() => void>()
    const { wrapper } = mountKeyboardHost({ applyRandomize })

    const button = wrapper.get('button').element
    button.focus()
    button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await nextTick()
    expect(applyRandomize).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('Cmd+Enter calls applyExport when idle', async () => {
    const applyExport = vi.fn<() => Promise<void>>(async () => {})
    const { wrapper } = mountKeyboardHost({ applyExport })

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }),
    )
    await nextTick()
    expect(applyExport).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('Ctrl+Enter calls applyExport when idle', async () => {
    const applyExport = vi.fn<() => Promise<void>>(async () => {})
    const { wrapper } = mountKeyboardHost({ applyExport })

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    )
    await nextTick()
    expect(applyExport).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('ignores Cmd+Enter while exposing or exporting', async () => {
    const applyExport = vi.fn<() => Promise<void>>(async () => {})
    const { wrapper, jobState } = mountKeyboardHost({ jobState: 'exposing', applyExport })

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }),
    )
    await nextTick()
    expect(applyExport).not.toHaveBeenCalled()

    jobState.value = 'exporting'
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    )
    await nextTick()
    expect(applyExport).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('Cmd+Enter from seed input still calls applyExport', async () => {
    const applyExport = vi.fn<() => Promise<void>>(async () => {})
    const { wrapper } = mountKeyboardHost({ applyExport })

    const input = document.getElementById('seed-input')
    expect(input).toBeTruthy()
    input!.focus()

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    input!.dispatchEvent(event)
    await nextTick()
    expect(applyExport).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)

    wrapper.unmount()
  })
})
