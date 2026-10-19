/**
 * 输出页 —— 路由 /output，用 tab 承载两个模块：
 *   Tab 1「费曼输出」：选一个概念，按费曼四步走（教小学生 → 标卡壳 → 回去重学 → 比喻简化），
 *                     逼用户暴露「我其实没懂」的地方（对应第一章「主动参与」「模式提取」）。
 *   Tab 2「一页纸」：选一个主题，用一段结构化文本把核心概念与关系串起来，
 *                     补上「从点到网」的环节（对应「学得好 = 模式提取 + 迁移」）。
 *
 * URL 约定：?tab=feynman | one-pager；?concept=xxx 自动填入概念输入框；
 * ?cardId=xxx 一并记录到 sourceCardId（从卡片页深链跳转而来）。
 * tab 切换时同步更新 ?tab= 参数，刷新后停留在当前 tab。
 *
 * 定位：不做评分、不做 AI 批改、不做完成度；文案正向、具体、非评判。
 * 两个模块各自独立 store / 独立持久化 key（sdl_feynman_notes / sdl_one_page_notes），互不干扰。
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../store/appStore'
import {
  useFeynmanNoteStore,
  selectRecentNotes as selectFeynmanRecent,
} from '../stores/feynmanNoteStore'
import {
  useOnePageNoteStore,
  selectRecentNotes as selectOnePageRecent,
} from '../stores/onePageNoteStore'
import type { FeynmanNote, OnePageNote } from '../types/models'
import styles from './OutputPage.module.css'

/** 页头标题 */
const PAGE_TITLE = '输出'

/** tab 定义 */
type TabKey = 'feynman' | 'one-pager'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'feynman', label: '费曼输出' },
  { key: 'one-pager', label: '一页纸' },
]

/** 费曼四步定义：每步一个 textarea + 一行小字提示 */
const FLEINMAN_STEPS = [
  {
    key: 'simpleExplanation' as const,
    label: '第一步：用教小学生的语言写',
    hint: '假设对面是一个 10 岁小孩，不能用术语，只能举例。',
  },
  {
    key: 'gaps' as const,
    label: '第二步：哪里卡壳了',
    hint: '写的时候哪一句你发现自己说不清？那就是你真正没懂的地方。',
  },
  {
    key: 'relearn' as const,
    label: '第三步：回去重学后补充',
    hint: '带着卡壳的地方回去查/读，回来补一句你新理解到的。',
  },
  {
    key: 'analogy' as const,
    label: '第四步：用比喻简化',
    hint: '用一个生活里的东西打比方。比喻不用完美，能帮你想通就行。',
  },
]

/** 保存成功 toast */
const SAVE_TOAST = '讲清楚一次，比读十遍都管用。'
/** 后三步空着时保存前的轻提示 */
const EMPTY_TAIL_HINT = '后三步空着也能保存，但填了会更容易发现没懂的地方。'

/** 一页纸：保存成功 toast */
const OP_SAVE_TOAST = '能在一页纸上串起来，才是真的串起来了。'
/** 一页纸：主题输入 placeholder */
const OP_TOPIC_PLACEHOLDER = '想整理哪个主题？比如：第一章 学习的本质'
/** 一页纸：内容输入 placeholder（示例引导，等宽字体便于画箭头/缩进） */
const OP_CONTENT_PLACEHOLDER =
  '用你自己的话，把核心概念和它们的关系串起来。可以用缩进、箭头、短句。不用好看，只要你自己能看懂。\n' +
  '示例：\n' +
  '学习的本质\n' +
  '→ 不是记答案，是建模\n' +
  '→ 模型由表征构成\n' +
  '→ 模型靠反馈迭代\n' +
  '→ 所以学得好=能迁移'

/** 列表最多显示的条数，超出折叠为「还有 N 条」 */
const NOTE_VISIBLE_LIMIT = 5
/** 列表缩略显示：第一步前 N 字 */
const PREVIEW_LIMIT = 80

