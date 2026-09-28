<script setup lang="ts">
import BrandMark from './BrandMark.vue'
import ControlRail from './ControlRail.vue'
import PrintStage from './PrintStage.vue'
import { useGradientDocument } from './use-gradient-document'

const { doc, mountHost, renderError, applyParam, applyRandomize, jobState } = useGradientDocument()
</script>

<template>
  <div class="bench" :data-webgl="renderError ? 'unavailable' : 'ready'">
    <div class="bench__main">
      <BrandMark />
      <PrintStage :mount-host="mountHost" :render-error="renderError" :job-state="jobState" />
    </div>
    <ControlRail
      v-if="!renderError"
      :job-state="jobState"
      :doc="doc"
      :apply-param="applyParam"
      :apply-randomize="applyRandomize"
    />
  </div>
</template>

<style scoped>
.bench {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: var(--space-bench-gap);
  align-items: start;
  min-height: 100vh;
  padding: var(--space-margin-desktop);
  background: var(--color-background);
}

.bench[data-webgl='unavailable'] {
  grid-template-columns: minmax(0, 1fr);
}

.bench__main {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-width: 0;
}

@media (max-width: 720px) {
  .bench {
    grid-template-columns: 1fr;
    padding: var(--space-margin-compact);
  }
}
</style>
