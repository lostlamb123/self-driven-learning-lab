import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { useSaveState } from '../store/saveState'
import { downloadMarkdown, markdownFileName } from '../utils/markdown'
import { REFERENCE_LABEL, resolveNoteRefs } from '../utils/references'
import {
  buildTree,
  countSections,
  createSection,
  createTemplateSections,
  flattenTree,
  GENRE_OPTIONS,
  newOutlineId,
  OUTLINE_GENRE_LABEL,
  outlineToMarkdown,
  pickKeySentence,
  type OutlineTree,
} from '../utils/writing'
import type { OutlineGenre, OutlineSection, ReadingNote, WritingOutline } from '../types/models'

export default function WritingPage() {
  const data = useAppStore((s) => s.data)
  const updateData = useAppStore((s) => s.updateData)
  const notify = useAppStore((s) => s.notify)
  const saveState = useSaveState()

  const [searchParams, setSearchParams] = useSearchParams()
  const outlineId = searchParams.get('outline')
  const editing = outlineId ? (data.outlines.find((o) => o.id === outlineId) ?? null) : null

  const outlines = useMemo(
    () => [...data.outlines].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.outlines],
  )

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [genrePickerOpen, setGenrePickerOpen] = useState(false)

  /** 新建大纲：先选文体，按模板预填二级骨架 */
  function createOutline(genre: OutlineGenre) {
    const now = new Date().toISOString()
    const id = newOutlineId()
    updateData((d) => {
      d.outlines.push({
        id,
        createdAt: now,
        updatedAt: now,
        title: '',
        genre,
        intent: '',
        audience: '',
        status: 'drafting',
        sections: [createSection(0), ...createTemplateSections(genre)],
        noteIds: [],
        conceptIds: [],
      })
    })
    setGenrePickerOpen(false)
    setSearchParams({ outline: id })
    notify('success', `已按「${OUTLINE_GENRE_LABEL[genre]}」模板创建大纲`, 2500)
  }

  function deleteOutline(id: string) {
    updateData((d) => {
      const idx = d.outlines.findIndex((o) => o.id === id)
      if (idx >= 0) d.outlines.splice(idx, 1)
    })
    setConfirmDeleteId(null)
    setSearchParams({})
    notify('info', '已删除大纲', 2000)
  }

  if (editing) {
    return (
      <OutlineWorkbench
        outline={editing}
        notes={data.notes}
        saveState={saveState}
        onBack={() => setSearchParams({})}
        onDelete={() => deleteOutline(editing.id)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">写作</h1>
        <p className="mt-0.5 text-sm text-slate-500">把零散笔记组织成有说服力的表达</p>
      </header>

      <button
        type="button"
        onClick={() => setGenrePickerOpen(true)}
        className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
      >
        新建大纲
      </button>

      {outlines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800">
          还没有大纲，点「新建大纲」挑一个文体模板开始。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {outlines.map((o) => {
            const counts = countSections(o.sections)
            const genreLabel = OUTLINE_GENRE_LABEL[o.genre ?? 'expository']
            const isConfirming = confirmDeleteId === o.id
            return (
              <li
                key={o.id}
                className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-start gap-3 px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setSearchParams({ outline: o.id })}
                    className="flex flex-1 flex-col gap-1 text-left"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                      {o.title.trim() || '（未命名大纲）'}
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-normal text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                        {genreLabel}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>二级 {counts.level2}</span>
                      <span>三级 {counts.level3}</span>
                      <span>{o.updatedAt.slice(0, 10)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(isConfirming ? null : o.id)}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                  >
                    删除
                  </button>
                </div>
                {isConfirming && (
                  <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-red-700 dark:border-slate-700 dark:text-red-300">
                    <span>删除后不可恢复，确定删除该大纲？</span>
                    <button
                      type="button"
                      onClick={() => deleteOutline(o.id)}
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

      {genrePickerOpen && (
        <GenrePickerModal
          onClose={() => setGenrePickerOpen(false)}
          onPick={(g) => createOutline(g)}
        />
      )}
    </div>
  )
}

/* ============================ 文体选择弹窗 ============================ */

function GenrePickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void
  onPick: (genre: OutlineGenre) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl dark:bg-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">选择文体</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {GENRE_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onPick(g)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-left hover:border-teal-400 hover:bg-teal-50 dark:border-slate-700 dark:hover:bg-slate-700"
            >
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {OUTLINE_GENRE_LABEL[g]}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                预填骨架：{TEMPLATE_PREVIEW[g]}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const TEMPLATE_PREVIEW: Record<OutlineGenre, string> = {
  expository: '是什么 / 性质与特征 / 数量与关系 / 空间与时间 / 动作与影响',
  narrative: '起因 / 发展 / 冲突 / 转折 / 结果',
  argumentative: '核心论点 / 分论点一 / 分论点二 / 反方观点与驳斥 / 结论',
}

/* ============================ 编辑工作台 ============================ */

function OutlineWorkbench({
  outline,
  notes,
  saveState,
  onBack,
  onDelete,
}: {
  outline: WritingOutline
  notes: ReadingNote[]
  saveState: 'idle' | 'saving' | 'saved'
  onBack: () => void
  onDelete: () => void
}) {
  const updateData = useAppStore((s) => s.updateData)
  const notify = useAppStore((s) => s.notify)

  const [confirmDelete, setConfirmDelete] = useState(false)
  /** 正在为哪个三级节点挑引用笔记 */
  const [evidenceTarget, setEvidenceTarget] = useState<string | null>(null)

  const tree = buildTree(outline.sections)
  const genre = outline.genre ?? 'expository'

  /** 就地修改大纲 */
  function patchOutline(fn: (o: WritingOutline) => void) {
    updateData((d) => {
      const o = d.outlines.find((x) => x.id === outline.id)
      if (!o) return
      fn(o)
      o.updatedAt = new Date().toISOString()
    })
  }

  /** 修改某个节点 */
  function patchSection(id: string, fn: (s: OutlineSection) => void) {
    patchOutline((o) => {
      const s = o.sections.find((x) => x.id === id)
      if (s) fn(s)
    })
  }

  /** 树结构变更后回写扁平数组 */
  function mutateTree(fn: (t: OutlineTree) => void) {
    patchOutline((o) => {
      const t = buildTree(o.sections)
      fn(t)
      o.sections = flattenTree(t)
    })
  }

  function swapGroup(i: number, j: number) {
    if (j < 0 || j >= tree.groups.length) return
    mutateTree((t) => {
      const tmp = t.groups[i]
      t.groups[i] = t.groups[j]
      t.groups[j] = tmp
    })
  }

  function swapChild(gi: number, i: number, j: number) {
    const children = tree.groups[gi].children
    if (j < 0 || j >= children.length) return
    mutateTree((t) => {
      const arr = t.groups[gi].children
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    })
  }

  /** 引用笔记到三级节点：填标题+关键句，并回填 evidenceIds */
  function applyEvidence(sectionId: string, note: ReadingNote) {
    patchOutline((o) => {
      const s = o.sections.find((x) => x.id === sectionId)
      if (!s) return
      s.heading = note.title.trim() || '（未命名笔记）'
      s.thesis = pickKeySentence(note)
      if (!s.evidenceIds.includes(note.id)) s.evidenceIds = [...s.evidenceIds, note.id]
      if (!o.noteIds.includes(note.id)) o.noteIds = [...o.noteIds, note.id]
    })
    setEvidenceTarget(null)
    notify('success', '已引用笔记到三级节点', 2200)
  }

  function exportMarkdown() {
    const md = outlineToMarkdown(outline, notes)
    const fileName = markdownFileName('outline', outline.title)
    downloadMarkdown(fileName, md)
    notify('success', `已导出 ${fileName}`, 2500)
  }

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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 左：编辑区 */}
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <input
              value={outline.title}
              onChange={(e) => patchOutline((o) => (o.title = e.target.value))}
              placeholder="大纲标题"
              className="w-full border-b border-slate-200 pb-2 text-lg font-semibold outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />

            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">文体</div>
              <div className="flex gap-2">
                {GENRE_OPTIONS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      patchOutline((o) => (o.genre = g))
                      notify('info', '文体影响模板提示，不会清空已有内容', 2500)
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      genre === g
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {OUTLINE_GENRE_LABEL[g]}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                文体影响模板提示，切换不会清空已有内容。
              </p>
            </div>
          </section>

          {/* 一级节点 */}
          <section className="rounded-xl border border-teal-300 bg-white p-4 dark:border-teal-800 dark:bg-slate-800">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                一级
              </span>
              <span className="text-xs text-slate-500">核心概念 / 论点 / 主旨（必填，仅一个）</span>
            </div>
            {tree.root ? (
              <div className="flex flex-col gap-2">
                <input
                  value={tree.root.heading}
                  onChange={(e) =>
                    patchSection(tree.root!.id, (s) => (s.heading = e.target.value))
                  }
                  placeholder="一级标题（必填）"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <textarea
                  value={tree.root.thesis}
                  onChange={(e) =>
                    patchSection(tree.root!.id, (s) => (s.thesis = e.target.value))
                  }
                  rows={2}
                  placeholder="一句话说清这段要表达的核心主张"
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  mutateTree((t) => {
                    t.root = createSection(0)
                  })
                }
                className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-600"
              >
                添加一级节点
              </button>
            )}
          </section>

          {/* 二级 + 三级 */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                二级 / 三级节点
              </h2>
              <button
                type="button"
                onClick={() =>
                  mutateTree((t) => {
                    t.groups.push({ section: createSection(1), children: [] })
                  })
                }
                className="rounded border border-teal-300 px-2 py-1 text-xs text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-950"
              >
                + 二级节点
              </button>
            </div>

            {tree.groups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800">
                还没有二级节点。
              </p>
            ) : (
              tree.groups.map((g, gi) => (
                <div
                  key={g.section.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                      二级
                    </span>
                    <div className="flex gap-1">
                      <IconBtn
                        label="上移"
                        disabled={gi === 0}
                        onClick={() => swapGroup(gi, gi - 1)}
                      />
                      <IconBtn
                        label="下移"
                        disabled={gi === tree.groups.length - 1}
                        onClick={() => swapGroup(gi, gi + 1)}
                      />
                      <IconBtn
                        label="删除"
                        danger
                        onClick={() =>
                          mutateTree((t) => {
                            t.groups.splice(gi, 1)
                          })
                        }
                      />
                    </div>
                  </div>

                  <input
                    value={g.section.heading}
                    onChange={(e) =>
                      patchSection(g.section.id, (s) => (s.heading = e.target.value))
                    }
                    placeholder="二级标题，如：性质与特征"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <textarea
                    value={g.section.thesis}
                    onChange={(e) =>
                      patchSection(g.section.id, (s) => (s.thesis = e.target.value))
                    }
                    rows={2}
                    placeholder="这一层的论点 / 逻辑展开（可选）"
                    className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />

                  {/* 三级节点 */}
                  <div className="mt-3 flex flex-col gap-2 border-l-2 border-slate-100 pl-3 dark:border-slate-700">
                    {g.children.map((leaf, li) => (
                      <div
                        key={leaf.id}
                        className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-700/40"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            三级
                          </span>
                          <div className="flex gap-1">
                            <IconBtn
                              label="上移"
                              disabled={li === 0}
                              onClick={() => swapChild(gi, li, li - 1)}
                            />
                            <IconBtn
                              label="下移"
                              disabled={li === g.children.length - 1}
                              onClick={() => swapChild(gi, li, li + 1)}
                            />
                            <IconBtn
                              label="删除"
                              danger
                              onClick={() =>
                                mutateTree((t) => {
                                  t.groups[gi].children.splice(li, 1)
                                })
                              }
                            />
                          </div>
                        </div>
                        <input
                          value={leaf.heading}
                          onChange={(e) =>
                            patchSection(leaf.id, (s) => (s.heading = e.target.value))
                          }
                          placeholder="事例 / 证据 / 数据 / 细节"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        />
                        <textarea
                          value={leaf.thesis}
                          onChange={(e) =>
                            patchSection(leaf.id, (s) => (s.thesis = e.target.value))
                          }
                          rows={2}
                          placeholder="具体内容"
                          className="mt-1.5 w-full resize-y rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        />
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEvidenceTarget(leaf.id)}
                            className="rounded border border-teal-300 px-2 py-0.5 text-[11px] text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-950"
                          >
                            引用证据
                          </button>
                          {resolveNoteRefs(leaf.evidenceIds, notes).map((ref) => (
                            <span
                              key={ref.id}
                              className={`rounded px-1.5 py-0.5 text-[11px] ${
                                ref.missing
                                  ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300'
                                  : 'bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {REFERENCE_LABEL}
                              {ref.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        mutateTree((t) => {
                          t.groups[gi].children.push(createSection(2))
                        })
                      }
                      className="self-start rounded border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-500 hover:bg-white dark:border-slate-600 dark:hover:bg-slate-700"
                    >
                      + 三级节点
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>

          {/* 删除大纲 */}
          <div className="flex flex-col gap-2 pb-4">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              删除这篇大纲
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
        </div>

        {/* 右：实时预览（移动端落在下方） */}
        <div className="lg:sticky lg:top-4 lg:h-fit">
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Markdown 预览
              </h2>
              <span className="text-[11px] text-slate-400">实时</span>
            </div>
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-anywhere px-4 py-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {outlineToMarkdown(outline, notes)}
            </pre>
          </div>
        </div>
      </div>

      {evidenceTarget && (
        <EvidencePickerModal
          notes={notes}
          onClose={() => setEvidenceTarget(null)}
          onPick={(n) => applyEvidence(evidenceTarget, n)}
        />
      )}
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-1.5 py-0.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950'
          : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
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

/* ============================ 引用证据弹窗 ============================ */

function EvidencePickerModal({
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
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">引用证据</h3>
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
