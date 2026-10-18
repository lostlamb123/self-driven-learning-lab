import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { useSaveState } from '../store/saveState'
import { toDateKey } from '../utils/date'
import { newCardId } from '../utils/cards'
import { noteToMarkdown } from '../utils/reading'
import { downloadMarkdown, markdownFileName } from '../utils/markdown'
import type { NoteKind, ReadingNote } from '../types/models'

const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  book: '书籍',
  article: '文章',
  paper: '论文',
  course: '课程',
  video: '视频',
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 从笔记的第二步/第三步中找包含该关键词的句子，作为卡片背面 */
function pickDefinition(note: ReadingNote, keyword: string): string {
  const sources = [note.feynman ?? '', note.keywordChain ?? '', note.feynmanDeepen ?? '']
  for (const src of sources) {
    const sentences = src
      .split(/[。；;！!？?\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const hit = sentences.find((s) => s.includes(keyword))
    if (hit) return hit
  }
  return ''
}

export default function ReadingPage() {
  const data = useAppStore((s) => s.data)
  const updateData = useAppStore((s) => s.updateData)
  const notify = useAppStore((s) => s.notify)
  const saveState = useSaveState()

  const [searchParams, setSearchParams] = useSearchParams()
  const noteId = searchParams.get('note')
  const editingNote = noteId ? (data.notes.find((n) => n.id === noteId) ?? null) : null

  const notes = useMemo(
    () => [...data.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.notes],
  )

  /** 列表页删除的二次确认 */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  /** 新建笔记：立即创建并进入编辑（自动保存接管后续字段） */
  function createNote() {
    const now = new Date().toISOString()
    const id = newId('note')
    updateData((d) => {
      d.notes.push({
        id,
        createdAt: now,
        updatedAt: now,
        kind: 'article',
        title: '',
        highlights: [],
        reflections: [],
        conceptIds: [],
        tags: [],
        keywords: [],
        keywordChain: '',
        feynman: '',
        feynmanOwnWords: false,
        feynmanDeepen: '',
        newQuestions: [],
        threeLevel: { level1: [], level2: [], level3: [] },
      })
    })
    setSearchParams({ note: id })
  }

  /** 删除笔记：解除关联卡片对该笔记的引用，但保留卡片本身（不级联删除） */
  function deleteNote(id: string) {
    updateData((d) => {
      const idx = d.notes.findIndex((n) => n.id === id)
      if (idx >= 0) d.notes.splice(idx, 1)
      for (const card of d.concepts) {
        if (card.sourceNoteIds?.includes(id)) {
          card.sourceNoteIds = card.sourceNoteIds.filter((x) => x !== id)
        }
      }
    })
    setConfirmDeleteId(null)
    setSearchParams({})
    notify('info', '已删除笔记，关联卡片保留', 2500)
  }

  if (editingNote) {
    return (
      <NoteWorkbench
        note={editingNote}
        saveState={saveState}
        onBack={() => setSearchParams({})}
        onDelete={() => deleteNote(editingNote.id)}
        notify={notify}
        updateData={updateData}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">阅读</h1>
          <p className="mt-0.5 text-sm text-slate-500">用五步法把一本书读成自己的</p>
        </div>
        <SaveBadge state={saveState} />
      </header>

      <button
        type="button"
        onClick={createNote}
        className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
      >
        新建阅读笔记
      </button>

      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800">
          还没有阅读笔记，新建一条开始。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => {
            const conceptCount = n.conceptIds?.length ?? 0
            const source = [NOTE_KIND_LABEL[n.kind] ?? n.kind, n.author].filter(Boolean).join(' · ')
            const isConfirming = confirmDeleteId === n.id
            return (
              <li
                key={n.id}
                className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-start gap-3 px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setSearchParams({ note: n.id })}
                    className="flex flex-1 flex-col gap-1 text-left"
                  >
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {n.title.trim() || '（未命名笔记）'}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {source && <span>{source}</span>}
                      <span>{n.createdAt.slice(0, 10)}</span>
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                        卡片 {conceptCount}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(isConfirming ? null : n.id)}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                  >
                    删除
                  </button>
                </div>
                {isConfirming && (
                  <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-red-700 dark:border-slate-700 dark:text-red-300">
                    <span>删除后不可恢复；卡片保留但解除引用，大纲与案例中的引用会显示为「已删除」。确定？</span>
                    <button
                      type="button"
                      onClick={() => deleteNote(n.id)}
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

/** 保存状态徽标 */
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

/* ============================ 编辑工作台 ============================ */

function NoteWorkbench({
  note,
  saveState,
  onBack,
  onDelete,
  notify,
  updateData,
}: {
  note: ReadingNote
  saveState: 'idle' | 'saving' | 'saved'
  onBack: () => void
  onDelete: () => void
  notify: (type: 'success' | 'error' | 'info', message: string, ttl?: number) => void
  updateData: (updater: (draft: import('../types/models').AppData) => void) => void
}) {
  const [keywordInput, setKeywordInput] = useState('')
  const [questionInput, setQuestionInput] = useState('')
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(false)
  const [showThreeLevel, setShowThreeLevel] = useState(true)
  const [extractOpen, setExtractOpen] = useState(false)
  /** 写作大纲列表：用于统计本笔记被引用次数 */
  const outlines = useAppStore((s) => s.data.outlines)
  /** 明辨案例列表：用于统计本笔记被引用次数 */
  const cases = useAppStore((s) => s.data.cases)
  const highlightsRef = useRef<HTMLTextAreaElement>(null)

  const keywords = note.keywords ?? []
  const newQuestions = note.newQuestions ?? []
  const three = note.threeLevel ?? { level1: [], level2: [], level3: [] }

  /** 修改当前笔记的任意字段（统一走 store，自动保存） */
  function patch(fn: (n: ReadingNote) => void) {
    updateData((d) => {
      const target = d.notes.find((x) => x.id === note.id)
      if (!target) return
      fn(target)
      target.updatedAt = new Date().toISOString()
    })
  }

  /** 五步进度 */
  const steps = [
    { key: 's1', label: '关键概念', done: keywords.length > 0 },
    { key: 's2', label: '关键词链', done: Boolean(note.keywordChain?.trim()) },
    {
      key: 's3',
      label: '思想费曼',
      done: Boolean(note.feynman?.trim()) && Boolean(note.feynmanOwnWords),
    },
    { key: 's4', label: '费曼×3', done: Boolean(note.feynmanDeepen?.trim()) },
    { key: 's5', label: '新问题', done: newQuestions.length > 0 },
  ]
  const doneCount = steps.filter((s) => s.done).length

  /** 被多少篇写作大纲的三级节点引用（只读提示） */
  const citedByCount = outlines.filter((o) =>
    o.sections.some((s) => s.evidenceIds?.includes(note.id)),
  ).length

  /** 被多少篇明辨案例引用（只读提示） */
  const citedByCases = cases.filter((c) => (c.noteIds ?? []).includes(note.id)).length

  function addKeyword(value: string) {
    const v = value.trim()
    if (!v) return
    if (keywords.includes(v)) {
      notify('info', '该关键词已存在', 1800)
      return
    }
    patch((n) => {
      n.keywords = [...(n.keywords ?? []), v]
    })
  }

  /** 从原文摘录中取当前选中的文字，加为关键词 */
  function addFromSelection() {
    const el = highlightsRef.current
    if (!el) return
    const selected = el.value.slice(el.selectionStart, el.selectionEnd).trim()
    if (!selected) {
      notify('info', '请先在「原文摘录」中选中一段文字', 2200)
      return
    }
    addKeyword(selected)
  }

  function removeKeyword(k: string) {
    patch((n) => {
      n.keywords = (n.keywords ?? []).filter((x) => x !== k)
    })
  }

  function addQuestion() {
    const v = questionInput.trim()
    if (!v) return
    patch((n) => {
      n.newQuestions = [...(n.newQuestions ?? []), v]
    })
    setQuestionInput('')
  }

  function removeQuestion(q: string) {
    patch((n) => {
      n.newQuestions = (n.newQuestions ?? []).filter((x) => x !== q)
    })
  }

  /** 三级笔记节点增删 */
  function addThreeLevel(level: 'level1' | 'level2' | 'level3', value: string) {
    const v = value.trim()
    if (!v) return
    patch((n) => {
      const base = n.threeLevel ?? { level1: [], level2: [], level3: [] }
      base[level] = [...base[level], v]
      n.threeLevel = base
    })
  }

  function removeThreeLevel(level: 'level1' | 'level2' | 'level3', index: number) {
    patch((n) => {
      const base = n.threeLevel ?? { level1: [], level2: [], level3: [] }
      base[level] = base[level].filter((_, i) => i !== index)
      n.threeLevel = base
    })
  }

  function exportMarkdown() {
    const md = noteToMarkdown(note)
    const fileName = markdownFileName('note', note.title)
    downloadMarkdown(fileName, md)
    notify('success', `已导出 ${fileName}`, 2500)
  }

  return (
    <div className="flex flex-col gap-5">
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
            onClick={() => setExtractOpen(true)}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            提炼卡片
          </button>
        </div>
      </div>

      {/* 标题与来源 */}
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <input
          value={note.title}
          onChange={(e) => patch((n) => (n.title = e.target.value))}
          placeholder="标题"
          className="w-full border-b border-slate-200 pb-2 text-lg font-semibold outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={note.kind}
            onChange={(e) => patch((n) => (n.kind = e.target.value as NoteKind))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {(Object.keys(NOTE_KIND_LABEL) as NoteKind[]).map((k) => (
              <option key={k} value={k}>
                {NOTE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <input
            value={note.author ?? ''}
            onChange={(e) => patch((n) => (n.author = e.target.value || undefined))}
            placeholder="作者 / 书名（可选）"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <input
          value={note.sourceUrl ?? ''}
          onChange={(e) => patch((n) => (n.sourceUrl = e.target.value || undefined))}
          placeholder="链接（可选）"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        {(citedByCount > 0 || citedByCases > 0) && (
          <p className="flex flex-wrap gap-x-3 text-xs text-slate-400">
            {citedByCount > 0 && (
              <span>
                被 {citedByCount} 篇大纲引用
                <span className="ml-1 text-slate-300">（写作页「引用证据」）</span>
              </span>
            )}
            {citedByCases > 0 && (
              <span>
                被 {citedByCases} 篇明辨案例引用
                <span className="ml-1 text-slate-300">（明辨页「引用阅读笔记」）</span>
              </span>
            )}
          </p>
        )}
      </section>

      {/* 五步进度条 */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>五步法进度</span>
          <span className="tabular-nums">{doneCount} / 5</span>
        </div>
        <div className="flex gap-1.5">
          {steps.map((s) => (
            <div key={s.key} className="flex flex-1 flex-col gap-1">
              <div
                className={`h-1.5 rounded-full ${
                  s.done ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
              <span
                className={`text-[10px] ${
                  s.done ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 第一步 */}
      <StepCard index="1" title="关键概念" hint="圈出反复出现、值得记住的词">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {keywords.length === 0 ? (
            <span className="text-xs text-slate-400">还没有关键词</span>
          ) : (
            keywords.map((k) => (
              <span
                key={k}
                className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
              >
                {k}
                <button
                  type="button"
                  onClick={() => removeKeyword(k)}
                  className="text-teal-600/60 hover:text-teal-800 dark:text-teal-300/60"
                  aria-label={`移除 ${k}`}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addKeyword(keywordInput)
                setKeywordInput('')
              }
            }}
            placeholder="输入关键词后回车"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => {
              addKeyword(keywordInput)
              setKeywordInput('')
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            添加
          </button>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-500">原文摘录</label>
          <textarea
            ref={highlightsRef}
            value={(note.highlights ?? []).join('\n')}
            onChange={(e) =>
              patch((n) => {
                n.highlights = e.target.value.split('\n')
              })
            }
            rows={3}
            placeholder="粘贴原文段落，选中一段文字后点下方按钮可加为关键词"
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={addFromSelection}
            className="mt-1.5 rounded border border-teal-300 px-2 py-1 text-xs text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-950"
          >
            从正文划词添加
          </button>
        </div>
      </StepCard>

      {/* 第二步 */}
      <StepCard
        index="2"
        title="关键词链与对立项"
        hint="把关键词连成链条，找出最长链条和核心对立项"
      >
        <textarea
          value={note.keywordChain ?? ''}
          onChange={(e) => patch((n) => (n.keywordChain = e.target.value))}
          rows={4}
          placeholder={'例：刻意练习 → 反馈 → 修正 → 心理表征\n核心对立项：舒适区 vs 学习区'}
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </StepCard>

      {/* 第三步 */}
      <StepCard index="3" title="思想费曼" hint="用自己的话讲清楚，不许复制原文">
        <textarea
          value={note.feynman ?? ''}
          onChange={(e) => patch((n) => (n.feynman = e.target.value))}
          rows={4}
          placeholder="假设你在给一个完全不懂的人讲这个概念……"
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={Boolean(note.feynmanOwnWords)}
            onChange={(e) => patch((n) => (n.feynmanOwnWords = e.target.checked))}
            className="h-4 w-4 accent-teal-600"
          />
          我是用自己的话写的
        </label>
      </StepCard>

      {/* 第四步 */}
      <StepCard index="4" title="费曼×3" hint="多次提炼 → 深层关联 → 前提与结论检查">
        <textarea
          value={note.feynmanDeepen ?? ''}
          onChange={(e) => patch((n) => (n.feynmanDeepen = e.target.value))}
          rows={5}
          placeholder={
            '提炼 2：还能更短吗？\n深层关联：它和我已知的什么概念相连？\n前提与结论：这个结论依赖哪些前提？前提不成立会怎样？'
          }
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </StepCard>

      {/* 第五步 */}
      <StepCard index="5" title="提出新问题" hint="读完之后，你还想知道什么">
        <ul className="mb-2 flex flex-col gap-1.5">
          {newQuestions.length === 0 ? (
            <li className="text-xs text-slate-400">还没有新问题</li>
          ) : (
            newQuestions.map((q) => (
              <li
                key={q}
                className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 dark:bg-slate-700/50 dark:text-slate-200"
              >
                <span className="flex-1">{q}</span>
                <button
                  type="button"
                  onClick={() => removeQuestion(q)}
                  className="text-xs text-slate-400 hover:text-red-600"
                  aria-label="移除问题"
                >
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex gap-2">
          <input
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addQuestion()
              }
            }}
            placeholder="输入新问题后回车"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={addQuestion}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            添加
          </button>
        </div>
      </StepCard>

      {/* 三级笔记 */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setShowThreeLevel((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            <span className="text-xs text-slate-400">{showThreeLevel ? '▾' : '▸'}</span>
            三级笔记
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportMarkdown}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              导出为 Markdown
            </button>
          </div>
        </div>
        {showThreeLevel && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-700">
            {(
              [
                { key: 'level1', label: '一级 · 核心概念/主旨' },
                { key: 'level2', label: '二级 · 衍生概念/定义/逻辑展开' },
                { key: 'level3', label: '三级 · 具体例子/证据/数据' },
              ] as const
            ).map(({ key, label }) => (
              <ThreeLevelBlock
                key={key}
                label={label}
                items={three[key]}
                onAdd={(v) => addThreeLevel(key, v)}
                onRemove={(i) => removeThreeLevel(key, i)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 删除笔记 */}
      <div className="flex flex-col gap-2 pb-4">
        <button
          type="button"
          onClick={() => setConfirmDeleteNote(true)}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
        >
          删除这篇笔记
        </button>
        {confirmDeleteNote && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            <span>删除后不可恢复；卡片保留但解除引用，大纲与案例中的引用会显示为「已删除」。确定删除？</span>
            <button
              type="button"
              onClick={onDelete}
              className="rounded bg-red-600 px-2 py-1 text-white"
            >
              确认删除
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteNote(false)}
              className="rounded border border-slate-300 px-2 py-1 text-slate-600 dark:border-slate-600 dark:text-slate-300"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {extractOpen && (
        <ExtractCardsModal
          note={note}
          onClose={() => setExtractOpen(false)}
          onConfirm={(rows) => {
            updateData((d) => {
              const target = d.notes.find((n) => n.id === note.id)
              const now = new Date().toISOString()
              for (const row of rows) {
                const cardId = newCardId()
                d.concepts.push({
                  id: cardId,
                  createdAt: now,
                  updatedAt: now,
                  type: 'subject',
                  term: row.term,
                  definition: row.definition,
                  whyItMatters: '',
                  examples: [],
                  confusions: [],
                  sourceNoteIds: [note.id],
                  tags: [],
                  mastery: 'unknown',
                  reviewCount: 0,
                  nextReviewAt: toDateKey(),
                })
                if (target) target.conceptIds = [...(target.conceptIds ?? []), cardId]
              }
            })
            setExtractOpen(false)
            notify('success', `已创建 ${rows.length} 张卡片，可在卡片页复习`, 3000)
          }}
        />
      )}
    </div>
  )
}

function StepCard({
  index,
  title,
  hint,
  children,
}: {
  index: string
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white">
          {index}
        </span>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      </div>
      <p className="mb-2 text-xs text-slate-400">{hint}</p>
      {children}
    </section>
  )
}

function ThreeLevelBlock({
  label,
  items,
  onAdd,
  onRemove,
}: {
  label: string
  items: string[]
  onAdd: (v: string) => void
  onRemove: (index: number) => void
}) {
  const [input, setInput] = useState('')
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
      <ul className="mb-1.5 flex flex-col gap-1">
        {items.length === 0 ? (
          <li className="text-xs text-slate-400">暂无节点</li>
        ) : (
          items.map((it, i) => (
            <li
              key={`${it}-${i}`}
              className="flex items-start justify-between gap-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-slate-700/50 dark:text-slate-200"
            >
              <span className="flex-1">{it}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-slate-400 hover:text-red-600"
                aria-label="移除节点"
              >
                ×
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAdd(input)
              setInput('')
            }
          }}
          placeholder="添加节点后回车"
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={() => {
            onAdd(input)
            setInput('')
          }}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          添加
        </button>
      </div>
    </div>
  )
}

/* ============================ 提炼卡片弹窗 ============================ */

function ExtractCardsModal({
  note,
  onClose,
  onConfirm,
}: {
  note: ReadingNote
  onClose: () => void
  onConfirm: (rows: { term: string; definition: string }[]) => void
}) {
  const keywords = note.keywords ?? []
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(keywords.map((k) => [k, true])),
  )
  const [terms, setTerms] = useState<Record<string, string>>(() =>
    Object.fromEntries(keywords.map((k) => [k, k])),
  )
  const [defs, setDefs] = useState<Record<string, string>>(() =>
    Object.fromEntries(keywords.map((k) => [k, pickDefinition(note, k)])),
  )

  const chosen = keywords.filter((k) => selected[k] && terms[k]?.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-2xl dark:bg-slate-800">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">提炼概念卡片</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              来源笔记：{note.title.trim() || '（未命名笔记）'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {keywords.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-400 dark:border-slate-600">
            先在第一步添加关键词，才能提炼卡片。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {keywords.map((k) => (
              <li
                key={k}
                className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700"
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[k])}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [k]: e.target.checked }))
                    }
                    className="h-4 w-4 accent-teal-600"
                  />
                  <input
                    value={terms[k] ?? k}
                    onChange={(e) => setTerms((t) => ({ ...t, [k]: e.target.value }))}
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>
                <textarea
                  value={defs[k] ?? ''}
                  onChange={(e) => setDefs((d) => ({ ...d, [k]: e.target.value }))}
                  rows={2}
                  placeholder="背面：定义 / 解释"
                  className="mt-1.5 w-full resize-y rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-300"
          >
            取消
          </button>
          <button
            type="button"
            disabled={chosen.length === 0}
            onClick={() =>
              onConfirm(
                chosen.map((k) => ({ term: terms[k].trim(), definition: defs[k]?.trim() ?? '' })),
              )
            }
            className="flex-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            创建 {chosen.length} 张卡片
          </button>
        </div>
      </div>
    </div>
  )
}
