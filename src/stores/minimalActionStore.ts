/**
 * 今日最小行动 store（Zustand + persist）
 *
 * - 独立于主 appStore，单独持久化到 localStorage，key 为 `sdl_minimal_actions`。
 * - actions 为完整历史；todayActions / streak 为派生值，组件内用 selector 计算。
 * - 所有状态变更只通过本 store 的 action 完成，组件不直接写 localStorage。
 *
 * 约定：
 * - 不显示「断签」：streak 断签后从 1 重新计数，UI 用「重新开始也是一次做到」表达。
 * - 情绪必须记录到 mood 字段，供后续复盘模块读取。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  MinimalAction,
  MinimalActionTag,
  MinimalDifficulty,
  MinimalMood,
} from '../types/models'
import { daysAgoKey, toDateKey } from '../utils/date'

const STORAGE_KEY = 'sdl_minimal_actions'

/** 生成本地唯一的实体 id（带类型前缀，便于跨类型去重与调试） */
function newActionId(): string {
  return `ma-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface MinimalActionStore {
  /** 全部最小行动（含历史），按 createdAt 升序存储 */
  actions: MinimalAction[]

  /** 新增一条最小行动 */
  addAction: (
    text: string,
    tags: MinimalActionTag[],
    difficulty?: MinimalDifficulty,
  ) => void
  /** 完成一条行动并记录情绪；情绪必填，供后续复盘模块读取 */
  completeAction: (id: string, mood: MinimalMood) => void
  /** 撤销完成（恢复为待完成，并清空情绪） */
  reopenAction: (id: string) => void
  /** 删除一条行动 */
  removeAction: (id: string) => void
}

export const useMinimalActionStore = create<MinimalActionStore>()(
  persist(
    (set) => ({
      actions: [],

      addAction: (text, tags, difficulty) => {
        const now = new Date().toISOString()
        const action: MinimalAction = {
          id: newActionId(),
          text: text.trim(),
          tags,
          status: 'pending',
          createdAt: now,
        }
        if (difficulty) action.difficulty = difficulty
        set((state) => ({ actions: [...state.actions, action] }))
      },

      completeAction: (id, mood) => {
        set((state) => ({
          actions: state.actions.map((a) =>
            a.id === id
              ? { ...a, status: 'done', mood, completedAt: new Date().toISOString() }
              : a,
          ),
        }))
      },

      reopenAction: (id) => {
        set((state) => ({
          actions: state.actions.map((a) =>
            a.id === id
              ? { ...a, status: 'pending', mood: undefined, completedAt: undefined }
              : a,
          ),
        }))
      },

      removeAction: (id) => {
        set((state) => ({ actions: state.actions.filter((a) => a.id !== id) }))
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      /** 只持久化 actions；派生值不入库 */
      partialize: (state) => ({ actions: state.actions }),
    },
  ),
)

/* -------------------------------------------------------------------------- */
/* 派生 selector（组件内使用）                                                  */
/* -------------------------------------------------------------------------- */

/** 取今天的行动（createdAt 落在今天的） */
export function selectTodayActions(state: MinimalActionStore): MinimalAction[] {
  const todayKey = toDateKey()
  return state.actions.filter((a) => toDateKey(new Date(a.createdAt)) === todayKey)
}

/**
 * 计算连续完成天数（允许断签，断签后从 1 重新计数）。
 *
 * 规则：
 * - 收集所有「完成日」的本地日期 key；
 * - 若昨天未完成（断签），streak 从 1 起算（今天有完成则含今天），并标记 restarted；
 * - 若昨天也完成，则从昨天起继续往前累加。
 *
 * 返回 `{ streak, restarted, active }`：
 * - `streak`：当前连续完成天数（最小为 1）
 * - `restarted`：是否处于「断签后重新开始」状态（UI 显示「重新开始也是一次做到」）
 * - `active`：今天是否已有完成（streak 是否“正在累计中”）
 */
export function computeActionStreak(actions: MinimalAction[]): {
  streak: number
  restarted: boolean
  active: boolean
} {
  // 日历日语义：yesterday = 今天减 1 天（本地时区），不使用 24 小时算术，避免夏令时偏移
  const todayKey = toDateKey()
  const yesterdayKey = daysAgoKey(1)

  const doneDates = new Set(
    actions
      .filter((a) => a.status === 'done')
      .map((a) => toDateKey(new Date(a.completedAt ?? a.createdAt))),
  )

  const doneToday = doneDates.has(todayKey)
  const doneYesterday = doneDates.has(yesterdayKey)

  let streak = 0
  let restarted = false

  if (doneToday) {
    // 今天有完成 -> 计入
    streak = 1
    if (doneYesterday) {
      // 昨天也完成 -> 从昨天起继续往前累加（昨天计入，再往前一日一日查）
      streak += 1 // 昨天
      let offset = 2
      // 上界 365 天：防止数据异常导致死循环；超出 365 天的连续记录按 365 截断
      while (offset <= 365 && doneDates.has(daysAgoKey(offset))) {
        streak += 1
        offset += 1
      }
    } else {
      // 昨天没完成但今天完成了 -> 断签后重新开始
      restarted = true
    }
  } else if (doneYesterday) {
    // 今天还没做，但昨天完成了：从昨天起往前回溯
    let offset = 1
    streak = 0
    while (offset <= 365 && doneDates.has(daysAgoKey(offset))) {
      streak += 1
      offset += 1
    }
    // 昨天是窗口内最近一天，streak 至少为 1
    streak = Math.max(streak, 1)
  }

  return { streak, restarted, active: doneToday }
}
