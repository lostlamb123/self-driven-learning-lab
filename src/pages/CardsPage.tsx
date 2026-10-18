import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import {
  isKeyOnOrBeforeToday,
  toDateKey,
} from '../utils/date'
import { getTodayCardStats } from '../utils/reviewStats'
import {
  applySelfRate,
  CARD_TYPE_OPTIONS,
  CONCEPT_CARD_TYPE_LABEL,
  DEFAULT_DAILY_CARD_LIMIT,
  DEFAULT_REVIEW_INTERVALS,
  newCardId,
  type NewCardDraft,
  type SelfRate,
} from '../utils/cards'
import { REFERENCE_LABEL, resolveNoteRefs } from '../utils/references'
import type { ConceptCard, ConceptCardType, CriticalCase, ReadingNote } from '../types/models'

/** 自评按钮的文案与样式 */
const RATE_OPTIONS: { value: SelfRate; label: string; hint: string; cls: string }[] = [
  { value: 'fail', label: '不会', hint: '今天再复习一次', cls: 'border-red-300 text-red-700 hover:bg-red-50' },
  { value: 'fuzzy', label: '模糊', hint: '明天再看', cls: 'border-amber-300 text-amber-700 hover:bg-amber-50' },
  { value: 'pass', label: '会了', hint: '进入下一轮间隔', cls: 'border-teal-500 text-teal-700 hover:bg-teal-50' },
]

