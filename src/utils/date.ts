/** 日期工具：所有按天聚合都用本地时区的 YYYY-MM-DD 字符串，避免时区漂移 */

/** 取本地日期 key（YYYY-MM-DD） */
export function toDateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 取 N 天前的本地日期 key */
export function daysAgoKey(n: number, base: Date = new Date()): string {
  const d = new Date(base)
  d.setDate(d.getDate() - n)
  return toDateKey(d)
}

/** 取 N 天后的本地日期 key（n=0 即今天） */
export function daysFromNowKey(n: number, base: Date = new Date()): string {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

/**
 * 判断给定日期 key 是否「不晚于今天」（即今天或已过期的复习日）。
 * 本地时区下做字符串比较即可：YYYY-MM-DD 的字典序 == 时间序。
 */
export function isKeyOnOrBeforeToday(key: string, base: Date = new Date()): boolean {
  return key <= toDateKey(base)
}

/** 判断给定日期 key 是否为今天 */
export function isKeyToday(key: string, base: Date = new Date()): boolean {
  return key === toDateKey(base)
}

/** 把 YYYY-MM-DD 解析为当天 00:00:00 的本地 Date（用于日期加减） */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
