<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps<{
  mountHost: (host: HTMLElement) => void
  renderError: 'webgl2-unavailable' | null
}>()

const hostEl = ref<HTMLElement | null>(null)

onMounted(() => {
  const host = hostEl.value
  if (host) props.mountHost(host)
})
</script>

<template>
  <div class="print-stage">
    <div
      ref="hostEl"
      class="print-stage__host"
      role="img"
      aria-label="Live gradient print"
    />
    <p v-if="renderError" class="print-stage__error">WebGL unavailable</p>
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

.print-stage__error {
  position: absolute;
  inset: var(--space-print-inset);
  display: grid;
  place-items: center;
  margin: 0;
  border-radius: var(--rounded-sm);
  background: var(--color-print-mat);
  color: var(--color-danger);
  font-family: var(--font-ui);
  font-size: var(--type-body-size);
}
</style>
