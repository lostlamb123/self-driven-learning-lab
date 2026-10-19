import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../store/appStore'
import { toDateKey } from '../utils/date'
import { useMinimalActionStore, computeActionStreak } from '../stores/minimalActionStore'
import {
  useConceptCardStore,
  selectTodayCards,
} from '../stores/conceptCardStore'
import { useDailyReviewStore, selectTodayReview } from '../stores/dailyReviewStore'
import MinimalActionSection from '../components/minimal-action/MinimalActionSection'
import CuriositySeedSection from '../components/curiosity-seed/CuriositySeedSection'
import styles from './TodayPage.module.css'

/**
 * 今日页 —— 把「今日最小行动」与「今日好奇种子」组合到同一页面（路由 /today）。
 *
 * 页面结构（自上而下）：
 * 1. 页面标题「今天只做一件小事」
 * 2. 副标题「小到不会逃避，就是最好的开始。」
 * 3. 今日最小行动：输入区 + 行动卡片列表
 * 4. 今日好奇种子：输入框 + 今日种子列表（最多 5 条，超出可展开）
 * 5. 底部极轻量「连续做到」展示：有记录才显示，不催促
 *
 * 样式基调：移动端优先单列、大量留白、12px 圆角、浅灰边框，
 * 不用红色/警告色/倒计时。
 */
export default function TodayPage() {
  const data = useAppStore((s) => s.data)
  const todayKey = useMemo(() => toDateKey(), [])

  // 今日是否已有复盘记录（保留「去复盘」入口）
  const reviewedToday = useMemo(
    () => data.reviews.some((r) => r.date === todayKey),
    [data.reviews, todayKey],
  )

  const quickLinks = [
    { path: '/cards', label: '卡片', desc: '间隔复习', icon: '▤' },
    { path: '/reading', label: '阅读', desc: '读书笔记', icon: '📖' },
    { path: '/writing', label: '写作', desc: '表达输出', icon: '✎' },
    { path: '/critical', label: '明辨', desc: '批判思维', icon: '⚖' },
  ]

  const todayLabel = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'full',
  }).format(new Date())

  /* 底部「连续做到」展示：读最小行动 store 的完成记录，允许断签 */
  const allActions = useMinimalActionStore((s) => s.actions)
  const streak = useMemo(() => computeActionStreak(allActions), [allActions])
  // 只在「有完成记录」时显示；无记录则整块隐藏（不催促）
  const showStreak = streak.active || streak.streak > 0

  /* 「概念卡片」入口：读今日待刷卡数，只在有卡时显示（不强制、不催促） */
  const pendingConceptCount = useConceptCardStore(
    useShallow((s) => selectTodayCards(s).length),
  )

  /* 元认知复盘入口：读今日是否已复盘 */
  const metaReviewedToday = useDailyReviewStore((s) =>
    selectTodayReview(s) !== null,
  )

  return (
    <div className="flex flex-col gap-8">
      {/* 1. 页面标题 + 2. 副标题 */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          今天只做一件小事
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          小到不会逃避，就是最好的开始。
        </p>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{todayLabel}</p>
      </header>

      {/* 3. 今日最小行动（输入区 + 行动卡片列表） */}
      <MinimalActionSection />

      {/* 4. 今日好奇种子（输入框 + 今日种子列表） */}
      <CuriositySeedSection />

      {/* 「概念卡片」入口：有今日待刷卡时才显示，轻量、不催促 */}
      {pendingConceptCount > 0 && (
        <Link
          to="/concept-cards"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:bg-slate-700"
        >
          今天还有 {pendingConceptCount} 张卡片没刷
          <span aria-hidden>→</span>
        </Link>
      )}

      {/* 5. 底部极轻量「连续做到」展示：有记录才显示，不催促 */}
      {showStreak && (
        <footer className="border-t border-slate-200 pt-5 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            你已经连续做到 {streak.streak} 天。
          </p>
          {/* 随天数变化的原理短句：非催促，只说联结本身 */}
          <p className={styles.streakHint}>
            {streakPrinciple(streak.streak, streak.restarted)}
          </p>
        </footer>
      )}

      {/* 元认知复盘入口：未复盘→「花 2 分钟…」；已复盘→「今天已复盘…」；不催促、不红点、不连续打卡 */}
      <Link
        to="/review"
        className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:bg-slate-700"
      >
        {metaReviewedToday
          ? '今天已复盘。可以再看看'
          : '花 2 分钟，给今天留一条反馈'}
        <span aria-hidden>→</span>
      </Link>

      {/* 费曼输出入口：极轻、不催促，引导把理解讲给别人听 */}
      <Link
        to="/output?tab=feynman"
        className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:bg-slate-700"
      >
        今天想讲清楚哪个概念？
        <span aria-hidden>→</span>
      </Link>

      {/* 一页纸入口：极轻、不催促，与费曼入口并列，引导「从点到网」 */}
      <Link
        to="/output?tab=one-pager"
        className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:bg-slate-700"
      >
        想把今天学的串成一张网？
        <span aria-hidden>→</span>
      </Link>

      {/* 快速入口 + 复盘入口（保留原有能力，弱化视觉权重） */}
      <section className="border-t border-slate-200 pt-6 dark:border-slate-700">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            想去别的地方
          </h2>
          <Link
            to="/review"
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              reviewedToday
                ? 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-500/50 dark:bg-teal-900/30 dark:text-teal-300'
                : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {reviewedToday ? '查看今日复盘' : '去复盘'}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {quickLinks.map((l) => (
            <Link
              key={l.path}
              to={l.path}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-teal-300 hover:bg-teal-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-teal-500/50 dark:hover:bg-slate-700"
            >
              <span className="text-xl" aria-hidden>
                {l.icon}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800 group-hover:text-teal-700 dark:text-slate-100">
                  {l.label}
                </span>
                <span className="text-xs text-slate-400">{l.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

/**
 * 连续做到天数的原理短句（随天数变化，非催促）。
 *
 * - 断签后今天重新开始 → 先说「重新开始也是一次做到」（不制造断签焦虑）
 * - 1—2 天：联结刚建立
 * - 3—6 天：强化期
 * - 7 天以上：回路较稳固
 */
function streakPrinciple(streak: number, restarted: boolean): string {
  if (restarted) return '重新开始也是一次做到。联结不会因为断一天就消失。'
  if (streak >= 7) {
    return '这条回路已经比较稳固了。断一天也不会消失，但再亮一次会更好。'
  }
  if (streak >= 3) return '联结正在被强化，信息传输在变快。'
  return '新的联结刚刚亮起。'
}
