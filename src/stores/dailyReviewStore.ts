/**
 * 今日复盘 store（Zustand + persist）
 *
 * 定位：复盘不是打分、不是总结报告，而是用几个固定问题完成一次
 * 「元认知自问 + 模型迭代」。数据全部来自已有三个 store（最小行动 /
 * 好奇种子 / 概念卡），本 store 只存「自问的答案」，不新建重复数据。
 *
 * 约定：
 * - 一天一条：`id = date`（YYYY-MM-DD），同一天再次保存直接覆盖（可修改）。
 * - 不做连续复盘打卡、不做复盘率统计、不做排名、不做红点催促。
 * - 持久化 key：`sdl_daily_reviews`。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  DailyMetaReview,
  AttentionLevel,
  MethodEffect,
} from '../types/models'
import { toDateKey } from '../utils/date'

const STORAGE_KEY = 'sdl_daily_reviews'

export interface DailyReviewStore {
  /** 全部复盘记录（一天一条，id = date） */
  reviews: DailyMetaReview[]

  /**
   * 保存某天复盘。
   * 参数不含 id / createdAt —— id 固定为 `date`（一天一条），
   * 同一天再次调用直接覆盖（支持"可以修改，也可以明天再来"）。
   */
  saveReview: (input: {
    date: string
    attention: AttentionLevel
    method: MethodEffect
    attentionNote?: string
    surprise?: string
    nextTweak?: string
  }) => void

  /** 删除某天复盘（可选，供用户清除） */
  removeReview: (date: string) => void
}

export const useDailyReviewStore = create<DailyReviewStore>()(
  persist(
    (set, get) => ({
      reviews: [],

      saveReview: ({ date, attention, method, attentionNote, surprise, nextTweak }) => {
        const existing = get().reviews.find((r) => r.id === date)
        const record: DailyMetaReview = {
          id: date,
          date,
          attention,
          method,
          attentionNote: attentionNote?.trim() || undefined,
          surprise: surprise?.trim() || undefined,
          nextTweak: nextTweak?.trim() || undefined,
          // 覆盖时保留原 createdAt，体现"同一天一条"
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        }
        set((state) => ({
          reviews: state.reviews
            .filter((r) => r.id !== date)
            .concat(record),
        }))
      },

      removeReview: (date) => {
        set((state) => ({
          reviews: state.reviews.filter((r) => r.id !== date),
        }))
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (state) => ({ reviews: state.reviews }),
    },
  ),
)

/** 在 store 内部引用 get() 时已在上方的 create(set, get) 中注入。 */

/* -------------------------------------------------------------------------- */
/* 派生 selector（组件内使用）                                                  */
/* -------------------------------------------------------------------------- */

/** 取今天的复盘（id = 今天日期） */
export function selectTodayReview(state: DailyReviewStore): DailyMetaReview | null {
  const todayKey = toDateKey()
  return state.reviews.find((r) => r.id === todayKey) ?? null
}

/** 取指定日期的复盘 */
export function selectReviewByDate(
  state: DailyReviewStore,
  date: string,
): DailyMetaReview | null {
  return state.reviews.find((r) => r.id === date) ?? null
}
