import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { useSaveState } from '../store/saveState'
import { downloadMarkdown, markdownFileName } from '../utils/markdown'
import { REFERENCE_LABEL, resolveNoteRefs } from '../utils/references'
import { pickKeySentence } from '../utils/writing'
import {
  caseToMarkdown,
  getStageProgress,
  newCaseId,
  STANCE_OPTIONS,
  truncate,
  CASE_STANCE_LABEL,
} from '../utils/critical'
import { COMMON_BIASES } from '../types/models'
import type { CaseKind, CaseStance, ConceptCard, CriticalCase, ReadingNote } from '../types/models'

const CASE_KIND_LABEL: Record<CaseKind, string> = {
  counterexample: '理论反例',
  'real-world': '现实事件',
  opinion: '他人观点',
  analogy: '类比',
}

export default function CriticalPage() {
  const data = useAppStore((s) => s.data)
  const updateData = useAppStore((s) => s.updateData)
  const notify = useAppStore((s) => s.notify)
  const saveState = useSaveState()

  const [searchParams, setSearchParams] = useSearchParams()
  const caseId = searchParams.get('case')
  const editing = caseId ? (data.cases.find((c) => c.id === caseId) ?? null) : null

  const cases = useMemo(
    () => [...data.cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.cases],
  )

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function createCase() {
    const now = new Date().toISOString()
    const id = newCaseId()
    updateData((d) => {
      d.cases.push({
        id,
        createdAt: now,
        updatedAt: now,
        title: '',
        kind: 'real-world',
        description: '',
        targetClaim: '',
        stance: 'neutral',
        reasoning: [],
        biases: [],
        conceptIds: [],
        noteIds: [],
        evidence: '',
        premiseCheck: '',
        revisedClaim: '',
        revisedReason: '',
        nextAction: '',
      })
    })
    setSearchParams({ case: id })
    notify('success', '已新建案例，从「质疑」开始', 2200)
  }

  function deleteCase(id: string) {
    updateData((d) => {
      const idx = d.cases.findIndex((c) => c.id === id)
      if (idx >= 0) d.cases.splice(idx, 1)
    })
    setConfirmDeleteId(null)
    setSearchParams({})
    notify('info', '已删除案例', 2000)
  }

  if (editing) {
    return (
      <CaseWorkbench
        caseItem={editing}
        notes={data.notes}
        cards={data.concepts}
        saveState={saveState}
        onBack={() => setSearchParams({})}
        onDelete={() => deleteCase(editing.id)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">明辨</h1>
        <p className="mt-0.5 text-sm text-slate-500">质疑 → 检验 → 修正，把观点练成判断</p>
      </header>

      <button
        type="button"
        onClick={createCase}
        className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
      >
        新建案例
      </button>

      {cases.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800">
          还没有案例，点「新建案例」开始一次质疑练习。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cases.map((c) => {
            const p = getStageProgress(c)
            const isConfirming = confirmDeleteId === c.id
            return (
              <li
                key={c.id}
                className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-start gap-3 px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setSearchParams({ case: c.id })}
                    className="flex flex-1 flex-col gap-1 text-left"
                  >
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {truncate(c.targetClaim)}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          c.stance === 'challenge'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : c.stance === 'support'
                              ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {CASE_STANCE_LABEL[c.stance]}
                      </span>
                      <span>
                        阶段 {p.filled}/{p.total}
                      </span>
                      <span>{c.updatedAt.slice(0, 10)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(isConfirming ? null : c.id)}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                  >
                    删除
                  </button>
                </div>
                {isConfirming && (
                  <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-red-700 dark:border-slate-700 dark:text-red-300">
                    <span>删除后不可恢复，确定删除该案例？</span>
                    <button
                      type="button"
                      onClick={() => deleteCase(c.id)}
                      className="rounded bg-red-600 px-2 py-1 text-white"
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded border border-slate-300 px-2 py-1 text-slate-600 dark:border-slate-600 dark:text-slate-300"
                    >
                      取消
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ============================ 编辑工作台 ============================ */

function CaseWorkbench({
  caseItem,
  notes,
  cards,
  saveState,
  onBack,
  onDelete,
}: {
  caseItem: CriticalCase
  notes: ReadingNote[]
  cards: ConceptCard[]
  saveState: 'idle' | 'saving' | 'saved'
  onBack: () => void
  onDelete: () => void
}) {
  const updateData = useAppStore((s) => s.updateData)
  const notify = useAppStore((s) => s.notify)

  const [reasonInput, setReasonInput] = useState('')
  const [customBias, setCustomBias] = useState('')
  const [openStages, setOpenStages] = useState({ doubt: true, examine: true, revise: true })
  const [evidencePickerOpen, setEvidencePickerOpen] = useState(false)
  const [cardPickerOpen, setCardPickerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const progress = getStageProgress(caseItem)
  const reasoning = caseItem.reasoning ?? []
  const biases = caseItem.biases ?? []
  const noteRefs = resolveNoteRefs(caseItem.noteIds, notes)
  const linkedCards = (caseItem.conceptIds ?? [])
    .map((id) => cards.find((c) => c.id === id))
    .filter((c): c is ConceptCard => Boolean(c))

  function patch(fn: (c: CriticalCase) => void) {
    updateData((d) => {
      const target = d.cases.find((x) => x.id === caseItem.id)
      if (!target) return
      fn(target)
      target.updatedAt = new Date().toISOString()
    })
  }

  function addReason() {
    const v = reasonInput.trim()
    if (!v) return
    patch((c) => (c.reasoning = [...(c.reasoning ?? []), v]))
    setReasonInput('')
  }

  function removeReason(i: number) {
    patch((c) => (c.reasoning = (c.reasoning ?? []).filter((_, idx) => idx !== i)))
  }

  function toggleBias(b: string) {
    patch((c) => {
      const list = c.biases ?? []
      c.biases = list.includes(b) ? list.filter((x) => x !== b) : [...list, b]
    })
  }

  function addCustomBias() {
    const v = customBias.trim()
    if (!v) return
    patch((c) => {
      const list = c.biases ?? []
      if (!list.includes(v)) c.biases = [...list, v]
    })
    setCustomBias('')
  }

  /** 引用阅读笔记：关键句追加到证据区，并回填 noteIds */
  function applyNote(note: ReadingNote) {
    const sentence = pickKeySentence(note)
    patch((c) => {
      const prev = (c.evidence ?? '').trim()
      const line = sentence || `（来自《${note.title.trim() || '未命名笔记'}》）`
      c.evidence = prev ? `${prev}\n${line}` : line
      const ids = c.noteIds ?? []
      if (!ids.includes(note.id)) c.noteIds = [...ids, note.id]
    })
    setEvidencePickerOpen(false)
    notify('success', '已引用笔记关键句到证据区', 2200)
  }

  /** 关联/取消关联概念卡片：卡片详情会反向显示「相关明辨案例」 */
  function toggleCard(cardId: string) {
    patch((c) => {
      const ids = c.conceptIds ?? []
      c.conceptIds = ids.includes(cardId) ? ids.filter((x) => x !== cardId) : [...ids, cardId]
    })
  }

  function exportMarkdown() {
    const md = caseToMarkdown(caseItem, notes)
    const fileName = markdownFileName('critical', caseItem.targetClaim || caseItem.title, 20)
    downloadMarkdown(fileName, md)
    notify('success', `已导出 ${fileName}`, 2500)
  }

  const stages = [
    { key: 'doubt' as const, index: '一', label: '质疑', done: progress.doubt },
    { key: 'examine' as const, index: '二', label: '检验', done: progress.examine },
    { key: 'revise' as const, index: '三', label: '修正', done: progress.revise },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          ← 返回
        </button>
        <div className="flex items-center gap-2">
          <SaveBadge state={saveState} />
          <button
            type="button"
            onClick={exportMarkdown}
            className="rounded-lg border border-teal-300 px-3 py-1.5 text-sm text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-950"
          >
            导出 Markdown
          </button>
        </div>
      </div>

      {/* 标题 + 类型 */}
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <input
          value={caseItem.title}
          onChange={(e) => patch((c) => (c.title = e.target.value))}
          placeholder="案例标题（可选，用于列表辨识）"
          className="w-full border-b border-slate-200 pb-2 text-lg font-semibold outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={caseItem.kind}
            onChange={(e) => patch((c) => (c.kind = e.target.value as CaseKind))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {(Object.keys(CASE_KIND_LABEL) as CaseKind[]).map((k) => (
              <option key={k} value={k}>
                {CASE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <input
            value={caseItem.description ?? ''}
            onChange={(e) => patch((c) => (c.description = e.target.value))}
            placeholder="案例事实一句话（可选）"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </section>

      {/* 三阶段进度条 */}
      <div className="flex gap-2">
        {stages.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() =>
              setOpenStages((o) => ({ ...o, [s.key]: !o[s.key] }))
            }
            className={`flex flex-1 flex-col gap-1 rounded-lg border p-2 text-left transition-colors ${
              s.done
                ? 'border-teal-300 bg-teal-50 dark:border-teal-800 dark:bg-teal-900/30'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
            }`}
          >
            <span className="flex items-center justify-between text-xs">
              <span
                className={
                  s.done
                    ? 'font-medium text-teal-700 dark:text-teal-300'
                    : 'text-slate-500 dark:text-slate-400'
                }
              >
                {s.index} · {s.label}
              </span>
              <span className={s.done ? 'text-teal-600' : 'text-slate-300'}>
                {s.done ? '✓' : '○'}
              </span>
            </span>
            <span className="text-[10px] text-slate-400">
              {openStages[s.key] ? '点击折叠' : '点击展开'}
            </span>
          </button>
        ))}
      </div>

      {/* 阶段一：质疑 */}
      <StageCard
        open={openStages.doubt}
        index="一"
        title="质疑"
        hint="先写下你原本相信什么、为什么相信"
        done={progress.doubt}
        onToggle={() => setOpenStages((o) => ({ ...o, doubt: !o.doubt }))}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">目标主张</label>
            <textarea
              value={caseItem.targetClaim}
              onChange={(e) => patch((c) => (c.targetClaim = e.target.value))}
              rows={2}
              placeholder="我要质疑的那个观点是……"
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">我的初始立场</label>
            <div className="flex gap-2">
              {STANCE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => patch((c) => (c.stance = s as CaseStance))}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    caseItem.stance === s
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {CASE_STANCE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">我的初始理由</label>
            <ul className="mb-2 flex flex-col gap-1.5">
              {reasoning.length === 0 ? (
                <li className="text-xs text-slate-400">还没有理由</li>
              ) : (
                reasoning.map((r, i) => (
                  <li
                    key={`${r}-${i}`}
                    className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 dark:bg-slate-700/50 dark:text-slate-200"
                  >
                    <span className="flex-1">{r}</span>
                    <button
                      type="button"
                      onClick={() => removeReason(i)}
                      className="text-xs text-slate-400 hover:text-red-600"
                      aria-label="移除理由"
                    >
                      ×
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="flex gap-2">
              <input
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addReason()
                  }
                }}
                placeholder="我这么认为，因为……（回车添加）"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={addReason}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      </StageCard>

      {/* 阶段二：检验 */}
      <StageCard
        open={openStages.examine}
        index="二"
        title="检验"
        hint="找偏差、找反例、查前提"
        done={progress.examine}
        onToggle={() => setOpenStages((o) => ({ ...o, examine: !o.examine }))}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              识别认知偏差（可多选）
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_BIASES.map((b) => {
                const active = biases.includes(b)
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBias(b)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      active
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {b}
                  </button>
                )
              })}
              {biases
                .filter((b) => !(COMMON_BIASES as readonly string[]).includes(b))
                .map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBias(b)}
                    className="rounded-full border border-teal-600 bg-teal-600 px-2.5 py-1 text-xs text-white"
                  >
                    {b} ×
                  </button>
                ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={customBias}
                onChange={(e) => setCustomBias(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomBias()
                  }
                }}
                placeholder="其他偏差（回车添加）"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={addCustomBias}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
              >
                添加
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">搜集反例与证据</label>
              <button
                type="button"
                onClick={() => setEvidencePickerOpen(true)}
                className="rounded border border-teal-300 px-2 py-0.5 text-xs text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-950"
              >
                引用阅读笔记
              </button>
            </div>
            <textarea
              value={caseItem.evidence ?? ''}
              onChange={(e) => patch((c) => (c.evidence = e.target.value))}
              rows={3}
              placeholder="有没有反例？有哪些数据/事实支持或推翻它？"
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            {noteRefs.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {noteRefs.map((ref) => (
                  <span
                    key={ref.id}
                    className={`rounded px-1.5 py-0.5 text-[11px] ${
                      ref.missing
                        ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {REFERENCE_LABEL}
                    {ref.title}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">关联概念卡片</label>
              <button
                type="button"
                onClick={() => setCardPickerOpen(true)}
                className="rounded border border-teal-300 px-2 py-0.5 text-xs text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-950"
              >
                选择卡片
              </button>
            </div>
            {linkedCards.length === 0 ? (
              <p className="text-xs text-slate-400">
                还没有关联卡片。关联后，卡片详情会显示「相关明辨案例」。
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {linkedCards.map((card) => (
                  <span
                    key={card.id}
                    className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  >
                    {card.term}
                    <button
                      type="button"
                      onClick={() => toggleCard(card.id)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label={`取消关联 ${card.term}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">检查前提与推论</label>
            <textarea
              value={caseItem.premiseCheck ?? ''}
              onChange={(e) => patch((c) => (c.premiseCheck = e.target.value))}
              rows={3}
              placeholder="我的隐含前提是什么？前提一定成立吗？推论有没有跳跃？"
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </StageCard>

      {/* 阶段三：修正 */}
      <StageCard
        open={openStages.revise}
        index="三"
        title="修正"
        hint="把检验结果落成一个更稳的看法"
        done={progress.revise}
        onToggle={() => setOpenStages((o) => ({ ...o, revise: !o.revise }))}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">修正后的主张</label>
            <textarea
              value={caseItem.revisedClaim ?? ''}
              onChange={(e) => patch((c) => (c.revisedClaim = e.target.value))}
              rows={2}
              placeholder="考虑偏差与反例之后，我现在认为……"
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">修正理由</label>
            <textarea
              value={caseItem.revisedReason ?? ''}
              onChange={(e) => patch((c) => (c.revisedReason = e.target.value))}
              rows={2}
              placeholder="为什么改？哪条证据/哪个偏差改变了你？"
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">下一步行动</label>
            <input
              value={caseItem.nextAction ?? ''}
              onChange={(e) => patch((c) => (c.nextAction = e.target.value))}
              placeholder="接下来要验证/补学的一件事"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </StageCard>

      {/* 删除 */}
      <div className="flex flex-col gap-2 pb-4">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
        >
          删除这个案例
        </button>
        {confirmDelete && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            <span>删除后不可恢复，确定删除？</span>
            <button
              type="button"
              onClick={onDelete}
              className="rounded bg-red-600 px-2 py-1 text-white"
            >
              确认删除
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded border border-slate-300 px-2 py-1 text-slate-600 dark:border-slate-600 dark:text-slate-300"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {evidencePickerOpen && (
        <NotePickerModal
          notes={notes}
          onClose={() => setEvidencePickerOpen(false)}
          onPick={applyNote}
        />
      )}

      {cardPickerOpen && (
        <CardPickerModal
          cards={cards}
          selectedIds={caseItem.conceptIds ?? []}
          onToggle={toggleCard}
          onClose={() => setCardPickerOpen(false)}
        />
      )}
    </div>
  )
}

function StageCard({
  open,
  index,
  title,
  hint,
  done,
  onToggle,
  children,
}: {
  open: boolean
  index: string
  title: string
  hint: string
  done: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section
      className={`rounded-xl border bg-white dark:bg-slate-800 ${
        done ? 'border-teal-300 dark:border-teal-800' : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-baseline gap-2">
          <span
            className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white ${
              done ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            {index}
          </span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
          <span className="text-xs text-slate-400">{hint}</span>
        </span>
        <span className="text-xs text-slate-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">{children}</div>
      )}
    </section>
  )
}

function SaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  if (state === 'idle') return null
  const isSaving = state === 'saving'
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs ${
        isSaving
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          : 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
      }`}
    >
      {isSaving ? '保存中…' : '已保存'}
    </span>
  )
}

function NotePickerModal({
  notes,
  onClose,
  onPick,
}: {
  notes: ReadingNote[]
  onClose: () => void
  onPick: (note: ReadingNote) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl dark:bg-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            引用阅读笔记
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {notes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-400 dark:border-slate-600">
            还没有阅读笔记，先去「阅读」页记一条。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...notes]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {n.title.trim() || '（未命名笔记）'}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                        {pickKeySentence(n) || '（无摘录）'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPick(n)}
                      className="flex-none rounded border border-teal-300 px-2 py-1 text-xs text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-950"
                    >
                      引用
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function CardPickerModal({
  cards,
  selectedIds,
  onToggle,
  onClose,
}: {
  cards: ConceptCard[]
  selectedIds: string[]
  onToggle: (cardId: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl dark:bg-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            关联概念卡片
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {cards.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-400 dark:border-slate-600">
            还没有卡片，先去「卡片」页做一张。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cards.map((card) => {
              const active = selectedIds.includes(card.id)
              return (
                <li
                  key={card.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {card.term}
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                      {card.definition || '（无定义）'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggle(card.id)}
                    className={`flex-none rounded border px-2 py-1 text-xs ${
                      active
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-950'
                    }`}
                  >
                    {active ? '已关联' : '关联'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          完成
        </button>
      </div>
    </div>
  )
}
