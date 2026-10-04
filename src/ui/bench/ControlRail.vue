<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { GradientDocument, LookFamilyMode } from '@/engine/document'
import ParamDial from './ParamDial.vue'
import SeedField from './SeedField.vue'
import type { JobState, UseGradientDocument } from './use-gradient-document'

const MODE_OPTIONS = [
  { value: 'random', label: 'Random' },
  { value: 'blob', label: 'Blob' },
  { value: 'flow', label: 'Flow' },
  { value: 'silk', label: 'Silk' },
  { value: 'bloom', label: 'Bloom' },
] as const satisfies ReadonlyArray<{ value: LookFamilyMode; label: string }>

const DIAL_BINDINGS = [
  { label: 'Softness', family: 'softness', key: 'amount' },
  { label: 'Grain', family: 'grain', key: 'amount' },
  { label: 'Palette', family: 'palette', key: 'energy' },
] as const

const DIAL_DEBOUNCE_MS = 150

const props = defineProps<{
  jobState: JobState
  doc: GradientDocument
  applyParam: UseGradientDocument['applyParam']
  applyLookFamilyMode: UseGradientDocument['applyLookFamilyMode']
  applyLookFamily: UseGradientDocument['applyLookFamily']
  applyParamLock: UseGradientDocument['applyParamLock']
  applyRandomize: () => void
  applySeed: UseGradientDocument['applySeed']
  applyExport: () => Promise<void>
}>()

const busy = computed(() => props.jobState !== 'idle')
const pullDisabled = computed(() => props.jobState !== 'idle')
const pullLabel = computed(() =>
  props.jobState === 'exporting' ? 'Pulling print...' : 'Pull print',
)

/** Local dial values for responsive drag; commit via debounced applyParam. */
const draft = ref({
  softness: props.doc.params.softness.amount,
  grain: props.doc.params.grain.amount,
  palette: props.doc.params.palette.energy,
})

watch(
  () => props.doc,
  (doc) => {
    draft.value = {
      softness: doc.params.softness.amount,
      grain: doc.params.grain.amount,
      palette: doc.params.palette.energy,
    }
  },
)

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

onBeforeUnmount(() => {
  for (const timer of pendingTimers.values()) clearTimeout(timer)
  pendingTimers.clear()
})

function dialValue(family: (typeof DIAL_BINDINGS)[number]['family']): number {
  return draft.value[family]
}

function dialLocked(family: (typeof DIAL_BINDINGS)[number]['family']): boolean {
  return props.doc.paramLocks[family]
}

function onDialInput(family: (typeof DIAL_BINDINGS)[number]['family'], value: number): void {
  draft.value = { ...draft.value, [family]: value }

  const timerKey = family
  const existing = pendingTimers.get(timerKey)
  if (existing) clearTimeout(existing)

  pendingTimers.set(
    timerKey,
    setTimeout(() => {
      pendingTimers.delete(timerKey)
      // Drop if busy - do not queue across a busy window (AD-6).
      if (props.jobState !== 'idle') return
      commitDial(family, value)
    }, DIAL_DEBOUNCE_MS),
  )
}

function commitDial(family: (typeof DIAL_BINDINGS)[number]['family'], value: number): void {
  if (family === 'softness') props.applyParam('softness', 'amount', value)
  else if (family === 'grain') props.applyParam('grain', 'amount', value)
  else props.applyParam('palette', 'energy', value)
}

function onModeSelect(mode: LookFamilyMode): void {
  if (busy.value) return
  if (mode === props.doc.lookFamilyMode) return
  props.applyLookFamilyMode(mode)
}

function onLockToggle(family: (typeof DIAL_BINDINGS)[number]['family'], locked: boolean): void {
  if (busy.value) return
  props.applyParamLock(family, locked)
}

function onNewExposure(): void {
  if (busy.value) return
  props.applyRandomize()
}

function onPullPrint(): void {
  if (pullDisabled.value) return
  void props.applyExport()
}
</script>