export default function OutputPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as TabKey) || 'feynman'

  /** 切换 tab：同步更新 ?tab= 参数（保留其余参数），刷新后停留当前 tab */
  function switchTab(key: TabKey) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (key === 'feynman') next.delete('tab') // 默认 tab 不带参数，URL 更干净
        else next.set('tab', key)
        // concept / cardId 跟随当前 tab 场景保留或清理
        if (key === 'one-pager') {
          next.delete('concept')
          next.delete('cardId')
        }
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className={styles.page}>
      {/* 1. 标题 */}
      <header className={styles.header}>
        <h1 className={styles.title}>{PAGE_TITLE}</h1>
      </header>

      {/* 2. tab（下划线样式，非按钮组） */}
      <nav className={styles.tabs} role="tablist" aria-label="输出模块">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* 3. tab 内容 */}
      {tab === 'feynman' ? (
        <FeynmanTab
          concept={searchParams.get('concept') ?? ''}
          cardId={searchParams.get('cardId') ?? ''}
          onConceptCleared={() => {
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                next.delete('concept')
                next.delete('cardId')
                return next
              },
              { replace: true },
            )
          }}
        />
      ) : (
        <OnePagerTab />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Tab 2：一页纸挑战                                                          */
/* -------------------------------------------------------------------------- */

/** 一页纸正文前 N 字（列表缩略） */
const OP_PREVIEW_LIMIT = 80

function OnePagerTab() {
  const notify = useAppStore((s) => s.notify)
  const addNote = useOnePageNoteStore((s) => s.addNote)
  const removeNote = useOnePageNoteStore((s) => s.removeNote)
  /** useShallow：派生数组每次是新引用，浅比较避免无限渲染 */
  const recentNotes = useOnePageNoteStore(
    useShallow((s) => selectOnePageRecent(s)),
  )

  /* 表单本地状态 */
  const [topic, setTopic] = useState('')
  const [content, setContent] = useState('')
  /** 列表展开/收起（超过 NOTE_VISIBLE_LIMIT 时） */
  const [notesExpanded, setNotesExpanded] = useState(false)
  /** 展开全文的笔记 id 集合 */
  const [openNoteIds, setOpenNoteIds] = useState<Set<string>>(new Set())

  const canSave = topic.trim().length > 0 && content.trim().length > 0

  function handleSave() {
    if (!canSave) return
    addNote(topic, content)
    notify('success', OP_SAVE_TOAST, 4000)
    // 保存后只清正文、保留主题（便于就同一主题继续写多张）
    setContent('')
  }

  function toggleNoteOpen(id: string) {
    setOpenNoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleNotes = notesExpanded
    ? recentNotes
    : recentNotes.slice(0, NOTE_VISIBLE_LIMIT)
  const extraCount = recentNotes.length - NOTE_VISIBLE_LIMIT

  return (
    <div className={styles.feynman}>
      {/* 主题输入框（普通字体） */}
      <section className={styles.conceptBlock}>
        <label className={styles.fieldLabel} htmlFor="op-topic">
          想整理哪个主题
        </label>
        <input
          id="op-topic"
          className={styles.conceptInput}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={OP_TOPIC_PLACEHOLDER}
          aria-label="主题"
        />
      </section>

      {/* 内容输入（等宽字体，便于画箭头/缩进，不做富文本） */}
      <section className={styles.opContentBlock}>
        <label className={styles.fieldLabel} htmlFor="op-content">
          一页纸正文
        </label>
        <textarea
          id="op-content"
          className={styles.opContentInput}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={OP_CONTENT_PLACEHOLDER}
          rows={12}
          aria-label="一页纸正文"
        />
        <p className={styles.stepHint}>
          不用好看，只要你自己能看懂。串起来的那一刻，就是你真的懂了。
        </p>
      </section>

      {/* 保存按钮（主题 + 内容都必填，按钮 disabled 控制） */}
      <div className={styles.saveRow}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={!canSave}
        >
          保存我的一页纸
        </button>
      </div>

      {/* 我的一页纸列表 */}
      <section className={styles.notes}>
        <h2 className={styles.notesTitle}>我的一页纸</h2>
        {recentNotes.length === 0 ? (
          <div className={styles.empty}>
            还没有一页纸。选一个你最近在学的主题，试着用一段话把它串起来。
          </div>
        ) : (
          <>
            <ul className={styles.noteList}>
              {visibleNotes.map((note) => (
                <OnePageItem
                  key={note.id}
                  note={note}
                  open={openNoteIds.has(note.id)}
                  onToggle={() => toggleNoteOpen(note.id)}
                  onDelete={() => removeNote(note.id)}
                />
              ))}
            </ul>
            {extraCount > 0 && !notesExpanded && (
              <button
                type="button"
                className={styles.expandMore}
                onClick={() => setNotesExpanded(true)}
                aria-expanded={false}
              >
                还有 {extraCount} 条，点开展开 ▾
              </button>
            )}
            {notesExpanded && (
              <button
                type="button"
                className={styles.expandMore}
                onClick={() => setNotesExpanded(false)}
                aria-expanded={true}
              >
                收起 ▴
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}

/** 单张一页纸：主题 + 日期 + 内容前 80 字；点击展开全文；支持删除 */
function OnePageItem({
  note,
  open,
  onToggle,
  onDelete,
}: {
  note: OnePageNote
  open: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const preview = note.content.slice(0, OP_PREVIEW_LIMIT)
  const truncated = note.content.length > OP_PREVIEW_LIMIT
  const dateStr = useMemo(() => {
    const d = new Date(note.createdAt)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [note.createdAt])

  return (
    <li className={styles.note}>
      <div className={styles.noteTop}>
        <span className={styles.noteConcept}>{note.topic}</span>
        <span className={styles.noteDate}>{dateStr}</span>
        <button
          type="button"
          className={styles.noteDelete}
          onClick={onDelete}
          aria-label={`删除「${note.topic}」这张一页纸`}
        >
          删除
        </button>
      </div>
      <button
        type="button"
        className={styles.noteBody}
        onClick={onToggle}
        aria-expanded={open}
      >
        {/* 收起态：内容前 80 字（超出省略号） */}
        {!open && (
          <span className={styles.opPreview}>
            {preview}
            {truncated ? '…' : ''}
          </span>
        )}
        {/* 展开态：内容全文（等宽字体保留箭头/缩进排版） */}
        {open && <span className={styles.opFull}>{note.content}</span>}
        <span className={styles.noteToggleHint} aria-hidden>
          {open ? '收起 ▴' : '展开 ▾'}
        </span>
      </button>
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/* Tab 1：费曼输出                                                             */
/* -------------------------------------------------------------------------- */

function FeynmanTab({
  concept,
  cardId,
  onConceptCleared,
}: {
  /** URL ?concept= 的初始值 */
  concept: string
  /** URL ?cardId= 的初始值（从卡片页深链来则记录到 sourceCardId） */
  cardId: string
  /** 概念输入被手动清空后，同步清掉 URL 参数 */
  onConceptCleared: () => void
}) {
  const notify = useAppStore((s) => s.notify)
  const addNote = useFeynmanNoteStore((s) => s.addNote)
  const removeNote = useFeynmanNoteStore((s) => s.removeNote)
  /** useShallow：派生数组每次是新引用，浅比较避免无限渲染 */
  const recentNotes = useFeynmanNoteStore(
    useShallow((s) => selectFeynmanRecent(s)),
  )

  /* 表单本地状态：concept / sourceCardId 由 URL 初始化（深链跳转自动填入） */
  const [conceptText, setConceptText] = useState(concept)
  const [sourceCardId] = useState(cardId || undefined)
  const [simple, setSimple] = useState('')
  const [gaps, setGaps] = useState('')
  const [relearn, setRelearn] = useState('')
  const [analogy, setAnalogy] = useState('')
  /** 保存前的轻提示（后三步空时显示） */
  const [showTailHint, setShowTailHint] = useState(false)
  /** 列表展开/收起（超过 NOTE_VISIBLE_LIMIT 时） */
  const [notesExpanded, setNotesExpanded] = useState(false)
  /** 展开全文的笔记 id 集合 */
  const [openNoteIds, setOpenNoteIds] = useState<Set<string>>(new Set())

  /** concept 参数变化（再次从卡片页深链进来）时同步回填 */
  useEffect(() => {
    if (concept) setConceptText(concept)
  }, [concept])

  /** 手动清空概念输入时，同步清掉 URL 的 concept / cardId 参数（避免残留） */
  function handleConceptChange(v: string) {
    setConceptText(v)
    if (v.trim() === '') onConceptCleared()
  }

  function handleSave() {
    const trimmedConcept = conceptText.trim()
    const trimmedSimple = simple.trim()
    if (!trimmedConcept || !trimmedSimple) return
    // 后三步空 → 先显示轻提示，不阻断；tailHint 保留到下次再保存时才重置
    const tailEmpty = !gaps.trim() && !relearn.trim() && !analogy.trim()
    setShowTailHint(tailEmpty)
    addNote({
      conceptText: trimmedConcept,
      sourceCardId: sourceCardId,
      simpleExplanation: trimmedSimple,
      gaps: gaps.trim() || undefined,
      relearn: relearn.trim() || undefined,
      analogy: analogy.trim() || undefined,
    })
    notify('success', SAVE_TOAST, 4000)
    resetForm()
  }

  function resetForm() {
    setSimple('')
    setGaps('')
    setRelearn('')
    setAnalogy('')
    setConceptText('')
    onConceptCleared()
  }

  function toggleNoteOpen(id: string) {
    setOpenNoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleNotes = notesExpanded
    ? recentNotes
    : recentNotes.slice(0, NOTE_VISIBLE_LIMIT)
  const extraCount = recentNotes.length - NOTE_VISIBLE_LIMIT

  return (
    <div className={styles.feynman}>
      {/* 3a. 概念输入框 */}
      <section className={styles.conceptBlock}>
        <label className={styles.fieldLabel} htmlFor="feynman-concept">
          想讲哪个概念
        </label>
        <input
          id="feynman-concept"
          className={styles.conceptInput}
          value={conceptText}
          onChange={(e) => handleConceptChange(e.target.value)}
          placeholder="想讲清楚哪个概念？"
          aria-label="概念名"
        />
      </section>

      {/* 3b. 四步表单（编号 1/2/3/4 视觉步骤，无进度条、无完成度） */}
      <section className={styles.steps}>
        <StepArea
          step={1}
          title={FLEINMAN_STEPS[0].label}
          hint={FLEINMAN_STEPS[0].hint}
          required
          value={simple}
          onChange={setSimple}
        />
        <StepArea
          step={2}
          title={FLEINMAN_STEPS[1].label}
          hint={FLEINMAN_STEPS[1].hint}
          value={gaps}
          onChange={setGaps}
        />
        <StepArea
          step={3}
          title={FLEINMAN_STEPS[2].label}
          hint={FLEINMAN_STEPS[2].hint}
          value={relearn}
          onChange={setRelearn}
        />
        <StepArea
          step={4}
          title={FLEINMAN_STEPS[3].label}
          hint={FLEINMAN_STEPS[3].hint}
          value={analogy}
          onChange={setAnalogy}
        />
      </section>

      {/* 3c. 保存按钮 + 后三步空时轻提示 */}
      <div className={styles.saveRow}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={!conceptText.trim() || !simple.trim()}
        >
          保存费曼笔记
        </button>
        {showTailHint && (
          <p className={styles.tailHint}>{EMPTY_TAIL_HINT}</p>
        )}
      </div>

      {/* 3d. 我的费曼笔记列表 */}
      <section className={styles.notes}>
        <h2 className={styles.notesTitle}>我的费曼笔记</h2>
        {recentNotes.length === 0 ? (
          <div className={styles.empty}>
            还没有费曼笔记。选一个你最近在学的概念，试着讲给一个 10 岁小孩听。
          </div>
        ) : (
          <>
            <ul className={styles.noteList}>
              {visibleNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  open={openNoteIds.has(note.id)}
                  onToggle={() => toggleNoteOpen(note.id)}
                  onDelete={() => removeNote(note.id)}
                />
              ))}
            </ul>
            {extraCount > 0 && !notesExpanded && (
              <button
                type="button"
                className={styles.expandMore}
                onClick={() => setNotesExpanded(true)}
                aria-expanded={false}
              >
                还有 {extraCount} 条，点开展开 ▾
              </button>
            )}
            {notesExpanded && (
              <button
                type="button"
                className={styles.expandMore}
                onClick={() => setNotesExpanded(false)}
                aria-expanded={true}
              >
                收起 ▴
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}

/** 单步 textarea：编号 1/2/3/4 + 标题 + 小字提示 */
function StepArea({
  step,
  title,
  hint,
  required,
  value,
  onChange,
}: {
  step: number
  title: string
  hint: string
  required?: boolean
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className={styles.step}>
      <div className={styles.stepHead}>
        <span className={styles.stepNum} aria-hidden>
          {step}
        </span>
        <span className={styles.stepTitle}>
          {title}
          {required && <span className={styles.stepReq}>（必填）</span>}
        </span>
      </div>
      <textarea
        className={styles.stepInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="在这里写…"
        rows={3}
        aria-label={title}
      />
      <p className={styles.stepHint}>{hint}</p>
    </div>
  )
}

/** 单条笔记：概念名 + 日期 + 第一步前 80 字；点击展开全文（四步内容）；支持删除 */
function NoteItem({
  note,
  open,
  onToggle,
  onDelete,
}: {
  note: FeynmanNote
  open: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const preview = note.simpleExplanation.slice(0, PREVIEW_LIMIT)
  const truncated = note.simpleExplanation.length > PREVIEW_LIMIT
  const dateStr = useMemo(() => {
    const d = new Date(note.createdAt)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [note.createdAt])

  return (
    <li className={styles.note}>
      <div className={styles.noteTop}>
        <span className={styles.noteConcept}>{note.conceptText}</span>
        <span className={styles.noteDate}>{dateStr}</span>
        <button
          type="button"
          className={styles.noteDelete}
          onClick={onDelete}
          aria-label={`删除「${note.conceptText}」这条费曼笔记`}
        >
          删除
        </button>
      </div>
      <button
        type="button"
        className={styles.noteBody}
        onClick={onToggle}
        aria-expanded={open}
      >
        {/* 收起态：第一步前 80 字（超出省略号） */}
        {!open && (
          <span className={styles.notePreview}>
            {preview}
            {truncated ? '…' : ''}
          </span>
        )}
        {/* 展开态：第一步全文 + 后三步 */}
        {open && (
          <>
            <span className={styles.noteFull}>{note.simpleExplanation}</span>
            <span className={styles.noteRest}>
              {note.gaps && <RestBlock label="卡壳" text={note.gaps} />}
              {note.relearn && <RestBlock label="重学" text={note.relearn} />}
              {note.analogy && <RestBlock label="比喻" text={note.analogy} />}
              {(!note.gaps && !note.relearn && !note.analogy) && (
                <span className={styles.noteRestEmpty}>
                  后三步没填。当时讲到这里，哪些说不清？下次可以补上。
                </span>
              )}
            </span>
          </>
        )}
        <span className={styles.noteToggleHint} aria-hidden>
          {open ? '收起 ▴' : '展开 ▾'}
        </span>
      </button>
    </li>
  )
}

/** 展开态里的一条后三步内容 */
function RestBlock({ label, text }: { label: string; text: string }) {
  return (
    <span className={styles.restBlock}>
      <span className={styles.restLabel}>{label}</span>
      <span>{text}</span>
    </span>
  )
}
