/**
 * 概念卡片间隔复习算法（共享给卡片页与今日页使用）
 *
 * 自评结果三态：
 * - pass（会了）  -> nextReviewAt 按 reviewIntervals 递推，取当前 reviewCount 对应的间隔；
 *                   reviewCount + 1；
 * - fuzzy（模糊） -> nextReviewAt = 明天；reviewCount 不变；
 * - fail（不会）  -> nextReviewAt = 今天；reviewCount 重置为 0。
 *
 * 所有日期运算走 utils/date，保证时区一致。
 */
import type { ConceptCard, ConceptCardType } from '../types/models'
import { CONCEPT_CARD_TYPE_LABEL } from '../types/models'
import { daysFromNowKey, toDateKey } from '../utils/date'

/** 自评结果 */
export type SelfRate = 'pass' | 'fuzzy' | 'fail'

/** 默认复习间隔（天），当 Settings 未提供时使用 */
export const DEFAULT_REVIEW_INTERVALS: number[] = [1, 3, 7, 14]

/** 默认每日卡片复习数量上限，当 Settings 未提供时使用 */
export const DEFAULT_DAILY_CARD_LIMIT = 5

/** 取一次取下一张待复习卡片时的「间隔天数」 */
export function nextIntervalDays(
  currentReviewCount: number,
  intervals: number[] = DEFAULT_REVIEW_INTERVALS,
): number {
  if (intervals.length === 0) return 1
  // 当前通过次数对应的间隔；超出数组长度后停留在最后一个
  const idx = Math.min(currentReviewCount, intervals.length - 1)
  return Math.max(1, intervals[idx])
}

/**
 * 计算某张卡片在某次自评后的新 nextReviewAt（YYYY-MM-DD）。
 * - pass  : 当前 reviewCount 对应的间隔天数后
 * - fuzzy : 明天
 * - fail  : 今天（立即再复习）
 */
export function nextReviewDateFor(card: ConceptCard, rate: SelfRate, intervals: number[] = DEFAULT_REVIEW_INTERVALS): string {
  if (rate === 'pass') {
    return daysFromNowKey(nextIntervalDays(card.reviewCount, intervals))
  }
  if (rate === 'fuzzy') {
    return daysFromNowKey(1)
  }
  // fail
  return toDateKey()
}

/** 一次自评后，卡片更新后的字段（不包含删除/新增） */
export function applySelfRate(
  card: ConceptCard,
  rate: SelfRate,
  intervals: number[] = DEFAULT_REVIEW_INTERVALS,
): Pick<ConceptCard, 'nextReviewAt' | 'reviewCount' | 'lastReviewedAt' | 'mastery' | 'updatedAt'> {
  const now = new Date().toISOString()
  const today = toDateKey()

  let reviewCount = card.reviewCount
  let nextReviewAt: string
  let mastery: ConceptCard['mastery']

  switch (rate) {
    case 'pass':
      nextReviewAt = daysFromNowKey(nextIntervalDays(reviewCount, intervals))
      reviewCount += 1
      mastery = reviewCount >= 3 ? 'applicable' : 'explainable'
      break
    case 'fuzzy':
      nextReviewAt = daysFromNowKey(1)
      // 模糊：reviewCount 不增加
      mastery = 'familiar'
      break
    case 'fail':
      nextReviewAt = today
      reviewCount = 0
      mastery = 'unknown'
      break
  }

  return { nextReviewAt, reviewCount, lastReviewedAt: today, mastery, updatedAt: now }
}

/** 制卡表单的类型 */
export interface NewCardDraft {
  type: ConceptCardType
  term: string
  definition: string
  examples: string
  tags: string
  /** 来源笔记 id（可选，空字符串表示未关联） */
  sourceNoteId: string
}

/** 生成新卡片的唯一 id */
export function newCardId(prefix = 'card'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 卡片类型的中文显示名（重新导出，方便页面引用） */
export { CONCEPT_CARD_TYPE_LABEL }

/** 卡片类型的全部可选项（保持表单与展示一致） */
export const CARD_TYPE_OPTIONS: ConceptCardType[] = ['hanzi', 'english', 'subject']
