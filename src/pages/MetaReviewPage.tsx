/**
 * 今日复盘页 —— 路由 /review
 *
 * 定位：复盘不是打分、不是总结报告，而是用几个固定问题帮用户完成一次
 * 「元认知自问 + 模型迭代」。把第一章的「根据反馈调整模型」变成每天 2 分钟的习惯。
 *
 * 页面结构（自上而下）：
 * 1. 标题「今日复盘」+ 副标题「不是打分，是给今天的自己留一条反馈。」
 * 2. 今日速览卡（只读、不评判）：行动 / 情绪分布 / 好奇种子 / 卡片
 * 3. 元认知自问（三问）：注意力 / 方法有效 / 反例意外
 * 4. 保存按钮「记下今天的复盘」→ toast「今天的反馈已记下。明天见。」
 * 5. 今天已复盘则回显内容 + 「今天已经复盘过了。可以修改，也可以明天再来。」
 * 6. 底部轻量入口：回今日页 + 去刷卡片（仅今日有卡时）
 *
 * 核心：非评判 —— 不问「你今天做得怎么样」，而问「注意力在不在」「方法有没有效」
 * 「有没有遇到反例」。反例/意外字段是模型迭代的核心，不能省略。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import {
  useDailyReviewStore,
  selectTodayReview,
} from '../stores/dailyReviewStore'
import { useTodaySnapshot } from '../utils/reviewSnapshot'
import { toDateKey } from '../utils/date'
import {
  ATTENTION_OPTIONS,
  METHOD_OPTIONS,
  type AttentionLevel,
  type MethodEffect,
  type MinimalMood,
  type DailyMetaReview,
} from '../types/models'
import styles from './MetaReviewPage.module.css'

/** 标题 / 副标题 */
const TITLE = '今日复盘'
const SUBTITLE = '不是打分，是给今天的自己留一条反馈。'

/** 情绪 emoji 映射（用于速览卡情绪分布） */
const MOOD_EMOJI: Record<MinimalMood, string> = {
  good: '😊',
  neutral: '😐',
  hard: '😣',
}

