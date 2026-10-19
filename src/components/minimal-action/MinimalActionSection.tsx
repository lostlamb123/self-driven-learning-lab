/**
 * 今日最小行动 —— 模块主组件
 *
 * 布局（自上而下）：
 * 1. 输入区：引导文案 + 输入框 + 类型标签 chips（选中标签显示原理短句）+ 难度自评 + 提交
 * 2. 行动卡片列表：今日行动卡，可展开/收起；待完成可点「完成」进入情绪选择，
 *    完成后显示所选情绪 + 即时回应
 *
 * 文案约定：反馈正向、具体、非评判；不出现「断签」「你真棒」等措辞。
 * 连续天数展示在页面底部（由 TodayPage 负责），模块内不做指标/进度条。
 */
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../store/appStore'
import {
  useMinimalActionStore,
  selectTodayActions,
} from '../../stores/minimalActionStore'
import { useConceptCardStore, selectTodayCards } from '../../stores/conceptCardStore'
import {
  MINIMAL_ACTION_PRINCIPLES,
  MINIMAL_DIFFICULTY_LABEL,
  MINIMAL_MOOD_EMOJI,
  MINIMAL_MOOD_RESPONSE,
  MINIMAL_MOOD_TEXT,
  MINIMAL_TAG_LABEL,
  MINIMAL_TAG_PRINCIPLE,
  type MinimalAction,
  type MinimalActionTag,
  type MinimalDifficulty,
  type MinimalMood,
} from '../../types/models'
import styles from './MinimalAction.module.css'

/** 输入框 placeholder（按产品要求固定文案） */
const INPUT_PLACEHOLDER =
  '把它拆到 5—10 分钟能完成，小到不会想逃避。比如：不是「学英语」，而是「读一页英文绘本并用一句话复述」。'

/** 引导文案（输入框上方） */
const LEAD_COPY = '小到不会逃避，就是最好的开始。'

/** 卡片最多展示的标签数，超出折叠为「+N」 */
const MAX_VISIBLE_TAGS = 3

/** 随机取一条原理金句 */
function randomPrinciple(): string {
  const list = MINIMAL_ACTION_PRINCIPLES as readonly string[]
  return list[Math.floor(Math.random() * list.length)]
}

/** 难度自评即时反馈：选中难度后在 chip 下方显示的一句轻文案，非评判语气 */
const DIFFICULTY_FEEDBACK: Record<MinimalDifficulty, string> = {
  easy: '明天可以试着加一点点难度，回到最近学习区。',
  just: '这就是最近学习区。踮脚够得着，学习效率最高。',
  hard: '有点难但做到了，说明你在扩展边界。明天可以保持，也可以拆小一点。',
}

