/**
 * 第一章概念卡 store（Zustand + persist）
 *
 * 定位：内化第一章核心概念的轻量工具。看正面主动回想，翻背面核对，
 * 标记「会了 / 再刷 / 不会」，用间隔重复把概念变成自己的认知。
 *
 * 间隔重复规则（写进注释，方便后续调整）：
 * - 「会了」(good)  ：status -> mastered，reviewCount + 1，
 *                    nextReviewAt = 7 天后（进入长期记忆，不再每天打扰）
 * - 「再刷」(again) ：status 保持 review，reviewCount + 1，
 *                    nextReviewAt = 1 天后
 * - 「不会」(hard)  ：status -> review，reviewCount 不增，
 *                    nextReviewAt = 今天（立即再刷一次）
 *
 * 筛选「今日待刷」：status === 'new'，或 status === 'review' 且
 * nextReviewAt <= 今天。mastered 的卡不再出现在待刷区（除非手动回退）。
 *
 * 种子：第一章 8 张 + 第二章《内驱的学习者》6 张（见 data/firstChapterCards、
 * data/secondChapterCards）。`ensureSeeded` 是**幂等补种**——只追加缺失的种子卡，
 * 不覆盖已有卡片的 status / reviewCount / 日期，因此老用户升级后也会拿到新章节的卡。
 * 持久化 key：`sdl_concept_cards`。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ChapterConceptCard,
  ConceptCardStatus,
} from '../types/models'
import { FIRST_CHAPTER_CARDS } from '../data/firstChapterCards'
import { SECOND_CHAPTER_CARDS } from '../data/secondChapterCards'
import { daysFromNowKey, toDateKey } from '../utils/date'

const STORAGE_KEY = 'sdl_concept_cards'

/** 全部种子卡（第一章 + 第二章），顺序决定首次种入时的排列 */
const ALL_SEED_CARDS: ChapterConceptCard[] = [
  ...FIRST_CHAPTER_CARDS,
  ...SECOND_CHAPTER_CARDS,
]

/** 三种标记结果：good(会了) / again(再刷) / hard(不会) */
export type ReviewResult = 'good' | 'again' | 'hard'

/** 各结果对应的间隔天数（写进常量，便于统一调整） */
const INTERVAL_DAYS: Record<ReviewResult, number> = {
  good: 7, // 会了 -> 7 天后
  again: 1, // 再刷 -> 1 天后
  hard: 0, // 不会 -> 今天
}

/** 各结果对应的目标 status */
const STATUS_FOR_RESULT: Record<ReviewResult, ConceptCardStatus> = {
  good: 'mastered',
  again: 'review',
  hard: 'review',
}

