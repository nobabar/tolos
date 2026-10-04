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
    applyLookFamilyMode: UseGradientDocument['applyLookFamilyMode']
    applyLookFamily: UseGradientDocument['applyLookFamily']
    applyParamLock: UseGradientDocument['applyParamLock']
    applyRandomize: () => void
    applySeed: UseGradientDocument['applySeed']
    applyExport: () => Promise<void>
  }> = {},
) {
  return {
    jobState: 'idle' as const,
    doc: sampleDoc(),
    applyParam: mockApplyParam(),
    applyLookFamilyMode: vi.fn<UseGradientDocument['applyLookFamilyMode']>(),
    applyLookFamily: vi.fn<UseGradientDocument['applyLookFamily']>(),
    applyParamLock: vi.fn<UseGradientDocument['applyParamLock']>(),
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

    expect(wrapper.find('.control-rail').classes()).toContain('is-disabled')
    const pull = wrapper.get('button.btn-primary')
    expect(pull.attributes('disabled')).toBeUndefined()
    expect(pull.attributes('aria-disabled')).toBe('true')
    expect(pull.attributes('tabindex')).toBe('0')
    expect(pull.classes()).toContain('is-disabled')
    expect(pull.text()).toContain('Pull print')
    expect(pull.text()).not.toContain('Pulling print...')
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

  it('renders five look-family mode options with accessible names including Bloom', () => {
    const wrapper = mount(ControlRail, {
      props: railProps(),
    })

    const group = wrapper.get('[role="radiogroup"]')
    expect(group.attributes('aria-label')).toBe('Look family')
    expect(wrapper.text()).toContain('Random')
    expect(wrapper.text()).toContain('Blob')
    expect(wrapper.text()).toContain('Flow')
    expect(wrapper.text()).toContain('Silk')
    expect(wrapper.text()).toContain('Bloom')
    expect(group.findAll('[role="radio"]')).toHaveLength(5)
  })

  it('renders dial lock controls with accessible names', () => {
    const wrapper = mount(ControlRail, {
      props: railProps(),
    })

    expect(wrapper.find('[aria-label="Lock Softness"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Lock Grain"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Lock Palette"]').exists()).toBe(true)
  })

  it('places mode control before dials in DOM order', () => {
    const wrapper = mount(ControlRail, {
      props: railProps(),
    })

    const mode = wrapper.get('[role="radiogroup"]').element
    const dials = wrapper.get('.control-rail__dials').element
    const position = mode.compareDocumentPosition(dials)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('idle mode click invokes applyLookFamilyMode', async () => {
    const applyLookFamilyMode = vi.fn<UseGradientDocument['applyLookFamilyMode']>()
    const wrapper = mount(ControlRail, {
      props: railProps({ applyLookFamilyMode }),
    })

    const radios = wrapper.findAll('[role="radio"]')
    const flow = radios.find((btn) => btn.text() === 'Flow')
    expect(flow).toBeDefined()
    await flow!.trigger('click')
    expect(applyLookFamilyMode).toHaveBeenCalledWith('flow')
  })

  it('idle lock click invokes applyParamLock', async () => {
    const applyParamLock = vi.fn<UseGradientDocument['applyParamLock']>()
    const wrapper = mount(ControlRail, {
      props: railProps({ applyParamLock }),
    })

    await wrapper.get('[aria-label="Lock Softness"]').trigger('click')
    expect(applyParamLock).toHaveBeenCalledWith('softness', true)
  })

  it('mode and lock controls are non-operative while exposing', async () => {
    const applyLookFamilyMode = vi.fn<UseGradientDocument['applyLookFamilyMode']>()
    const applyParamLock = vi.fn<UseGradientDocument['applyParamLock']>()
    const wrapper = mount(ControlRail, {
      props: railProps({
        jobState: 'exposing',
        applyLookFamilyMode,
        applyParamLock,
      }),
    })

    for (const radio of wrapper.findAll('[role="radio"]')) {
      expect(radio.attributes('disabled')).toBeDefined()
      await radio.trigger('click')
    }
    expect(applyLookFamilyMode).not.toHaveBeenCalled()

    const lock = wrapper.get('[aria-label="Lock Softness"]')
    expect(lock.attributes('disabled')).toBeDefined()
    await lock.trigger('click')
    expect(applyParamLock).not.toHaveBeenCalled()
  })

  it('mode and lock controls are non-operative while exporting', async () => {
    const applyLookFamilyMode = vi.fn<UseGradientDocument['applyLookFamilyMode']>()
    const applyParamLock = vi.fn<UseGradientDocument['applyParamLock']>()
    const wrapper = mount(ControlRail, {
      props: railProps({
        jobState: 'exporting',
        applyLookFamilyMode,
        applyParamLock,
      }),
    })

    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')
    await wrapper.get('[aria-label="Lock Grain"]').trigger('click')
    expect(applyLookFamilyMode).not.toHaveBeenCalled()
    expect(applyParamLock).not.toHaveBeenCalled()
  })

  it('reflects current lookFamilyMode on the selected segment', () => {
    const doc = sampleDoc()
    doc.lookFamilyMode = 'silk'
    const wrapper = mount(ControlRail, {
      props: railProps({ doc }),
    })

    const silk = wrapper.findAll('[role="radio"]').find((btn) => btn.text() === 'Silk')
    expect(silk).toBeDefined()
    expect(silk!.attributes('aria-checked')).toBe('true')
    expect(silk!.classes()).toContain('is-selected')
  })
})