export default function MinimalActionSection() {
  const notify = useAppStore((s) => s.notify)

  /* ---------------- 输入区 state ---------------- */
  const [text, setText] = useState('')
  const [selectedTags, setSelectedTags] = useState<MinimalActionTag[]>([])
  const [difficulty, setDifficulty] = useState<MinimalDifficulty | undefined>(
    undefined,
  )

  /* ---------------- 动作 store ---------------- */
  const addAction = useMinimalActionStore((s) => s.addAction)
  const completeAction = useMinimalActionStore((s) => s.completeAction)
  const reopenAction = useMinimalActionStore((s) => s.reopenAction)
  /** useShallow：派生数组每次是新引用，浅比较按 id 判定，避免无限渲染 */
  const todayActions = useMinimalActionStore(
    useShallow((s) => selectTodayActions(s)),
  )

  /** 今日待刷卡数（概念卡）：标记完成后若仍有待刷卡，在卡片底部显轻提示 */
  const pendingCardCount = useConceptCardStore(
    useShallow((s) => selectTodayCards(s).length),
  )

  /** 正在做「完成」操作（展开情绪选择器）的行动 id 集合 */
  const [moodPickerFor, setMoodPickerFor] = useState<string | null>(null)

  /**
   * 展开/收起状态：默认全部展开，用户主动收起的记在集合里。
   * 用「收起集合」而非「展开集合」，这样新增的行动天然是展开的。
   */
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /**
   * 每个行动卡固定一条原理金句。
   * 按 id 缓存，行动新增时才重新生成对应条目，避免每次渲染抖动导致金句跳动。
   */
  const quoteCacheRef = useRef<Map<string, string>>(new Map())
  const quotes = useMemo(() => {
    for (const a of todayActions) {
      if (!quoteCacheRef.current.has(a.id)) {
        quoteCacheRef.current.set(a.id, randomPrinciple())
      }
    }
    return todayActions.map((a) => quoteCacheRef.current.get(a.id)! )
  }, [todayActions])

  function toggleTag(tag: MinimalActionTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    addAction(trimmed, selectedTags, difficulty)
    setText('')
    setSelectedTags([])
    setDifficulty(undefined)
  }

  function handleComplete(id: string) {
    // 点击「完成」不直接打勾，先展开情绪选择
    setMoodPickerFor(id)
  }

  function handleMoodSelect(id: string, mood: MinimalMood) {
    completeAction(id, mood)
    setMoodPickerFor(null)
    notify('success', MINIMAL_MOOD_RESPONSE[mood], 6000)
  }

  function handleReopen(id: string) {
    reopenAction(id)
    setMoodPickerFor(null)
  }

  const selectedPrinciple =
    selectedTags.length > 0 ? MINIMAL_TAG_PRINCIPLE[selectedTags[0]] : null

  return (
    <div className={styles.section}>
      {/* 模块标题 */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>今日最小行动</h2>
        <p className={styles.sectionLead}>一件事，5—10 分钟，做完就记一笔。</p>
      </div>

      {/* 输入区 */}
      <form className={styles.formCard} onSubmit={handleSubmit}>
        <div className={styles.lead}>{LEAD_COPY}</div>
        <textarea
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={INPUT_PLACEHOLDER}
          rows={3}
          aria-label="今日最小行动"
        />

        {/* 类型标签 */}
        <div>
          <div className={styles.tagLabel}>行动类型（可多选）</div>
          <div className={styles.tagRow} role="group" aria-label="行动类型">
            {(Object.keys(MINIMAL_TAG_LABEL) as MinimalActionTag[]).map((tag) => (
              <button
                key={tag}
                type="button"
                className={`${styles.chip} ${
                  selectedTags.includes(tag) ? styles.chipActive : ''
                }`}
                aria-pressed={selectedTags.includes(tag)}
                onClick={() => toggleTag(tag)}
              >
                {MINIMAL_TAG_LABEL[tag]}
              </button>
            ))}
          </div>
          {selectedPrinciple && (
            <div className={styles.principle} aria-live="polite">
              <span className={styles.principleIcon} aria-hidden>
                💡
              </span>
              <span className={styles.principleText}>{selectedPrinciple}</span>
            </div>
          )}
        </div>

        {/* 难度自评 */}
        <div>
          <div className={styles.tagLabel}>难度自评（可选）</div>
          <div className={styles.difficultyRow} role="radiogroup" aria-label="难度自评">
            <span className={styles.difficultyTitle} aria-hidden />
            {(Object.keys(MINIMAL_DIFFICULTY_LABEL) as MinimalDifficulty[]).map(
              (d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={difficulty === d}
                  className={`${styles.difficultyChip} ${
                    difficulty === d ? styles.difficultyChipActive : ''
                  }`}
                  onClick={() =>
                    setDifficulty((cur) => (cur === d ? undefined : d))
                  }
                >
                  {MINIMAL_DIFFICULTY_LABEL[d]}
                </button>
              ),
            )}
          </div>
          {difficulty && (
            <div className={styles.difficultyFeedback} aria-live="polite">
              {DIFFICULTY_FEEDBACK[difficulty]}
            </div>
          )}
        </div>

        <button type="submit" className={styles.submitBtn} disabled={!text.trim()}>
          记入今日行动
        </button>
      </form>

      {/* 行动卡片 */}
      {todayActions.length === 0 ? (
        <div className={styles.empty}>
          还没有填。想到一件 5 分钟能做的小事时，写进上面就好。
        </div>
      ) : (
        <div className={styles.list}>
          {todayActions.map((action, idx) => (
            <ActionCard
              key={action.id}
              action={action}
              quote={quotes[idx] ?? randomPrinciple()}
              collapsed={collapsedIds.has(action.id)}
              onToggleCollapse={() => toggleCollapsed(action.id)}
              showMoodPicker={moodPickerFor === action.id}
              onOpenMoodPicker={() => handleComplete(action.id)}
              onMoodSelect={(mood) => handleMoodSelect(action.id, mood)}
              onReopen={() => handleReopen(action.id)}
              showCardHint={pendingCardCount > 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 单张行动卡                                                                 */
/* -------------------------------------------------------------------------- */

function ActionCard({
  action,
  quote,
  collapsed,
  onToggleCollapse,
  showMoodPicker,
  onOpenMoodPicker,
  onMoodSelect,
  onReopen,
  showCardHint,
}: {
  action: MinimalAction
  quote: string
  collapsed: boolean
  onToggleCollapse: () => void
  showMoodPicker: boolean
  onOpenMoodPicker: () => void
  onMoodSelect: (mood: MinimalMood) => void
  onReopen: () => void
  /** 今日仍有待刷卡时，在"已完成"卡片底部显轻提示 */
  showCardHint: boolean
}) {
  const done = action.status === 'done'
  const visibleTags = action.tags.slice(0, MAX_VISIBLE_TAGS)
  const extraTags = action.tags.length - visibleTags.length

  return (
    <div className={`${styles.card} ${done ? styles.cardDone : ''}`}>
      {/* 顶部：行动文本 + 状态徽章 + 展开/收起 */}
      <div className={styles.cardTop}>
        <span className={styles.cardText}>{action.text}</span>
        <span
          className={`${styles.badge} ${
            done ? styles.badgeDone : styles.badgePending
          }`}
        >
          {done ? '已完成' : '待完成'}
        </span>
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? '展开这张行动卡' : '收起这张行动卡'}
        >
          {collapsed ? '展开' : '收起'}
          <span className={styles.caret} aria-hidden>
            {collapsed ? '▾' : '▴'}
          </span>
        </button>
      </div>

      {/* 收起态：只保留一句原理金句，保持轻量 */}
      {collapsed ? (
        <div className={styles.collapsedHint}>{quote}</div>
      ) : (
        <>
          {/* 标签（最多 3 个，超出折叠） */}
          {action.tags.length > 0 && (
            <div className={styles.cardTags}>
              {visibleTags.map((t) => (
                <span key={t} className={styles.cardChip}>
                  {MINIMAL_TAG_LABEL[t]}
                </span>
              ))}
              {extraTags > 0 && (
                <span
                  className={styles.moreCount}
                  title={action.tags
                    .slice(MAX_VISIBLE_TAGS)
                    .map((t) => MINIMAL_TAG_LABEL[t])
                    .join('、')}
                >
                  +{extraTags}
                </span>
              )}
            </div>
          )}

          {/* 难度自评 */}
          {action.difficulty && (
            <span className={styles.difficultyTag}>
              难度：{MINIMAL_DIFFICULTY_LABEL[action.difficulty]}
            </span>
          )}

          {/* 原理金句 */}
          <blockquote className={styles.quote}>{quote}</blockquote>

          {/* 底部操作区 */}
          <div className={styles.cardFooter}>
            {!done && !showMoodPicker && (
              <button
                type="button"
                className={styles.completeBtn}
                onClick={onOpenMoodPicker}
              >
                完成了？点这里 ✓
              </button>
            )}

            {/* 完成 -> 情绪选择器 */}
            {!done && showMoodPicker && (
              <div>
                <div
                  className={styles.tagLabel}
                  style={{ marginBottom: '0.375rem' }}
                >
                  做完之后，你此刻的感觉？
                </div>
                <div
                  className={styles.moodPicker}
                  role="group"
                  aria-label="情绪选择"
                >
                  {(Object.keys(MINIMAL_MOOD_TEXT) as MinimalMood[]).map(
                    (mood) => (
                      <button
                        key={mood}
                        type="button"
                        className={styles.moodBtn}
                        onClick={() => onMoodSelect(mood)}
                      >
                        <span className={styles.moodEmoji} aria-hidden>
                          {MINIMAL_MOOD_EMOJI[mood]}
                        </span>
                        <span>{MINIMAL_MOOD_TEXT[mood]}</span>
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* 已完成 -> 显示情绪 + 即时回应 */}
            {done && action.mood && (
              <>
                <div className={styles.moodDone}>
                  <span className={styles.moodEmoji} aria-hidden>
                    {MINIMAL_MOOD_EMOJI[action.mood]}
                  </span>
                  <span className={styles.moodDoneLabel}>
                    {MINIMAL_MOOD_TEXT[action.mood]}
                  </span>
                  <button
                    type="button"
                    className={styles.moodDoneAction}
                    onClick={onReopen}
                  >
                    撤销
                  </button>
                </div>
                <div className={styles.moodResponse}>
                  {MINIMAL_MOOD_RESPONSE[action.mood]}
                </div>
                {/* 完成后若今日仍有待刷卡，给一行轻提示（非催促、无红点） */}
                {showCardHint && (
                  <Link
                    to="/concept-cards"
                    className={styles.cardHint}
                  >
                    趁热刷一张相关卡片 →
                  </Link>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
