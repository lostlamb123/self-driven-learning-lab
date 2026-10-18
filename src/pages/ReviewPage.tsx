import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { toDateKey } from '../utils/date'
import { computeStreak } from '../utils/streak'
import { getTodayCardStats } from '../utils/reviewStats'
import type { DailyAction, ReviewScores } from '../types/models'

/** 生成实体 id（与其他页面一致的格式） */
function newEntityId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 当天的行动完成情况 */
function getTodayActionSummary(actions: DailyAction[], todayKey: string) {
  const todayActions = actions.filter((a) => a.date === todayKey)
  const doneCount = todayActions.filter((a) => a.status === 'done').length
  return { total: todayActions.length, doneCount }
}

const EMPTY_SCORES: ReviewScores = { focus: 3, completion: 3, curiosity: 3, energy: 3 }

export default function ReviewPage() {
  const data = useAppStore((s) => s.data)
  const updateData = useAppStore((s) => s.updateData)
  const notify = useAppStore((s) => s.notify)

  const todayKey = useMemo(() => toDateKey(), [])

  /* ----------------------- 概览：全部来自共享函数 ----------------------- */
  const streak = useMemo(() => computeStreak(data.actions), [data.actions])
  const cardStats = useMemo(() => getTodayCardStats(data.concepts), [data.concepts])
  const { total: actionTotal, doneCount: actionDone } = useMemo(
    () => getTodayActionSummary(data.actions, todayKey),
    [data.actions, todayKey],
  )

  /** 当天是否已有复盘记录（同一 date 只保留一条） */
  const todayReview = useMemo(
    () => data.reviews.find((r) => r.date === todayKey) ?? null,
    [data.reviews, todayKey],
  )

  /* -------------------------- 表单本地状态 -------------------------- */
  const [form, setForm] = useState<{
    done: string
    blockers: string
    insight: string
    nextAdjustment: string
    scores: ReviewScores
  } | null>(null)
  /** 最近一次提交是否触发了"覆盖已有"（用于 toast 文案区分） */
  const [overwritten, setOverwritten] = useState(false)

  // 进入页面时：有当日复盘则回填，否则给一份空白草稿
  useEffect(() => {
    if (todayReview) {
      setForm({
        done: todayReview.done.join('\n'),
        blockers: todayReview.blockers.join('\n'),
        insight: todayReview.insight,
        nextAdjustment: todayReview.nextAdjustment ?? '',
        scores: todayReview.scores,
      })
    } else {
      setForm({
        done: '',
        blockers: '',
        insight: '',
        nextAdjustment: '',
        scores: { ...EMPTY_SCORES },
      })
    }
  }, [todayReview])

  /** "带入今日数据"：把当天行动/卡片复习写成一句草稿，用户可再改 */
  function bringInTodayData() {
    if (!form) return
    const passRate =
      cardStats.todayPassRate === null ? '尚无记录' : `${cardStats.todayPassRate}%`
    const draft =
      `今天完成了 ${actionDone}/${actionTotal} 件行动，` +
      `复习了 ${cardStats.reviewedTodayCount} 张卡片（通过率 ${passRate}）。`
    setForm((f) => (f ? { ...f, insight: draft } : f))
  }

  /** "把卡点变成调整"：把第一条 blocker 写成"明天先处理：{blocker}"填入 nextAdjustment */
  function bringInBlocker() {
    const firstBlocker = (form?.blockers ?? '')
      .split('\n')
      .map((s) => s.trim())
      .find(Boolean)
    if (!firstBlocker) return
    setForm((f) => (f ? { ...f, nextAdjustment: `明天先处理：${firstBlocker}` } : f))
  }

  function setScore(key: keyof ReviewScores, value: number) {
    setForm((f) => (f ? { ...f, scores: { ...f.scores, [key]: value } } : f))
  }

  /** 保存：当天已有记录则覆盖，否则新增（同日始终只有一条） */
  function save() {
    if (!form) return
    const doneLines = form.done.split('\n').map((s) => s.trim()).filter(Boolean)
    const blockerLines = form.blockers.split('\n').map((s) => s.trim()).filter(Boolean)
    const nextAdjustment = form.nextAdjustment.trim() || undefined

    updateData((draft) => {
      const now = new Date().toISOString()
      const existing = draft.reviews.find((r) => r.date === todayKey)
      if (existing) {
        // 覆盖已有记录
        existing.done = doneLines
        existing.blockers = blockerLines
        existing.insight = form.insight.trim()
        existing.scores = form.scores
        existing.nextAdjustment = nextAdjustment
        existing.updatedAt = now
      } else {
        draft.reviews.push({
          id: newEntityId('rev'),
          createdAt: now,
          updatedAt: now,
          date: todayKey,
          done: doneLines,
          blockers: blockerLines,
          insight: form.insight.trim(),
          scores: form.scores,
          nextAdjustment,
          actionIds: draft.actions
            .filter((a) => a.date === todayKey && a.status === 'done')
            .map((a) => a.id),
        })
      }
    })
    setOverwritten(Boolean(todayReview))
    notify('success', todayReview ? '已更新今日复盘' : '已保存今日复盘', 2500)
  }

  /* -------------------------- 历史复盘列表 -------------------------- */
  const recentReviews = useMemo(
    () =>
      [...data.reviews]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7),
    [data.reviews],
  )

  /** 展开的历史条目 */
  const [expandedId, setExpandedId] = useState<string | null>(null)
  /** 删除二次确认状态 */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function deleteReview(id: string) {
    updateData((draft) => {
      const idx = draft.reviews.findIndex((r) => r.id === id)
      if (idx >= 0) draft.reviews.splice(idx, 1)
    })
    setConfirmDeleteId(null)
    notify('info', '已删除该条复盘', 2000)
  }

  const passRateLabel =
    cardStats.todayPassRate === null ? '—' : `${cardStats.todayPassRate}%`

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">复盘</h1>
        <p className="mt-0.5 text-sm text-slate-500">花两分钟回顾今天，驱动明天</p>
      </header>

      {/* 今日概览（只读） */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">今日概览</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-400">行动完成</div>
            <div className="font-semibold text-slate-800">
              {actionDone} / {actionTotal}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">卡片复习</div>
            <div className="font-semibold text-slate-800">
              {cardStats.reviewedTodayCount} 张
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">今日通过率</div>
            <div className="font-semibold text-teal-600">{passRateLabel}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">连续行动</div>
            <div className="font-semibold text-teal-600">{streak} 天</div>
          </div>
        </div>
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            todayReview
              ? 'bg-teal-50 text-teal-700'
              : 'bg-slate-50 text-slate-500'
          }`}
        >
          {todayReview ? '今日已复盘（下方可修改）' : '今日尚未复盘'}
        </div>
      </section>

      {/* 复盘表单 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-700">
          {todayReview ? '编辑今日复盘' : '今日复盘'}
        </h2>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">今天做成了什么（done）</label>
          <textarea
            value={form?.done ?? ''}
            onChange={(e) => setForm((f) => (f ? { ...f, done: e.target.value } : f))}
            rows={2}
            placeholder={'一行一件，如：\n完成了 2 件行动\n复习了 3 张卡片'}
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">遇到的阻碍（blockers）</label>
          <textarea
            value={form?.blockers ?? ''}
            onChange={(e) => setForm((f) => (f ? { ...f, blockers: e.target.value } : f))}
            rows={2}
            placeholder="一行一个阻碍"
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-500">最大收获（insight）</label>
            <button
              type="button"
              onClick={bringInTodayData}
              className="rounded border border-teal-300 px-2 py-0.5 text-xs text-teal-700 hover:bg-teal-50"
            >
              带入今日数据
            </button>
          </div>
          <textarea
            value={form?.insight ?? ''}
            onChange={(e) => setForm((f) => (f ? { ...f, insight: e.target.value } : f))}
            rows={2}
            placeholder="今天学到的最重要的一件事"
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">自驱力评分（1-5）</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            {(
              [
                { key: 'focus', label: '专注度' },
                { key: 'completion', label: '完成度' },
                { key: 'curiosity', label: '好奇心' },
                { key: 'energy', label: '精力' },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-slate-600">{label}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setScore(key, v)}
                      className={`h-9 w-9 rounded text-xs transition-colors ${
                        (form?.scores[key] ?? 0) >= v
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                      aria-label={`${label} ${v}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-slate-500">
              明天要调整的一件事（可选）
            </label>
            {(() => {
              const hasBlocker =
                (form?.blockers ?? '')
                  .split('\n')
                  .map((s) => s.trim())
                  .some(Boolean)
              return hasBlocker ? (
                <button
                  type="button"
                  onClick={bringInBlocker}
                  className="rounded border border-amber-300 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-50"
                >
                  把卡点变成调整
                </button>
              ) : null
            })()}
          </div>
          <input
            value={form?.nextAdjustment ?? ''}
            onChange={(e) =>
              setForm((f) => (f ? { ...f, nextAdjustment: e.target.value } : f))
            }
            placeholder="留给明天的一句话"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
        >
          {todayReview ? '保存修改' : '保存复盘'}
        </button>
        {overwritten && todayReview === null && (
          <p className="text-xs text-slate-400">刚刚已保存，同日不会再新增记录。</p>
        )}
      </section>

      {/* 历史复盘列表 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">历史复盘</h2>
        {recentReviews.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400">
            还没有复盘记录。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentReviews.map((r) => {
              const insightPreview = r.insight || '（无 insight）'
              const isExpanded = expandedId === r.id
              const isConfirming = confirmDeleteId === r.id
              return (
                <li key={r.id} className="rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    className="flex w-full flex-col gap-1 px-3 py-2.5 text-left"
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{r.date}</span>
                      <span className="text-xs text-slate-400">完成 {r.done.length} 件</span>
                    </span>
                    <span className="truncate text-xs text-slate-500">{insightPreview}</span>
                    {r.nextAdjustment && (
                      <span className="truncate text-xs text-amber-600">
                        明日调整：{r.nextAdjustment}
                      </span>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-3 text-xs">
                      {r.done.length > 0 && (
                        <div>
                          <span className="font-medium text-teal-600">做成了：</span>
                          <div className="mt-1 flex flex-col gap-0.5 text-slate-600">
                            {r.done.map((d, i) => (
                              <span key={i}>· {d}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {r.blockers.length > 0 && (
                        <div>
                          <span className="font-medium text-amber-600">阻碍：</span>
                          <div className="mt-1 flex flex-col gap-0.5 text-slate-600">
                            {r.blockers.map((b, i) => (
                              <span key={i}>· {b}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-slate-700">收获：</span>
                        <div className="mt-1 text-slate-600">{r.insight || '（无）'}</div>
                      </div>
                      {r.nextAdjustment && (
                        <div>
                          <span className="font-medium text-slate-700">明天调整：</span>
                          <div className="mt-1 text-slate-600">{r.nextAdjustment}</div>
                        </div>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          删除
                        </button>
                        {isConfirming && (
                          <span className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => deleteReview(r.id)}
                              className="rounded bg-red-600 px-2 py-1 text-xs text-white"
                            >
                              确认删除
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
                            >
                              取消
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
