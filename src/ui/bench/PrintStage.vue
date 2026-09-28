<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { JobState } from './use-gradient-document'

const props = defineProps<{
  mountHost: (host: HTMLElement) => void
  renderError: 'webgl2-unavailable' | null
  jobState?: JobState
}>()

const hostEl = ref<HTMLElement | null>(null)

onMounted(() => {
  const host = hostEl.value
  if (host) props.mountHost(host)
})
</script>

<template>
  <div class="print-stage" :data-blocked="renderError ? 'true' : undefined">
    <div
      ref="hostEl"
      class="print-stage__host"
      role="img"
      :aria-label="renderError ? undefined : 'Live gradient print'"
      :aria-hidden="renderError ? 'true' : undefined"
    />
    <div
      v-if="!renderError && jobState === 'exposing'"
      class="print-stage__veil"
      aria-hidden="true"
    >
      <span class="print-stage__exposing-label">Exposing...</span>
    </div>
    <p
      v-if="renderError"
      class="print-stage__blocker"
      role="status"
    >
      tolos needs WebGL in this browser.
    </p>
  </div>
</template>

<style scoped>
.print-stage {
  position: relative;
  width: 100%;
  background: var(--color-print-mat);
  border: 1px solid var(--color-print-edge);
  border-radius: var(--rounded-sm);
  padding: var(--space-print-inset);
  box-shadow: 0 24px 48px rgb(0 0 0 / 8%);
}

.print-stage__host {
  aspect-ratio: 16 / 9;
  width: 100%;
  border-radius: var(--rounded-sm);
  overflow: hidden;
  background: var(--color-print-mat);
}

.print-stage__host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.print-stage__veil {
  position: absolute;
  inset: var(--space-print-inset);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--rounded-sm);
  background: rgba(10, 9, 8, 0.35);
  pointer-events: none;
}

.print-stage__exposing-label {
  font-family: var(--font-ui);
  font-size: var(--type-body-size);
  font-weight: var(--type-body-strong-weight);
  line-height: var(--type-body-line);
  color: var(--color-on-surface);
  letter-spacing: 0.02em;
}

.print-stage__blocker {
  position: absolute;
  inset: var(--space-print-inset);
  display: grid;
  place-items: center;
  margin: 0;
  padding: var(--space-5);
  border-radius: var(--rounded-sm);
  background: var(--color-surface);
  color: var(--color-on-surface);
  font-family: var(--font-ui);
  font-size: var(--type-body-size);
  font-weight: var(--type-body-weight);
  line-height: var(--type-body-line);
  text-align: center;
}
</style>
