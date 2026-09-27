import { onBeforeUnmount, shallowRef, watch, type ShallowRef } from 'vue'

import {
  createDocument,
  createOpaqueSeed,
  randomize,
  setParam,
  type GradientDocument,
  type GrainParams,
  type PaletteParams,
  type ParamFamily,
  type SoftnessParams,
} from '@/engine/document'
import { createRenderer, type Renderer } from '@/engine/render'

export type JobState = 'idle' | 'exposing' | 'exporting'

type FamilyKeyMap = {
  palette: keyof PaletteParams
  softness: keyof SoftnessParams
  grain: keyof GrainParams
}

export type UseGradientDocument = {
  doc: ShallowRef<GradientDocument>
  jobState: ShallowRef<JobState>
  renderError: ShallowRef<'webgl2-unavailable' | null>
  mountHost: (host: HTMLElement) => void
  applyParam: <F extends ParamFamily>(family: F, key: FamilyKeyMap[F], value: number) => void
  applyRandomize: () => void
}

export function useGradientDocument(): UseGradientDocument {
  const doc = shallowRef<GradientDocument>(randomize(createDocument(createOpaqueSeed())))
  const jobState = shallowRef<JobState>('idle')
  const renderError = shallowRef<'webgl2-unavailable' | null>(null)

  let renderer: Renderer | null = null
  let resizeObserver: ResizeObserver | null = null

  function drawCurrent(): void {
    if (!renderer) return
    if (jobState.value === 'exporting') return
    renderer.draw(doc.value)
  }

  function mountHost(host: HTMLElement): void {
    const result = createRenderer(host)
    if (!result.ok) {
      renderError.value = result.error
      return
    }

    renderer = result.renderer
    renderError.value = null
    drawCurrent()
    resizeObserver = new ResizeObserver(() => renderer?.resize())
    resizeObserver.observe(host)
  }

  function applyParam<F extends ParamFamily>(family: F, key: FamilyKeyMap[F], value: number): void {
    doc.value = setParam(doc.value, family, key, value)
  }

  function applyRandomize(): void {
    doc.value = randomize(doc.value)
  }

  watch(doc, () => {
    drawCurrent()
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
    renderer?.dispose()
    renderer = null
  })

  return {
    doc,
    jobState,
    renderError,
    mountHost,
    applyParam,
    applyRandomize,
  }
}