export default function CardsPage() {
  const data = useAppStore((s) => s.data)
  const updateData = useAppStore((s) => s.updateData)
  const notify = useAppStore((s) => s.notify)

  const todayKey = useMemo(() => toDateKey(), [])
  void todayKey

  const reviewIntervals = data.settings.reviewIntervals?.length
    ? data.settings.reviewIntervals
    : DEFAULT_REVIEW_INTERVALS
  const dailyCardLimit = data.settings.dailyCardLimit ?? DEFAULT_DAILY_CARD_LIMIT

  /* ------------------------------ 顶部统计 ------------------------------ */
  const cardStats = useMemo(
    () => getTodayCardStats(data.concepts),
    [data.concepts],
  )

  const stats = useMemo(() => {
    const due = data.concepts.filter(
      (c) => c.nextReviewAt !== undefined && isKeyOnOrBeforeToday(c.nextReviewAt),
    )
    const mastered = data.concepts.filter(
      (c) => c.nextReviewAt !== undefined && !isKeyOnOrBeforeToday(c.nextReviewAt),
    )

    return { due, mastered, reviewedTodayCount: cardStats.reviewedTodayCount, passRate: cardStats.todayPassRate }
  }, [data.concepts, cardStats.reviewedTodayCount, cardStats.todayPassRate])

  /* ------------------------------- 复习区 -------------------------------- */
  const queue = useMemo(() => {
    return [...stats.due]
      .sort((a, b) => (a.nextReviewAt ?? '').localeCompare(b.nextReviewAt ?? ''))
      .slice(0, dailyCardLimit)
  }, [stats.due, dailyCardLimit])

  const [queueIds, setQueueIds] = useState<string[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showBack, setShowBack] = useState(false)

  // 复习会话开始时的队列（按 id 锁定，避免自评后动态重排）
  const sessionQueue = useMemo(() => {
    if (queueIds.length > 0) {
      return queueIds
        .map((id) => data.concepts.find((c) => c.id === id))
        .filter((c): c is ConceptCard => Boolean(c))
    }
    return []
  }, [queueIds, data.concepts])

  const currentCard: ConceptCard | undefined = sessionQueue[currentIdx]
  const sessionDone = currentIdx >= sessionQueue.length

  /** 点击「开始复习」：按当前待复习队列开启一次会话 */
  function startReview() {
    setQueueIds(queue.map((c) => c.id))
    setCurrentIdx(0)
    setShowBack(false)
  }

  /** 自评当前卡片 */
  function rate(rate: SelfRate) {
    if (!currentCard) return
    const id = currentCard.id
    updateData((draft) => {
      const target = draft.concepts.find((c) => c.id === id)
      if (!target) return
      const patch = applySelfRate(target, rate, reviewIntervals)
      Object.assign(target, patch)
    })
    // 切到下一张
    setCurrentIdx((i) => i + 1)
    setShowBack(false)
  }

  /* ------------------------------- 制卡区 -------------------------------- */
  const emptyDraft: NewCardDraft = {
    type: 'subject',
    term: '',
    definition: '',
    examples: '',
    tags: '',
    sourceNoteId: '',
  }
  const [draft, setDraft] = useState<NewCardDraft>(emptyDraft)

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    const term = draft.term.trim()
    if (!term) return

    updateData((draftState) => {
      const now = new Date().toISOString()
      const card: ConceptCard = {
        id: newCardId(),
        createdAt: now,
        updatedAt: now,
        type: draft.type,
        term,
        definition: draft.definition.trim(),
        whyItMatters: '',
        examples: draft.examples.trim() ? [draft.examples.trim()] : [],
        confusions: [],
        sourceNoteIds: draft.sourceNoteId ? [draft.sourceNoteId] : [],
        tags: draft.tags
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean),
        mastery: 'unknown',
        reviewCount: 0,
        nextReviewAt: toDateKey(), // 今天即进入待复习
        lastReviewedAt: undefined,
      }
      draftState.concepts.push(card)
    })
    setDraft(emptyDraft)
    notify('success', '已加入今日复习', 3000)
  }

  /** 编辑卡片 */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<NewCardDraft>(emptyDraft)

  function startEdit(card: ConceptCard) {
    setEditingId(card.id)
    setEditDraft({
      type: card.type,
      term: card.term,
      definition: card.definition,
      examples: card.examples.join('；'),
      tags: card.tags.join('，'),
      sourceNoteId: card.sourceNoteIds?.[0] ?? '',
    })
  }

  function saveEdit() {
    if (!editingId) return
    updateData((draftState) => {
      const target = draftState.concepts.find((c) => c.id === editingId)
      if (!target) return
      target.type = editDraft.type
      target.term = editDraft.term.trim() || target.term
      target.definition = editDraft.definition.trim()
      target.examples = editDraft.examples
        .split(/[,，；;]\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
      target.tags = editDraft.tags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean)
      // 来源笔记：选了就更新，没选则保留原有引用
      if (editDraft.sourceNoteId) {
        target.sourceNoteIds = [editDraft.sourceNoteId]
      }
      target.updatedAt = new Date().toISOString()
    })
    setEditingId(null)
    setEditDraft(emptyDraft)
  }

  /** 删除卡片 */
  function removeCard(id: string) {
    updateData((draftState) => {
      const idx = draftState.concepts.findIndex((c) => c.id === id)
      if (idx >= 0) draftState.concepts.splice(idx, 1)
    })
  }

  /** 最近创建的 5 张卡 */
  const recentCards = useMemo(
    () =>
      [...data.concepts]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [data.concepts],
  )

  const isEditing = editingId !== null

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">卡片</h1>
        <p className="mt-0.5 text-sm text-slate-500">间隔复习与卡片制作</p>
      </header>

      {/* 顶部统计 */}
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="待复习" value={stats.due.length} accent />
        <StatBox label="已掌握" value={stats.mastered.length} />
        <StatBox label="今日已复习" value={stats.reviewedTodayCount} />
        <StatBox label="今日通过率" value={stats.passRate === null ? '—' : `${stats.passRate}%`} />
      </div>

      {/* Tab 切换：复习区 / 制卡区 */}
      <div className="flex gap-1 border-b border-slate-200">
        <TabLabel active={!isEditing} label="复习" onClick={() => setEditingId(null)} />
        <TabLabel active={isEditing} label="制卡" onClick={() => setEditingId('__new__')} />
      </div>

      {/* 复习区 */}
      {!isEditing && (
        <section className="flex flex-col gap-4">
          {queue.length === 0 ? (
            <EmptyReview passRate={stats.passRate} />
          ) : sessionQueue.length === 0 ? (
            <ReviewStartPanel
              count={queue.length}
              limit={dailyCardLimit}
              onStart={startReview}
            />
          ) : sessionDone ? (
            <ReviewDonePanel passRate={stats.passRate} onRestart={() => startReview()} />
          ) : currentCard ? (
            <ReviewCardView
              card={currentCard}
              index={currentIdx}
              total={sessionQueue.length}
              showBack={showBack}
              onToggleBack={() => setShowBack((v) => !v)}
              onRate={rate}
            />
          ) : null}
        </section>
      )}

      {/* 制卡区 */}
      {isEditing && (
        <section className="flex flex-col gap-5">
          {editingId === '__new__' ? (
            <CardForm
              value={draft}
              onChange={setDraft}
              onSubmit={handleCreate}
              submitLabel="加入今日复习"
              notes={data.notes}
            />
          ) : (
            <CardForm
              value={editDraft}
              onChange={setEditDraft}
              onSubmit={() => {
                saveEdit()
              }}
              submitLabel="保存修改"
              notes={data.notes}
            />
          )}

          {/* 最近创建的卡片 */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">最近创建的卡片</h2>
            {recentCards.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400">
                还没有卡片，先制作一张。
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recentCards.map((c) => (
                  <RecentCardRow
                    key={c.id}
                    card={c}
                    notes={data.notes}
                    cases={data.cases}
                    onEdit={() => startEdit(c)}
                    onRemove={() => removeCard(c.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

/* ============================ 子组件 ============================ */

function StatBox({
  label,
  value,
  accent = false,
}: {
  label: string
  value: number | string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold ${accent ? 'text-teal-600' : 'text-slate-800'}`}>
        {value}
      </div>
    </div>
  )
}

function TabLabel({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'text-teal-700' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-teal-600" />}
    </button>
  )
}

function ReviewStartPanel({
  count,
  limit,
  onStart,
}: {
  count: number
  limit: number
  onStart: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm text-slate-600">
        有 <span className="font-semibold text-teal-600">{count}</span> 张卡片待复习
        （本次最多 {limit} 张）。
      </p>
      <button
        type="button"
        onClick={onStart}
        className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
      >
        开始复习
      </button>
    </div>
  )
}

function ReviewCardView({
  card,
  index,
  total,
  showBack,
  onToggleBack,
  onRate,
}: {
  card: ConceptCard
  index: number
  total: number
  showBack: boolean
  onToggleBack: () => void
  onRate: (rate: SelfRate) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          第 {index + 1} / {total} 张
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-500">
          {CONCEPT_CARD_TYPE_LABEL[card.type] ?? card.type}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-1 text-xs font-medium text-slate-400">正面</div>
        <div className="break-anywhere text-2xl font-bold text-slate-900">{card.term}</div>

        {showBack && (
          <div className="mt-4 border-t border-dashed border-slate-200 pt-4">
            <div className="mb-1 text-xs font-medium text-teal-600">背面</div>
            <p className="text-sm leading-relaxed text-slate-700">
              {card.definition || '（未填写定义）'}
            </p>
            {card.examples.length > 0 && (
              <div className="mt-2 text-xs text-slate-500">
                <span className="font-medium">例子：</span>
                {card.examples.join('；')}
              </div>
            )}
          </div>
        )}
      </div>

      {!showBack ? (
        <button
          type="button"
          onClick={onToggleBack}
          className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-900"
        >
          显示答案
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {RATE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onRate(o.value)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border-2 bg-white px-3 py-2.5 text-sm font-semibold transition-colors ${o.cls}`}
            >
              <span>{o.label}</span>
              <span className="text-[10px] font-normal text-slate-400">{o.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyReview({ passRate }: { passRate: number | null }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="text-lg font-semibold text-teal-600">今日复习完成 🎉</div>
      <p className="text-sm text-slate-500">
        {passRate === null ? '今天还没有复习记录。' : `今日通过率 ${passRate}%`}
      </p>
    </div>
  )
}

function ReviewDonePanel({
  passRate,
  onRestart,
}: {
  passRate: number | null
  onRestart: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 p-8 text-center">
      <div className="text-lg font-semibold text-teal-700">本次复习完成 🎉</div>
      <p className="text-sm text-teal-700/80">
        {passRate === null ? '继续保持！' : `今日通过率 ${passRate}%`}
      </p>
      <button
        type="button"
        onClick={onRestart}
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
      >
        重新开始
      </button>
    </div>
  )
}

function CardForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  notes,
}: {
  value: NewCardDraft
  onChange: (v: NewCardDraft) => void
  onSubmit: (e: FormEvent) => void
  submitLabel: string
  notes: ReadingNote[]
}) {
  function set<K extends keyof NewCardDraft>(key: K, val: NewCardDraft[K]) {
    onChange({ ...value, [key]: val })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">类型</label>
        <select
          value={value.type}
          onChange={(e) => set('type', e.target.value as ConceptCardType)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        >
          {CARD_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {CONCEPT_CARD_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          正面（概念 / 字 / 句素）
        </label>
        <input
          value={value.term}
          onChange={(e) => set('term', e.target.value)}
          placeholder="如：刻意练习 / 好 / I have a dream"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          背面（定义 / 原句 / 例子）
        </label>
        <textarea
          value={value.definition}
          onChange={(e) => set('definition', e.target.value)}
          rows={2}
          placeholder="用自己的话写下定义或要点"
          className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">标签（可选，逗号分隔）</label>
        <input
          value={value.tags}
          onChange={(e) => set('tags', e.target.value)}
          placeholder="认知, 写作"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">来源笔记（可选）</label>
        <select
          value={value.sourceNoteId}
          onChange={(e) => set('sourceNoteId', e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">不关联</option>
          {notes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title.trim() || '（未命名笔记）'}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
      >
        {submitLabel}
      </button>
    </form>
  )
}

function RecentCardRow({
  card,
  notes,
  cases,
  onEdit,
  onRemove,
}: {
  card: ConceptCard
  notes: ReadingNote[]
  cases: CriticalCase[]
  onEdit: () => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const linkedNotes = resolveNoteRefs(card.sourceNoteIds, notes)
  const relatedCases = cases.filter((c) => (c.conceptIds ?? []).includes(card.id))
  return (
    <li className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700">
          <span className="flex-none rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
            {CONCEPT_CARD_TYPE_LABEL[card.type] ?? card.type}
          </span>
          <span className="break-anywhere">{card.term}</span>
        </span>
        <span className="text-xs text-slate-400">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-3">
          <div className="text-xs text-slate-600">
            <span className="font-medium text-teal-600">定义：</span>
            {card.definition || '（未填写）'}
          </div>
          {card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {card.tags.map((t) => (
                <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {t}
                </span>
              ))}
            </div>
          )}
          {linkedNotes.length > 0 && (
            <div className="flex flex-col gap-1 text-xs">
              {linkedNotes.map((ref) =>
                ref.missing ? (
                  <span key={ref.id} className="text-red-600 dark:text-red-300">
                    {REFERENCE_LABEL}
                    {ref.title}
                  </span>
                ) : (
                  <Link
                    key={ref.id}
                    to={`/reading?note=${ref.id}`}
                    className="text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-900 dark:text-teal-300"
                  >
                    来自笔记：{ref.title}
                  </Link>
                ),
              )}
            </div>
          )}
          {relatedCases.length > 0 && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              相关明辨案例：
              {relatedCases.map((c) => c.title.trim() || c.targetClaim.trim() || '（未命名案例）').join('、')}
            </div>
          )}
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              编辑
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              删除
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

