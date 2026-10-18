/**
 * 今日卡片复习统计（卡片页 / 今日页 / 复盘页共用，避免三处各算各的）
 *
 * - reviewedTodayCount：lastReviewedAt 为今天的卡片数
 * - passedTodayCount  ：今日已复习中 mastery 达到 explainable 及以上的张数
 * - todayPassRate     ：passedTodayCount / reviewedTodayCount * 100，无今日记录时返回 null
 */
import type { ConceptCard } from '../types/models'
import { toDateKey } from './date'

export interface CardReviewStats {
  /** 今日已复习的卡片数 */
  reviewedTodayCount: number
  /** 今日已复习中通过的张数 */
  passedTodayCount: number
  /** 今日通过率（0-100），无今日记录时为 null */
  todayPassRate: number | null
}

export function getTodayCardStats(concepts: ConceptCard[], base: Date = new Date()): CardReviewStats {
  const todayKey = toDateKey(base)
  const reviewedToday = concepts.filter((c) => c.lastReviewedAt === todayKey)
  const passedToday = reviewedToday.filter(
    (c) => c.mastery === 'explainable' || c.mastery === 'applicable',
  )
  const todayPassRate =
    reviewedToday.length === 0 ? null : Math.round((passedToday.length / reviewedToday.length) * 100)

  return {
    reviewedTodayCount: reviewedToday.length,
    passedTodayCount: passedToday.length,
    todayPassRate,
  }
}
