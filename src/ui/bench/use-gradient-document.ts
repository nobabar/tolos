import { onBeforeUnmount, shallowRef, type ShallowRef } from 'vue'

import {
  createDocument,
  createOpaqueSeed,
  isValidSeed,
  randomize,
  setLookFamily,
  setLookFamilyMode,
  setParam,
  setParamLock,
  setSeed,
  type GradientDocument,
  type GrainParams,
  type LookFamily,
  type LookFamilyMode,
  type PaletteParams,
  type ParamFamily,
  type SoftnessParams,
} from '@/engine/document'
import { exportPng } from '@/engine/export'
import { createRenderer, type Renderer } from '@/engine/render'

export type JobState = 'idle' | 'exposing' | 'exporting'

export type ApplySeedResult = 'ok' | 'invalid'

type FamilyKeyMap = {
  palette: keyof PaletteParams
  softness: keyof SoftnessParams
  grain: keyof GrainParams
}

const EXPORT_FILENAME = 'tolos.png'

export type UseGradientDocument = {
  doc: ShallowRef<GradientDocument>
  jobState: ShallowRef<JobState>
  renderError: ShallowRef<'webgl2-unavailable' | null>
  mountHost: (host: HTMLElement) => void
  applyParam: <F extends ParamFamily>(family: F, key: FamilyKeyMap[F], value: number) => void
  applyLookFamilyMode: (mode: LookFamilyMode) => void
  applyLookFamily: (family: LookFamily) => void
  applyParamLock: (family: ParamFamily, locked: boolean) => void
  applyRandomize: () => void
  applySeed: (seed: string) => ApplySeedResult
  applyExport: () => Promise<void>
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
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

  /** Shared expose path for dial commits, seed restore, and randomize redraw. */
  function runExposure(mutate: () => void): void {
    if (jobState.value !== 'idle') return
    jobState.value = 'exposing'
    mutate()
    drawCurrent()
    requestAnimationFrame(() => {
      jobState.value = 'idle'
    })
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
    runExposure(() => {
      doc.value = setParam(doc.value, family, key, value)
    })
  }

  /** Random sets mode only. Fixed mode also switches the active print family. */
  function applyLookFamilyMode(mode: LookFamilyMode): void {
    runExposure(() => {
      if (mode === 'random') {
        doc.value = setLookFamilyMode(doc.value, 'random')
        return
      }
      doc.value = setLookFamilyMode(doc.value, mode)
      doc.value = setLookFamily(doc.value, mode)
    })
  }

  function applyLookFamily(family: LookFamily): void {
    runExposure(() => {
      doc.value = setLookFamily(doc.value, family)
    })
  }

  function applyParamLock(family: ParamFamily, locked: boolean): void {
    runExposure(() => {
      doc.value = setParamLock(doc.value, family, locked)
    })
  }

  function applyRandomize(): void {
    runExposure(() => {
      doc.value = randomize(doc.value)
    })
  }

  function applySeed(seed: string): ApplySeedResult {
    if (jobState.value !== 'idle') return 'ok'
    const trimmed = seed.trim()
    if (!isValidSeed(trimmed)) return 'invalid'
    runExposure(() => {
      doc.value = setSeed(doc.value, trimmed)
    })
    return 'ok'
  }

  async function applyExport(): Promise<void> {
    if (jobState.value !== 'idle') return
    if (renderError.value === 'webgl2-unavailable' || !renderer) return

    jobState.value = 'exporting'
    try {
      const result = await exportPng(doc.value)
      if (result.ok) {
        triggerDownload(result.blob, EXPORT_FILENAME)
      }
    } finally {
      jobState.value = 'idle'
    }
  }

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
    applyLookFamilyMode,
    applyLookFamily,
    applyParamLock,
    applyRandomize,
    applySeed,
    applyExport,
  }
}
