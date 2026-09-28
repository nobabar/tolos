import { onBeforeUnmount, onMounted, type Ref } from 'vue'

import type { JobState } from './use-gradient-document'

type BenchKeyboardOptions = {
  jobState: Ref<JobState>
  applyRandomize: () => void
  applyExport: () => Promise<void>
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function isSpaceActivator(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('button')) return true
  return target.getAttribute('role') === 'button'
}

/** Space / R -> randomize; Cmd/Ctrl+Enter -> Pull print. */
export function useBenchKeyboard({
  jobState,
  applyRandomize,
  applyExport,
}: BenchKeyboardOptions): void {
  function onKeydown(event: KeyboardEvent): void {
    const isPullChord = event.key === 'Enter' && (event.metaKey || event.ctrlKey)

    if (isPullChord) {
      if (jobState.value !== 'idle') return
      event.preventDefault()
      void applyExport()
      return
    }

    if (jobState.value !== 'idle') return

    const key = event.key
    const isSpace = key === ' '
    const isR = key === 'r' || key === 'R'
    if (!isSpace && !isR) return

    if (isEditableTarget(event.target)) return
    if (isSpace && isSpaceActivator(event.target)) return

    event.preventDefault()
    applyRandomize()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
  })
}
