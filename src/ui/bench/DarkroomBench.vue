<script setup lang="ts">
import { ref } from 'vue'

import BrandMark from './BrandMark.vue'
import ControlRail from './ControlRail.vue'
import PrintStage from './PrintStage.vue'
import { useBenchKeyboard } from './use-bench-keyboard'
import { useGradientDocument } from './use-gradient-document'

const {
  doc,
  mountHost,
  renderError,
  applyParam,
  applyLookFamilyMode,
  applyLookFamily,
  applyParamLock,
  applyRandomize,
  applySeed,
  applyExport,
  jobState,
} = useGradientDocument()

useBenchKeyboard({ jobState, applyRandomize, applyExport })

const printStageRef = ref<InstanceType<typeof PrintStage> | null>(null)

function onSkipToPrint(): void {
  printStageRef.value?.focusHost()
}
</script>

<template>
  <div class="bench" :data-webgl="renderError ? 'unavailable' : 'ready'">
    <div class="bench__main">
      <button type="button" class="bench__skip" data-testid="bench-skip" @click="onSkipToPrint">
        Skip to print
      </button>
      <BrandMark />
      <PrintStage
        ref="printStageRef"
        :mount-host="mountHost"
        :render-error="renderError"
        :job-state="jobState"
      />
    </div>
    <ControlRail
      v-if="!renderError"
      :job-state="jobState"
      :doc="doc"
      :apply-param="applyParam"
      :apply-look-family-mode="applyLookFamilyMode"
      :apply-look-family="applyLookFamily"
      :apply-param-lock="applyParamLock"
      :apply-randomize="applyRandomize"
      :apply-seed="applySeed"
      :apply-export="applyExport"
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

.bench__skip {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
  font-family: var(--font-ui);
  font-size: var(--type-body-size);
  font-weight: var(--type-body-strong-weight);
  line-height: var(--type-body-line);
  color: var(--color-on-surface);
  background: var(--color-surface);
  cursor: pointer;
}

.bench__skip:focus {
  position: static;
  width: auto;
  height: auto;
  margin: 0;
  padding: var(--space-2) var(--space-3);
  overflow: visible;
  clip: auto;
  white-space: normal;
  border-radius: var(--rounded);
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

@media (max-width: 720px) {
  .bench {
    grid-template-columns: 1fr;
    padding: var(--space-margin-compact);
  }
}
</style>
