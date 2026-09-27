<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import {
  createDocument,
  createOpaqueSeed,
  randomize,
  setParam,
  type GradientDocument,
} from '@/engine/document'
import { createRenderer, type Renderer } from '@/engine/render'

/** Mid-high dial defaults for look judging; seed still owns anchors. */
function withLookDefaults(base: GradientDocument): GradientDocument {
  let next = setParam(base, 'softness', 'amount', 0.78)
  next = setParam(next, 'grain', 'amount', 0.72)
  next = setParam(next, 'palette', 'energy', 0.7)
  return next
}

const hostEl = ref<HTMLElement | null>(null)
const doc = shallowRef<GradientDocument>(withLookDefaults(createDocument(createOpaqueSeed())))
const error = ref<string | null>(null)

let renderer: Renderer | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const host = hostEl.value
  if (!host) return

  const result = createRenderer(host)
  if (!result.ok) {
    error.value = result.error
    return
  }

  renderer = result.renderer
  renderer.draw(doc.value)
  resizeObserver = new ResizeObserver(() => renderer?.resize())
  resizeObserver.observe(host)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  renderer?.dispose()
  renderer = null
})

watch(doc, (next) => {
  renderer?.draw(next)
})

function onRandomize(): void {
  doc.value = withLookDefaults(randomize(doc.value))
}

function onSoftness(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  doc.value = setParam(doc.value, 'softness', 'amount', value)
}

function onGrain(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  doc.value = setParam(doc.value, 'grain', 'amount', value)
}

function onEnergy(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  doc.value = setParam(doc.value, 'palette', 'energy', value)
}
</script>

<template>
  <div class="spike">
    <header class="spike__header">
      <p class="spike__brand">tolos</p>
    </header>

    <div class="spike__stage">
      <div ref="hostEl" class="spike__host" aria-label="WebGL gradient preview" />
      <p v-if="error" class="spike__error">{{ error }}</p>
    </div>

    <aside class="spike__controls" aria-label="Provisional dials">
      <button type="button" class="spike__btn" @click="onRandomize">Randomize</button>
      <label class="spike__dial">
        Softness
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="doc.params.softness.amount"
          @input="onSoftness"
        />
      </label>
      <label class="spike__dial">
        Grain
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="doc.params.grain.amount"
          @input="onGrain"
        />
      </label>
      <label class="spike__dial">
        Energy
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="doc.params.palette.energy"
          @input="onEnergy"
        />
      </label>
      <p class="spike__seed">seed {{ doc.seed }}</p>
    </aside>
  </div>
</template>

<style scoped>
.spike {
  --bg: #1a1714;
  --ink: #f2ebe3;
  --muted: #a89f94;
  min-height: 100vh;
  margin: 0;
  padding: 1.25rem clamp(1rem, 3vw, 2rem) 2rem;
  box-sizing: border-box;
  background:
    radial-gradient(ellipse 80% 50% at 20% 0%, #2a221c 0%, transparent 55%),
    var(--bg);
  color: var(--ink);
  font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
}

.spike__header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.75rem 1.5rem;
  margin-bottom: 1rem;
}

.spike__brand {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  letter-spacing: 0.04em;
  text-transform: lowercase;
}

.spike__stage {
  position: relative;
  width: min(100%, 960px);
  aspect-ratio: 16 / 9;
  background: #0d0b09;
}

.spike__host {
  width: 100%;
  height: 100%;
}

.spike__error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  background: #0d0b09;
  color: #e8a090;
}

.spike__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  align-items: end;
  margin-top: 1rem;
  max-width: 960px;
}

.spike__btn {
  appearance: none;
  border: 1px solid #5a5046;
  background: transparent;
  color: var(--ink);
  padding: 0.45rem 0.9rem;
  font: inherit;
  cursor: pointer;
}

.spike__btn:hover {
  border-color: var(--ink);
}

.spike__dial {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--muted);
  min-width: 9rem;
}

.spike__dial input {
  width: 100%;
}

.spike__seed {
  margin: 0;
  font-size: 0.75rem;
  color: var(--muted);
  word-break: break-all;
  flex: 1 1 12rem;
}
</style>
