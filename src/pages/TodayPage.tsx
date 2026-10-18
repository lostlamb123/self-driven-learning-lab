import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { isKeyOnOrBeforeToday, toDateKey } from '../utils/date'
import { computeStreak } from '../utils/streak'

/** 生成本地唯一的实体 id（带类型前缀，便于跨类型去重与调试） */
function newEntityId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export default function TodayPage() {
  const data = useAppStore((s) => s.data)
  const updateData = useAppStore((s) => s.updateData)

  const [newAction, setNewAction] = useState('')
  const todayKey = useMemo(() => toDateKey(), [])

  // 当天的行动列表（按 order 排序）
  const todayActions = useMemo(
    () =>
      data.actions
        .filter((a) => a.date === todayKey)
        .sort((a, b) => a.order - b.order),
    [data.actions, todayKey],
  )

  const streak = useMemo(() => computeStreak(data.actions), [data.actions])

  // 今日是否已有复盘记录
  const reviewedToday = useMemo(
    () => data.reviews.some((r) => r.date === todayKey),
    [data.reviews, todayKey],
  )

  // 今日待复习的卡片数：nextReviewAt 不晚于今天的概念卡片
  const dueCardsCount = useMemo(
    () =>
      data.concepts.filter((c) => c.nextReviewAt !== undefined && isKeyOnOrBeforeToday(c.nextReviewAt)).length,
    [data.concepts],
  )

  /** 新增行动：默认关联当天日期，类型默认 practice，order 追加到末尾 */
  function handleAddAction(e: FormEvent) {
    e.preventDefault()
    const title = newAction.trim()
    if (!title) return

    updateData((draft) => {
      const maxOrder = draft.actions.reduce((m, a) => Math.max(m, a.order), 0)
      const now = new Date().toISOString()
      draft.actions.push({
        id: newEntityId('act'),
        createdAt: now,
        updatedAt: now,
        date: todayKey,
        title,
        type: 'practice',
        status: 'todo',
        estimatedMinutes: 15,
        order: maxOrder + 1,
      })
    })
    setNewAction('')
  }

  /** 切换完成/未完成状态 */
  function toggleAction(actionId: string) {
    updateData((draft) => {
      const target = draft.actions.find((a) => a.id === actionId)
      if (!target) return
      target.status = target.status === 'done' ? 'todo' : 'done'
      target.updatedAt = new Date().toISOString()
      if (target.status === 'done') {
        // 完成时若未填实际耗时，给一个默认值
        target.actualMinutes = target.actualMinutes ?? target.estimatedMinutes
      }
    })
  }

  const quickLinks = [
    { path: '/cards', label: '卡片', desc: '间隔复习', icon: '▤' },
    { path: '/reading', label: '阅读', desc: '读书笔记', icon: '📖' },
    { path: '/writing', label: '写作', desc: '表达输出', icon: '✎' },
    { path: '/critical', label: '明辨', desc: '批判思维', icon: '⚖' },
  ]

  const todayLabel = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'full',
  }).format(new Date())

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight">今日</h1>
        <p className="mt-0.5 text-sm text-slate-500">{todayLabel}</p>
      </header>

      {/* 指标卡 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">连续行动</div>
          <div className="mt-1 text-3xl font-bold text-teal-600">{streak}</div>
          <div className="text-xs text-slate-400">天</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">今日待复习</div>
          <div className="mt-1 text-3xl font-bold text-slate-800">{dueCardsCount}</div>
          <div className="text-xs text-slate-400">张概念卡片</div>
        </div>
      </div>

      {/* 快速入口 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">快速入口</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickLinks.map((l) => (
            <Link
              key={l.path}
              to={l.path}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-teal-300 hover:bg-teal-50"
            >
              <span className="text-2xl" aria-hidden>
                {l.icon}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800 group-hover:text-teal-700">
                  {l.label}
                </span>
                <span className="text-xs text-slate-400">{l.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 复盘入口 */}
      <Link
        to="/review"
        className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
          reviewedToday
            ? 'border-teal-300 bg-teal-50 hover:bg-teal-100'
            : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            ↻
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-800">
              {reviewedToday ? '查看今日复盘' : '去复盘'}
            </div>
            <div className="text-xs text-slate-400">
              {reviewedToday ? '今日已复盘，点击可查看与修改' : '花 2 分钟回顾今天'}
            </div>
          </div>
        </div>
        <span className="text-slate-400">→</span>
      </Link>

      {/* 今日最小行动 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">今日最小行动</h2>

        <form onSubmit={handleAddAction} className="mb-3 flex gap-2">
          <input
            value={newAction}
            onChange={(e) => setNewAction(e.target.value)}
            placeholder="今天要做的一件小事…"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
          <button
            type="submit"
            disabled={!newAction.trim()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            添加
          </button>
        </form>

        {todayActions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400">
            今天还没有行动，添加一个最小的、能立刻动手的事。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {todayActions.map((a) => {
              const done = a.status === 'done'
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => toggleAction(a.id)}
                    aria-label={done ? '标记未完成' : '标记完成'}
                    className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border text-xs transition-colors ${
                      done
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300 text-transparent hover:border-teal-400'
                    }`}
                  >
                    ✓
                  </button>
                  <span
                    className={`flex-1 text-sm ${
                      done ? 'text-slate-400 line-through' : 'text-slate-700'
                    }`}
                  >
                    {a.title}
                  </span>
                  <span className="text-xs text-slate-400">{a.estimatedMinutes} 分钟</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
