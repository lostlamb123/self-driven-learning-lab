/**
 * 今日速览（只读、不评判）：聚合三个已有 store 的当天数据，
 * 供复盘页「今日速览卡」使用。
 *
 * 数据来源（不新建重复数据）：
 * - useMinimalActionStore：actions（text/tags/difficulty/status/mood/completedAt）
 * - useCuriositySeedStore：seeds（text/createdAt）
 * - useConceptCardStore：cards（status/reviewCount/lastReviewedAt）
 *
 * 所有聚合都在客户端现算，0 项显示「今天没有记录」，不用红色/警告色。
 */
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMinimalActionStore, selectTodayActions } from '../stores/minimalActionStore'
import { useCuriositySeedStore, selectTodaySeeds } from '../stores/curiositySeedStore'
import { useConceptCardStore, selectTodayCards, selectMasteredCount } from '../stores/conceptCardStore'
import { toDateKey } from '../utils/date'
import type { MinimalMood } from '../types/models'

export interface TodaySnapshot {
  /** 最小行动：完成数 / 总数 */
  actionsDone: number
  actionsTotal: number
  /** 今日情绪分布（只显示有数据的） */
  moodCounts: Partial<Record<MinimalMood, number>>
  /** 好奇种子总数 */
  seedsCount: number
  /** 前 3 条种子文本（超出显示「还有 N 颗」） */
  seedsPreview: string[]
  seedsExtraCount: number
  /** 今日卡片：刷了 N 张（lastReviewedAt 是今天），其中「会了」N 张 */
  cardsReviewedToday: number
  cardsMastered: number
  /** 今日还有多少张待刷（供底部入口判断） */
  cardsPending: number
}

export function useTodaySnapshot(): TodaySnapshot {
  const todayActions = useMinimalActionStore(
    useShallow((s) => selectTodayActions(s)),
  )
  const todaySeeds = useCuriositySeedStore(
    useShallow((s) => selectTodaySeeds(s)),
  )
  /** 今日刷新过的卡：lastReviewedAt 是今天的 */
  const cards = useConceptCardStore((s) => s.cards)
  const todayCards = useConceptCardStore(useShallow((s) => selectTodayCards(s)))
  const masteredCount = useConceptCardStore(selectMasteredCount)

  return useMemo<TodaySnapshot>(() => {
    const todayKey = toDateKey()

    const done = todayActions.filter((a) => a.status === 'done').length
    const total = todayActions.length

    // 情绪分布：统计「完成且选了情绪」的行动（pending 的没有 mood）
    const moodCounts: Partial<Record<MinimalMood, number>> = {}
    for (const a of todayActions) {
      if (a.status === 'done' && a.mood) {
        moodCounts[a.mood] = (moodCounts[a.mood] ?? 0) + 1
      }
    }

    // 好奇种子
    const seedsPreview = todaySeeds.slice(0, 3).map((s) => s.text)
    const seedsExtraCount = Math.max(0, todaySeeds.length - 3)

    // 今日刷过的卡片：lastReviewedAt 是今天
    const reviewedToday = cards.filter(
      (c) => c.lastReviewedAt !== undefined && c.lastReviewedAt === todayKey,
    ).length
    // 其中「会了」：status=mastered 且 lastReviewedAt 是今天（今天标记为会了的）
    const masteredToday = cards.filter(
      (c) => c.status === 'mastered' && c.lastReviewedAt === todayKey,
    ).length

    return {
      actionsDone: done,
      actionsTotal: total,
      moodCounts,
      seedsCount: todaySeeds.length,
      seedsPreview,
      seedsExtraCount,
      cardsReviewedToday: reviewedToday,
      cardsMastered: masteredToday,
      cardsPending: todayCards.length,
    }
  }, [todayActions, todaySeeds, cards, todayCards, masteredCount])
}
