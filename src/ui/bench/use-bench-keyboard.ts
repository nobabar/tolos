import { onBeforeUnmount, onMounted, type Ref } from 'vue'

import type { JobState } from './use-gradient-document'

type BenchKeyboardOptions = {
  jobState: Ref<JobState>
  applyRandomize: () => void
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

/** Space / R -> randomize when idle. Ignores typing and button Space activation. */
export function useBenchKeyboard({ jobState, applyRandomize }: BenchKeyboardOptions): void {
  function onKeydown(event: KeyboardEvent): void {
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
