<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  modelValue: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const display = computed(() => props.modelValue.toFixed(2))

const percent = computed(() => `${Math.round(props.modelValue * 100)}%`)

function onInput(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  emit('update:modelValue', Number(target.value))
}
</script>

<template>
  <div class="dial" :class="{ 'is-disabled': disabled }">
    <div class="dial__header">
      <label class="dial__label" :for="`dial-${label}`">{{ label }}</label>
      <span class="dial__value" aria-hidden="true">{{ display }}</span>
    </div>
    <div class="dial__row">
      <div class="dial__track-wrap">
        <div class="dial__fill" :style="{ width: percent }" />
        <input
          :id="`dial-${label}`"
          class="dial__input"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="modelValue"
          :disabled="disabled"
          :aria-valuetext="display"
          @input="onInput"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dial {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.dial__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.dial__label {
  font-family: var(--font-ui);
  font-size: var(--type-label-size);
  font-weight: var(--type-label-weight);
  line-height: var(--type-label-line);
  letter-spacing: var(--type-label-tracking);
  text-transform: uppercase;
  color: var(--color-on-surface-muted);
}

.dial__value {
  font-family: var(--font-mono);
  font-size: var(--type-mono-size);
  font-weight: var(--type-mono-weight);
  line-height: var(--type-mono-line);
  letter-spacing: var(--type-mono-tracking);
  color: var(--color-on-surface);
  min-width: 2.25rem;
  text-align: right;
}

.dial__row {
  display: flex;
  align-items: center;
}

.dial__track-wrap {
  position: relative;
  flex: 1;
  height: 14px;
  display: flex;
  align-items: center;
}

.dial__track-wrap::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 4px;
  margin-top: -2px;
  border-radius: var(--rounded-sm);
  background: var(--color-outline);
  pointer-events: none;
  z-index: 0;
}

.dial__fill {
  position: absolute;
  left: 0;
  top: 50%;
  height: 4px;
  margin-top: -2px;
  border-radius: var(--rounded-sm);
  background: var(--color-primary-muted);
  pointer-events: none;
  z-index: 1;
}

.dial__input {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 44px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.dial__input::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: var(--rounded-sm);
  background: transparent;
}

.dial__input::-moz-range-track {
  height: 4px;
  border-radius: var(--rounded-sm);
  background: transparent;
}

.dial__input::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5px;
  border-radius: var(--rounded-sm);
  background: var(--color-on-surface);
  box-shadow: 0 0 0 1px var(--color-outline);
  cursor: pointer;
}

.dial__input::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: none;
  border-radius: var(--rounded-sm);
  background: var(--color-on-surface);
  box-shadow: 0 0 0 1px var(--color-outline);
  cursor: pointer;
}

.dial__input:focus-visible {
  outline: none;
}

.dial__input:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.dial__input:focus-visible::-moz-range-thumb {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.dial.is-disabled {
  opacity: 0.45;
}

.dial.is-disabled .dial__label,
.dial.is-disabled .dial__value {
  color: var(--color-on-surface-faint);
}

.dial.is-disabled .dial__input {
  cursor: not-allowed;
}

.dial.is-disabled .dial__input::-webkit-slider-thumb {
  background: var(--color-on-surface-muted);
}

.dial.is-disabled .dial__input::-moz-range-thumb {
  background: var(--color-on-surface-muted);
}
</style>