export default function MetaReviewPage() {
  const notify = useAppStore((s) => s.notify)
  const snapshot = useTodaySnapshot()

  const saveReview = useDailyReviewStore((s) => s.saveReview)
  /** 今天的已存复盘（回显用） */
  const todayReview = useDailyReviewStore(selectTodayReview)

  /* ------------------- 表单本地状态 ------------------- */
  const [attention, setAttention] = useState<AttentionLevel>('on')
  const [method, setMethod] = useState<MethodEffect>('worked')
  const [attentionNote, setAttentionNote] = useState('')
  const [methodNote, setMethodNote] = useState('')
  const [surprise, setSurprise] = useState('')

  // 进入页面：有当天已存复盘则回填到表单（支持"可以修改"）
  useEffect(() => {
    if (todayReview) {
      setAttention(todayReview.attention)
      setMethod(todayReview.method)
      setAttentionNote(todayReview.attentionNote ?? '')
      setMethodNote(todayReview.nextTweak ?? '')
      setSurprise(todayReview.surprise ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayReview?.id])

  /** 是否已复盘过 */
  const hasReview = todayReview !== null

  /** 问题一：选"时有时无/不太在线"时显示补充输入 */
  const showAttentionNote = attention === 'partial' || attention === 'off'
  /** 问题二：选"部分有效/没太有效"时显示补充输入 */
  const showMethodNote = method === 'partly' || method === 'not_worked'

  function handleSave() {
    if (savingRef.current) return
    savingRef.current = true
    saveReview({
      date: todayKey(),
      attention,
      method,
      // 问题一补充 → attentionNote；问题二补充 → nextTweak；问题三 → surprise
      attentionNote: showAttentionNote ? attentionNote : undefined,
      nextTweak: showMethodNote ? methodNote : undefined,
      surprise,
    })
    notify('success', '今天的反馈已记下。明天见。', 4000)
    setTimeout(() => {
      savingRef.current = false
    }, 500)
  }

  /** 今日卡片是否还有待刷（控制底部「去刷卡片」入口） */
  const hasPendingCards = snapshot.cardsPending > 0

  /* 防止快速双击重复保存 */
  const savingRef = useRef(false)

  /* 「模型迭代日志」折叠区：默认折叠，列最近 10 条非空 surprise。
     仅当历史有 surprise 记录（pastSurprises 非空）时渲染，无数据整块不渲染。 */
  const [pastSurpriseOpen, setPastSurpriseOpen] = useState(false)
  /** 单条 surprise 展开全文的 id 集合（默认截断 120 字，点击条目展开全文） */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleItemExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 所有历史复盘（按日期倒序）+ 只保留有 surprise 的，最近 10 条
  const allReviews = useDailyReviewStore((s) => s.reviews)
  const pastSurprises = useMemo(
    () =>
      [...allReviews]
        .filter((r) => r.surprise && r.surprise.trim().length > 0)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10),
    [allReviews],
  )
  const showPastSection = pastSurprises.length > 0

  return (
    <div className={styles.page}>
      {/* 1. 标题 + 2. 副标题 */}
      <header className={styles.header}>
        <h1 className={styles.title}>{TITLE}</h1>
        <p className={styles.subtitle}>{SUBTITLE}</p>
      </header>

      {/* 3. 今日速览卡（只读、不评判） */}
      <section className={styles.snapshot}>
        <h2 className={styles.snapshotTitle}>今日速览</h2>
        <div className={styles.snapshotGrid}>
          {/* 行动 */}
          <div className={styles.snapItem}>
            <span className={styles.snapLabel}>今日最小行动</span>
            {snapshot.actionsTotal === 0 ? (
              <span className={styles.snapEmpty}>今天没有记录</span>
            ) : (
              <span className={styles.snapValue}>
                完成 {snapshot.actionsDone} / 总数 {snapshot.actionsTotal}
              </span>
            )}
          </div>

          {/* 情绪分布（只显示有数据的） */}
          <div className={styles.snapItem}>
            <span className={styles.snapLabel}>今日情绪分布</span>
            {hasMood(snapshot.moodCounts) ? (
              <span className={styles.moodRow}>
                {(['good', 'neutral', 'hard'] as MinimalMood[])
                  .filter((m) => (snapshot.moodCounts[m] ?? 0) > 0)
                  .map((m) => (
                    <span key={m} className={styles.moodChip}>
                      {MOOD_EMOJI[m]} {snapshot.moodCounts[m]}
                    </span>
                  ))}
              </span>
            ) : (
              <span className={styles.snapEmpty}>今天没有记录</span>
            )}
          </div>

          {/* 好奇种子 */}
          <div className={styles.snapItem}>
            <span className={styles.snapLabel}>今日好奇种子</span>
            {snapshot.seedsCount === 0 ? (
              <span className={styles.snapEmpty}>今天没有记录</span>
            ) : (
              <div>
                <span className={styles.snapValue}>{snapshot.seedsCount} 颗</span>
                {snapshot.seedsPreview.length > 0 && (
                  <ul className={styles.seedList}>
                    {snapshot.seedsPreview.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                )}
                {snapshot.seedsExtraCount > 0 && (
                  <span className={styles.snapHint}>
                    还有 {snapshot.seedsExtraCount} 颗
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 卡片 */}
          <div className={styles.snapItem}>
            <span className={styles.snapLabel}>今日卡片</span>
            {snapshot.cardsReviewedToday === 0 ? (
              <span className={styles.snapEmpty}>今天没有记录</span>
            ) : (
              <span className={styles.snapValue}>
                刷了 {snapshot.cardsReviewedToday} 张，其中「会了」{' '}
                {snapshot.cardsMastered} 张
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 4. 元认知自问 */}
      <section className={styles.questions}>
        <h2 className={styles.sectionTitle}>给自己三个小问题</h2>

        {/* 问题一：注意力 */}
        <div className={styles.question}>
          <p className={styles.questionText}>今天学习/做事时，注意力在线吗？</p>
          <div className={styles.chipRow} role="radiogroup" aria-label="注意力">
            {ATTENTION_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={attention === o.value}
                emoji={o.emoji}
                label={o.label}
                onClick={() => setAttention(o.value)}
              />
            ))}
          </div>
          {showAttentionNote && (
            <input
              className={styles.noteInput}
              type="text"
              value={attentionNote}
              onChange={(e) => setAttentionNote(e.target.value)}
              placeholder="可能是什么打断了注意力？写一句就好，不用分析。"
              aria-label="打断注意力的原因（可选）"
            />
          )}
        </div>

        {/* 问题二：方法有效 */}
        <div className={styles.question}>
          <p className={styles.questionText}>今天用的方法有效吗？</p>
          <div className={styles.chipRow} role="radiogroup" aria-label="方法有效">
            {METHOD_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={method === o.value}
                emoji={o.emoji}
                label={o.label}
                onClick={() => setMethod(o.value)}
              />
            ))}
          </div>
          {showMethodNote && (
            <input
              className={styles.noteInput}
              type="text"
              value={methodNote}
              onChange={(e) => setMethodNote(e.target.value)}
              placeholder="明天想调整的一个小地方是什么？只写一个，越小越好。"
              aria-label="明天想调整的地方（可选）"
            />
          )}
        </div>

        {/* 问题三：反例/意外（模型迭代核心，不能省略） */}
        <div className={styles.question}>
          <p className={styles.questionText}>
            今天有没有遇到一个「咦？原来不是这样」的瞬间？
          </p>
          <textarea
            className={styles.surpriseBox}
            value={surprise}
            onChange={(e) => setSurprise(e.target.value)}
            placeholder="不需要是大事，一个反例、一个意外、一个被修正的想法都算。"
            rows={3}
            aria-label="今天的反例或意外（可选）"
          />
          <p className={styles.surpriseHint}>反例不是失败，是模型升级的入口。</p>
        </div>
      </section>

      {/* 5. 保存 */}
      <div className={styles.saveRow}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={savingRef.current}
        >
          记下今天的复盘
        </button>
      </div>

      {/* 今天已复盘的回显提示 */}
      {hasReview && (
        <p className={styles.savedNote}>
          今天已经复盘过了。可以修改，也可以明天再来。
        </p>
      )}

      {/* 保存成功后：默认折叠的「模型迭代日志」区（无数据不显示） */}
      {showPastSection && (
        <section className={styles.pastSection}>
          <button
            type="button"
            className={styles.pastToggle}
            onClick={() => setPastSurpriseOpen((v) => !v)}
            aria-expanded={pastSurpriseOpen}
          >
            <span>模型迭代日志</span>
            <span className={styles.pastCaret} aria-hidden>
              {pastSurpriseOpen ? '▴' : '▾'}
            </span>
          </button>
          {pastSurpriseOpen && (
            <div className={styles.pastBody}>
              <p className={styles.pastSubtitle}>
                你修正过的想法，是你认知升级的证据。
              </p>
              <ul className={styles.pastList}>
                {pastSurprises.map((r: DailyMetaReview) => {
                  const full = r.surprise ?? ''
                  const truncated = full.length > 120
                  const expanded = expandedIds.has(r.id)
                  return (
                    <li key={r.id} className={styles.pastItem}>
                      <span className={styles.pastIcon} aria-hidden>
                        ✦
                      </span>
                      <div className={styles.pastItemBody}>
                        <span className={styles.pastDate}>{r.date}</span>
                        <button
                          type="button"
                          className={`${styles.pastText} ${
                            !expanded && truncated ? styles.pastTextClamp : ''
                          }`}
                          onClick={
                            truncated
                              ? () => toggleItemExpanded(r.id)
                              : undefined
                          }
                          aria-expanded={truncated ? expanded : undefined}
                        >
                          {expanded ? full : truncated ? `${full.slice(0, 120)}…` : full}
                          {truncated &&
                            (expanded ? (
                              <span className={styles.pastExpandHint}>（已展开）</span>
                            ) : (
                              <span className={styles.pastExpandHint}>（点击展开）</span>
                            ))}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* 6. 底部轻量入口 */}
      <div className={styles.footerLinks}>
        <Link to="/today" className={styles.footerLink}>
          回今日页，看看今天的最小行动 →
        </Link>
        {hasPendingCards && (
          <Link to="/concept-cards" className={styles.footerLink}>
            去刷今天的卡片 →
          </Link>
        )}
      </div>
    </div>
  )
}

/** 取今天日期 key（YYYY-MM-DD，本地时区，与 store 的 selectTodayReview 一致） */
function todayKey(): string {
  return toDateKey()
}

/** 是否有情绪分布数据 */
function hasMood(counts: Partial<Record<MinimalMood, number>>): boolean {
  return Object.values(counts).some((n) => (n ?? 0) > 0)
}

/** 单选 chip（柔和色，非评判） */
function Chip({
  active,
  emoji,
  label,
  onClick,
}: {
  active: boolean
  emoji: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={`${styles.chip} ${active ? styles.chipActive : ''}`}
      onClick={onClick}
    >
      <span aria-hidden>{emoji}</span>
      <span>{label}</span>
    </button>
  )
}