<template>
  <aside class="control-rail" :class="{ 'is-disabled': busy }">
    <div class="control-rail__mode" role="radiogroup" aria-label="Look family">
      <button
        v-for="option in MODE_OPTIONS"
        :key="option.value"
        type="button"
        class="control-rail__mode-btn"
        :class="{
          'is-selected': doc.lookFamilyMode === option.value,
          'is-disabled': busy,
        }"
        role="radio"
        :aria-checked="doc.lookFamilyMode === option.value ? 'true' : 'false'"
        :disabled="busy"
        @click="onModeSelect(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="control-rail__dials">
      <ParamDial
        v-for="binding in DIAL_BINDINGS"
        :key="binding.label"
        :label="binding.label"
        :model-value="dialValue(binding.family)"
        :locked="dialLocked(binding.family)"
        :disabled="busy"
        @update:model-value="onDialInput(binding.family, $event)"
        @update:locked="onLockToggle(binding.family, $event)"
      />
    </div>
    <SeedField :seed="doc.seed" :disabled="busy" :apply-seed="applySeed" />
    <div class="control-rail__actions">
      <button
        type="button"
        class="btn-ghost"
        :class="{ 'is-disabled': busy }"
        :disabled="busy"
        @click="onNewExposure"
      >
        New exposure
      </button>
      <button
        type="button"
        class="btn-primary"
        :class="{ 'is-disabled': pullDisabled }"
        :aria-disabled="pullDisabled ? 'true' : undefined"
        :tabindex="pullDisabled ? 0 : undefined"
        @click="onPullPrint"
      >
        {{ pullLabel }}
      </button>
      <p class="control-rail__hint">~1920px</p>
    </div>
  </aside>
</template>

<style scoped>
.control-rail {
  min-height: 12rem;
  width: 100%;
  max-width: 220px;
  padding-top: calc(var(--type-brand-size) * var(--type-brand-line) + var(--space-5));
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.control-rail__mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-1);
}

.control-rail__mode-btn {
  min-height: 44px;
  padding: var(--space-2) var(--space-2);
  border: 1px solid var(--color-outline);
  border-radius: var(--rounded);
  background: transparent;
  color: var(--color-on-surface-muted);
  font-family: var(--font-ui);
  font-size: var(--type-label-size);
  font-weight: var(--type-label-weight);
  line-height: var(--type-label-line);
  letter-spacing: var(--type-label-tracking);
  text-transform: uppercase;
  cursor: pointer;
}

.control-rail__mode-btn.is-selected {
  color: var(--color-on-surface);
  border-color: var(--color-outline-strong);
  background: var(--color-surface-raised);
}

.control-rail__mode-btn:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.control-rail__mode-btn.is-disabled {
  color: var(--color-on-surface-faint);
  opacity: 0.45;
  cursor: not-allowed;
}

.control-rail__dials {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.control-rail__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.btn-ghost,
.btn-primary {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: var(--space-3) var(--space-4);
  text-align: center;
  border-radius: var(--rounded);
  font-family: var(--font-ui);
  font-size: var(--type-body-size);
  font-weight: var(--type-body-strong-weight);
  line-height: var(--type-body-line);
  cursor: pointer;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--color-outline);
  color: var(--color-on-surface);
}

.btn-primary {
  background: var(--color-primary);
  border: none;
  color: var(--color-on-primary);
}

.btn-ghost:focus-visible,
.btn-primary:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.btn-ghost.is-disabled,
.btn-primary.is-disabled {
  color: var(--color-on-surface-faint);
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary.is-disabled {
  background: var(--color-primary-muted);
  color: var(--color-on-surface-faint);
  opacity: 0.7;
}

.control-rail__hint {
  margin: 0;
  text-align: center;
  font-family: var(--font-ui);
  font-size: var(--type-label-size);
  font-weight: var(--type-label-weight);
  line-height: var(--type-label-line);
  letter-spacing: var(--type-label-tracking);
  color: var(--color-on-surface-muted);
}

@media (max-width: 720px) {
  .control-rail {
    max-width: none;
    min-height: 4rem;
    padding-top: 0;
  }
}
</style>
