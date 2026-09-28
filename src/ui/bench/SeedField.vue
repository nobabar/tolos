<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import type { ApplySeedResult } from './use-gradient-document'

const props = defineProps<{
  seed: string
  disabled?: boolean
  applySeed: (seed: string) => ApplySeedResult
}>()

const draft = ref(props.seed)
const editing = ref(false)
const error = ref<string | null>(null)
const copied = ref(false)

let copiedTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.seed,
  (seed) => {
    if (!editing.value) draft.value = seed
  },
)

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})

function onFocus(): void {
  editing.value = true
  error.value = null
}

function onBlur(): void {
  editing.value = false
  if (error.value === null) draft.value = props.seed
}

function onInput(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  draft.value = target.value
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter') return
  event.preventDefault()
  if (props.disabled) return
  const result = props.applySeed(draft.value)
  if (result === 'invalid') {
    error.value = 'Seed not recognized.'
    return
  }
  error.value = null
  editing.value = false
}

async function onCopy(): Promise<void> {
  if (props.disabled) return
  try {
    await navigator.clipboard.writeText(props.seed)
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = false
      copiedTimer = null
    }, 1500)
  } catch {
    // Soft fail: leave prior print and field as-is.
  }
}
</script>

<template>
  <div class="seed-field" :class="{ 'is-disabled': disabled }">
    <div class="seed-field__header">
      <label class="seed-field__label" for="seed-input">Seed</label>
      <button
        type="button"
        class="seed-field__copy"
        :class="{ 'is-disabled': disabled }"
        :disabled="disabled"
        @click="onCopy"
      >
        Copy
      </button>
    </div>
    <input
      id="seed-input"
      class="seed-field__input"
      type="text"
      spellcheck="false"
      autocomplete="off"
      :value="draft"
      :disabled="disabled"
      @focus="onFocus"
      @blur="onBlur"
      @input="onInput"
      @keydown="onKeydown"
    />
    <p v-if="error" class="seed-field__feedback seed-field__feedback--error" role="status">
      {{ error }}
    </p>
    <p v-else-if="copied" class="seed-field__feedback" role="status">Copied.</p>
  </div>
</template>

<style scoped>
.seed-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.seed-field__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.seed-field__label {
  font-family: var(--font-ui);
  font-size: var(--type-label-size);
  font-weight: var(--type-label-weight);
  line-height: var(--type-label-line);
  letter-spacing: var(--type-label-tracking);
  text-transform: uppercase;
  color: var(--color-on-surface-muted);
}

.seed-field__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  margin: calc(var(--space-2) * -1) calc(var(--space-2) * -1) calc(var(--space-2) * -1) 0;
  background: transparent;
  border: none;
  padding: var(--space-2);
  font-family: var(--font-ui);
  font-size: var(--type-label-size);
  font-weight: var(--type-label-weight);
  line-height: var(--type-label-line);
  letter-spacing: var(--type-label-tracking);
  text-transform: uppercase;
  color: var(--color-on-surface);
  cursor: pointer;
}

.seed-field__copy:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.seed-field__copy.is-disabled {
  color: var(--color-on-surface-faint);
  opacity: 0.45;
  cursor: not-allowed;
}

.seed-field__input {
  width: 100%;
  min-height: 44px;
  padding: var(--space-3) var(--space-3);
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-outline);
  border-radius: var(--rounded);
  color: var(--color-on-surface);
  font-family: var(--font-mono);
  font-size: var(--type-mono-size);
  font-weight: var(--type-mono-weight);
  line-height: var(--type-mono-line);
  letter-spacing: var(--type-mono-tracking);
}

.seed-field__input:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.seed-field__input:disabled {
  color: var(--color-on-surface-faint);
  opacity: 0.45;
  cursor: not-allowed;
}

.seed-field__feedback {
  margin: 0;
  font-family: var(--font-ui);
  font-size: var(--type-label-size);
  font-weight: var(--type-label-weight);
  line-height: var(--type-label-line);
  color: var(--color-on-surface-muted);
}

.seed-field__feedback--error {
  color: var(--color-on-surface-muted);
}
</style>
