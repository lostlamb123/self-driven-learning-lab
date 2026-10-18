/**
 * 保存状态 hook：把 persistence 层的 debounce 自动保存状态暴露给 UI。
 *
 * store.updateData 每次都会 scheduleAutoSave（debounce 500ms）。
 * 这里用 `useSyncExternalStore` 订阅一个轻量信号：
 * - 触发 updateData 时 -> 'saving'
 * - debounce 落盘完成后 -> 'saved'
 *
 * 页面顶部据此显示「保存中 / 已保存」。
 */
import { useSyncExternalStore } from 'react'
import { hasPendingSave } from '../store/persistence'

export type SaveState = 'idle' | 'saving' | 'saved'

let listeners = new Set<() => void>()
let state: SaveState = 'idle'
let settleTimer: ReturnType<typeof setTimeout> | null = null

function emit() {
  for (const l of [...listeners]) l()
}

function getState() {
  return state
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * 由 store 的 updateData 调用：标记进入「保存中」，
 * 并在 debounce 窗口结束后切到「已保存」。
 * 与 scheduleAutoSave 的 500ms 保持一致（略加余量）。
 */
export function markSaving() {
  state = 'saving'
  emit()
  if (settleTimer !== null) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    if (hasPendingSave()) {
      // 还没落盘，继续等
      markSaving()
      return
    }
    state = 'saved'
    emit()
  }, 600)
}

export function useSaveState(): SaveState {
  return useSyncExternalStore(subscribe, getState, getState)
}
