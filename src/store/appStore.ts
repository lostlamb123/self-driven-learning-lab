/**
 * 应用全局状态（Zustand + immer）
 *
 * - 初始化：从 localStorage 读取（loadAppDataWithError），损坏时提示并保留本地数据；
 * - updateData：immer 风格的可变修改，内部自动 scheduleAutoSave（debounce 500ms）；
 * - importData：走 persistence 的版本校验，成功后立即覆盖本地；
 * - exportData：生成 JSON 并触发下载。
 *
 * 约定：页面组件只通过本 store 读写数据，不直接碰 localStorage。
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { createEmptyAppData, type AppData } from '../types/models'
import {
  exportAppData,
  flushPendingSave,
  loadAppDataWithError,
  scheduleAutoSave,
  importAppDataFromFile,
  type ImportResult,
} from './persistence'
import { markSaving } from './saveState'

export type NotifyType = 'success' | 'error' | 'info'

export interface AppNotification {
  id: number
  type: NotifyType
  message: string
  /** 自动消失的毫秒数；undefined 表示常驻直到用户关闭 */
  ttl?: number
}

export interface AppStore {
  data: AppData
  /** 初始化时发现本地数据损坏（已回落到空数据，但本地数据仍保留） */
  localCorrupted: boolean
  notifications: AppNotification[]

  /** 可变式更新 AppData（immer），自动安排自动保存 */
  updateData: (updater: (draft: AppData) => void) => void
  /** 直接替换整个数据对象（导入等场景） */
  replaceData: (data: AppData) => void

  /** 导出并触发下载，返回文件名 */
  exportData: () => string
  /** 从文件导入（含版本校验），成功后立即覆盖本地；失败抛 PersistenceError */
  importData: (file: File) => Promise<ImportResult>

  notify: (type: NotifyType, message: string, ttl?: number) => void
  dismissNotification: (id: number) => void
}

let notifyId = 0

export const useAppStore = create<AppStore>()(
  immer((set, get) => {
    const { data, corrupted } = loadAppDataWithError()

    return {
      data,
      localCorrupted: corrupted,
      notifications: [],

      updateData: (updater) => {
        // immer：updater 在草稿上修改，提交后自动生成新引用
        set((state) => {
          updater(state.data)
        })
        scheduleAutoSave(get().data)
        markSaving()
      },

      replaceData: (next) => {
        set({ data: next })
        flushPendingSave()
        scheduleAutoSave(get().data)
      },

      exportData: () => {
        return exportAppData(get().data)
      },

      importData: async (file) => {
        const result = await importAppDataFromFile(file)
        set({ data: result.data, localCorrupted: false })
        flushPendingSave()
        scheduleAutoSave(get().data)
        return result
      },

      notify: (type, message, ttl) => {
        const id = ++notifyId
        set((state) => {
          state.notifications.push({ id, type, message, ttl })
        })
        if (ttl !== undefined) {
          setTimeout(() => {
            set((state) => {
              state.notifications = state.notifications.filter((n) => n.id !== id)
            })
          }, ttl)
        }
      },

      dismissNotification: (id) => {
        set((state) => {
          state.notifications = state.notifications.filter((n) => n.id !== id)
        })
      },
    }
  }),
)

/** 初始化时本地数据损坏的提示。
 *  调用方需在 useEffect 中检查 localCorrupted 并自行 notify，
 *  避免在渲染阶段触发 set 造成死循环。 */
export function useLocalCorruptionNotice() {
  const localCorrupted = useAppStore((s) => s.localCorrupted)
  const notify = useAppStore((s) => s.notify)
  return { localCorrupted, notify }
}

export { createEmptyAppData }