/** 生成本地唯一的卡片 id（带类型前缀） */
function newCardId(): string {
  return `ccard-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

export interface ConceptCardStore {
  /** 全部概念卡（含种子 + 用户自建 + 已掌握），按 createdAt 升序 */
  cards: ChapterConceptCard[]

  /** 是否已初始化种子（防止重复种入） */
  seeded: boolean

  /** 用户新增一张自定义卡片（可选 example / source） */
  addCard: (input: {
    front: string
    back: string
    example?: string
    source?: string
  }) => void

  /**
   * 标记一次复习结果。
   * 规则见文件头注释；标记后卡片从今日待刷区自然移除（status/nextReviewAt 变更）。
   */
  reviewCard: (id: string, result: ReviewResult) => void

  /** 把一张已掌握卡「退回去再学」（mastered -> review，明天再刷） */
  reopenCard: (id: string) => void

  /** 删除一张用户自建卡片（种子卡不可删，避免破坏初始体验） */
  removeCard: (id: string) => void

  /** 初始化：幂等补种缺失的种子卡（不影响已有卡片的复习状态） */
  ensureSeeded: () => void
}

export const useConceptCardStore = create<ConceptCardStore>()(
  persist(
    (set, get) => ({
      cards: [],
      seeded: false,

      ensureSeeded: () => {
        const { cards, seeded } = get()
        /**
         * 幂等补种：只追加「本地没有」的种子卡。
         * 去重同时看 id 与 front —— 旧版本种入的卡 id 是随机 `ccard-*`，
         * 只看 id 会把第一章重复种入一遍。
         */
        const existingIds = new Set(cards.map((c) => c.id))
        const existingFronts = new Set(cards.map((c) => c.front))
        const missing = ALL_SEED_CARDS.filter(
          (c) => !existingIds.has(c.id) && !existingFronts.has(c.front),
        )

        if (missing.length === 0) {
          // 数据已完整：只需补齐 seeded 标记（兼容旧数据）
          if (!seeded) set({ seeded: true })
          return
        }

        const now = new Date().toISOString()
        set((state) => ({
          cards: [
            ...state.cards,
            // 新种子卡：status=new、nextReviewAt=今天（与第一章初始化规则一致）
            ...missing.map((c) => ({
              ...c,
              nextReviewAt: toDateKey(),
              createdAt: now,
            })),
          ],
          seeded: true,
        }))
      },

      addCard: ({ front, back, example, source }) => {
        const now = new Date().toISOString()
        const card: ChapterConceptCard = {
          id: newCardId(),
          front: front.trim(),
          back: back.trim(),
          example: example?.trim() || undefined,
          source: source?.trim() || undefined,
          status: 'new',
          reviewCount: 0,
          nextReviewAt: toDateKey(),
          createdAt: now,
        }
        set((state) => ({ cards: [...state.cards, card] }))
      },

      reviewCard: (id, result) => {
        const days = INTERVAL_DAYS[result]
        const nextStatus = STATUS_FOR_RESULT[result]
        const nextReviewAt = daysFromNowKey(days)
        const todayKey = toDateKey()

        set((state) => ({
          cards: state.cards.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: nextStatus,
                  // 「不会」(hard) 时 reviewCount 不增，其余 +1
                  reviewCount: result === 'hard' ? c.reviewCount : c.reviewCount + 1,
                  lastReviewedAt: todayKey,
                  nextReviewAt,
                }
              : c,
          ),
        }))
      },

      reopenCard: (id) => {
        set((state) => ({
          cards: state.cards.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: 'review',
                  // 明天再刷
                  nextReviewAt: daysFromNowKey(1),
                  lastReviewedAt: toDateKey(),
                }
              : c,
          ),
        }))
      },

      removeCard: (id) => {
        // 只删用户自建卡；种子卡（id 以 seed-ch1- / seed-ch2- 开头）不允许删，
        // 避免破坏「核心概念必须内化」的初衷
        set((state) => ({
          cards: state.cards.filter(
            (c) => c.id === id && !c.id.startsWith('seed-'),
          ),
        }))
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        cards: state.cards,
        seeded: state.seeded,
      }),
      /** 启动时幂等补种：新用户拿到全部种子；老用户补齐新增章节的卡 */
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // persist 重 hydrate 后调用 ensureSeeded，保证种子卡齐全
        useConceptCardStore.getState().ensureSeeded()
      },
    },
  ),
)

/* -------------------------------------------------------------------------- */
/* 派生 selector（组件内使用）                                                  */
/* -------------------------------------------------------------------------- */

/** 筛选今日待刷的卡片：new，或 review 且 nextReviewAt <= 今天 */
export function selectTodayCards(state: ConceptCardStore): ChapterConceptCard[] {
  const todayKey = toDateKey()
  return state.cards
    .filter((c) => {
      if (c.status === 'new') return true
      if (c.status === 'review' && c.nextReviewAt !== undefined) {
        // YYYY-MM-DD 字典序 == 时间序，直接比较
        return c.nextReviewAt <= todayKey
      }
      return false
    })
    // 按下次复习时间升序（早到先刷），同日的按创建时间
    .sort((a, b) =>
      (a.nextReviewAt ?? a.createdAt).localeCompare(b.nextReviewAt ?? b.createdAt),
    )
}

/** 已掌握的卡片数量 */
export function selectMasteredCount(state: ConceptCardStore): number {
  return state.cards.filter((c) => c.status === 'mastered').length
}

/** 全部卡片总数 */
export function selectTotalCount(state: ConceptCardStore): number {
  return state.cards.length
}
