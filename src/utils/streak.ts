/**
 * 连续打卡天数计算（今日页 / 复盘页共用）
 *
 * 规则：若昨天和今天都有完成的行动，则天数累加；
 * 今天必须有完成才计数，从昨天起往前回溯，断一天即停。
 */
import type { DailyAction } from '../types/models'
import { daysAgoKey, toDateKey } from './date'

export function computeStreak(actions: DailyAction[], base: Date = new Date()): number {
  const todayKey = toDateKey(base)
  const doneByDate = new Map<string, boolean>()
  for (const a of actions) {
    if (a.status === 'done') doneByDate.set(a.date, true)
  }

  let streak = 0
  if (doneByDate.has(todayKey)) {
    streak = 1
    for (let i = 1; i <= 365; i++) {
      if (doneByDate.has(daysAgoKey(i, base))) {
        streak += 1
      } else {
        break
      }
    }
  }
  return streak
}
