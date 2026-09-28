<script setup lang="ts">
import { computed } from 'vue'

import type { JobState } from './use-gradient-document'

const props = defineProps<{
  jobState: JobState
  applyRandomize: () => void
}>()

const busy = computed(() => props.jobState !== 'idle')

function onNewExposure(): void {
  if (busy.value) return
  props.applyRandomize()
}
</script>

<template>
  <aside class="control-rail">
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
      <button type="button" class="btn-primary is-disabled" disabled>Pull print</button>
    </div>
  </aside>
</template>

<style scoped>
.control-rail {
  min-height: 12rem;
  width: 100%;
  max-width: 220px;
  padding-top: calc(var(--type-brand-size) * var(--type-brand-line) + var(--space-5));
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

@media (max-width: 720px) {
  .control-rail {
    max-width: none;
    min-height: 4rem;
    padding-top: 0;
  }
}
</style>
