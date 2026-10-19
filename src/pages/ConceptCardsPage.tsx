/**
 * 概念卡片页 —— 路由 /concept-cards
 *
 * 定位：内化第一章核心概念的轻量工具。看正面主动回想，翻背面核对，
 * 标记「会了 / 再刷 / 不会」，用主动提取 + 间隔重复把概念变成自己的认知。
 *
 * 页面结构（自上而下）：
 * 1. 标题「概念卡片」+ 副标题「看正面，先自己想；翻背面，核对并标记。」
 *    + 常驻说明小字「大脑的联结需要反复放电才能稳固……」
 * 2. 今日待刷卡片区：显示今天需复习的卡（new 或 review 且 nextReviewAt<=今天），最多 5 张
 * 3. 每张卡：默认只显示正面 → 点「翻面」显示背面 + 例子 + 来源 → 出现三个标记按钮
 * 4. 空状态：「今天的卡片已经刷完了。明天再来，让联结再亮一次。」
 * 5. 底部：「已掌握 N / 总卡片 M」
 *
 * 核心：主动提取 —— 正面必须让用户先自己想，不能一上来就显示答案。
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../store/appStore'
import {
  useConceptCardStore,
  selectTodayCards,
  selectMasteredCount,
  selectTotalCount,
  type ReviewResult,
} from '../stores/conceptCardStore'
import type { ChapterConceptCard } from '../types/models'
import styles from './ConceptCardsPage.module.css'

/** 今日待刷区最多显示的卡片数（对应"每天刷 3—5 张"） */
const DAILY_REVIEW_LIMIT = 5

/** 标题 / 副标题 */
const TITLE = '概念卡片'
const SUBTITLE = '看正面，先自己想；翻背面，核对并标记。'

/** 副标题下方的常驻说明小字：解释「为什么要一次又一次来见同一张卡」 */
const SUBTITLE_NOTE =
  '大脑的联结需要反复放电才能稳固——这是人类用可塑性换高上限的代价。'

/** 空状态文案（正向、非压力） */
const EMPTY_COPY = '今天的卡片已经刷完了。明天再来，让联结再亮一次。'

/** 三个标记按钮的定义（emoji + 文案 + 对应结果） */
const MARK_OPTIONS: {
  result: ReviewResult
  emoji: string
  label: string
}[] = [
  { result: 'good', emoji: '😊', label: '会了' },
  { result: 'again', emoji: '😐', label: '再刷' },
  { result: 'hard', emoji: '😣', label: '不会' },
]

/** 标记后的一句话轻提示（正向、具体、非评判） */
const MARK_FEEDBACK: Record<ReviewResult, string> = {
  good: '这张卡会在一周后再见一次。',
  again: '明天再见一次。',
  hard: '没关系，今天再刷一次就好。',
}

/** 各标记按钮对应的 CSS 类（颜色柔和，不用红色警告色） */
const markCls: Record<ReviewResult, string> = {
  good: styles.markGood,
  again: styles.markAgain,
  hard: styles.markHard,
}

export default function ConceptCardsPage() {
  const notify = useAppStore((s) => s.notify)

  const ensureSeeded = useConceptCardStore((s) => s.ensureSeeded)
  const reviewCard = useConceptCardStore((s) => s.reviewCard)
  /** useShallow：派生数组每次是新引用，浅比较避免无限渲染 */
  const todayCards = useConceptCardStore(
    useShallow((s) => selectTodayCards(s)),
  )
  const masteredCount = useConceptCardStore(selectMasteredCount)
  const totalCount = useConceptCardStore(selectTotalCount)

  /** 本会话已刷掉的卡 id（标记后从今日区移除，用本地集合跟踪） */
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
  /** 正在翻面的卡 id */
  const [flippedId, setFlippedId] = useState<string | null>(null)

  // 首次进入：若 store 为空则种下第一章种子
  useEffect(() => {
    ensureSeeded()
  }, [ensureSeeded])

  /** 今日待刷区：排除本会话已标记的卡，最多 DAILY_REVIEW_LIMIT 张 */
  const visibleCards = useMemo(
    () =>
      todayCards
        .filter((c) => !reviewedIds.has(c.id))
        .slice(0, DAILY_REVIEW_LIMIT),
    [todayCards, reviewedIds],
  )

  /** 标记当前翻开的卡 */
  function handleMark(card: ChapterConceptCard, result: ReviewResult) {
    reviewCard(card.id, result)
    setReviewedIds((prev) => new Set(prev).add(card.id))
    setFlippedId(null)
    // 轻提示：用全局 toast，卡片从今日区移除
    notify('success', MARK_FEEDBACK[result], 4000)
  }

  /** 费曼输出深链：把卡片正面编码进 ?concept=，卡片 id 记入 ?cardId= */
  function feynmanLink(card: ChapterConceptCard): string {
    return `/output?tab=feynman&concept=${encodeURIComponent(card.front)}&cardId=${encodeURIComponent(
      card.id,
    )}`
  }

  return (
    <div className={styles.page}>
      {/* 1. 标题 + 2. 副标题（+ 常驻说明小字） */}
      <header className={styles.header}>
        <h1 className={styles.title}>{TITLE}</h1>
        <p className={styles.subtitle}>{SUBTITLE}</p>
        <p className={styles.subtitleNote}>{SUBTITLE_NOTE}</p>
      </header>

      {/* 3. 今日待刷卡片区 */}
      {visibleCards.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden>
            ✿
          </span>
          <p>{EMPTY_COPY}</p>
          {/* 空态下方的轻入口：非催促 */}
          <Link to="/today" className={styles.emptyLink}>
            回今日页，看看今天的最小行动 →
          </Link>
        </div>
      ) : (
        <div className={styles.cardList}>
          {visibleCards.map((card) => (
            <ReviewCard
              key={card.id}
              card={card}
              flipped={flippedId === card.id}
              onFlip={() =>
                setFlippedId((cur) => (cur === card.id ? null : card.id))
              }
              onMark={(result) => handleMark(card, result)}
              feynmanUrl={feynmanLink(card)}
            />
          ))}
          {todayCards.length > DAILY_REVIEW_LIMIT && (
            <p className={styles.moreHint}>
              还有 {todayCards.length - DAILY_REVIEW_LIMIT} 张卡稍后再刷，今天先做这几张。
            </p>
          )}
        </div>
      )}

      {/* 5. 底部：已掌握 / 总卡片 */}
      <footer className={styles.footer}>
        已掌握 <span className={styles.footerNum}>{masteredCount}</span>
        <span className={styles.footerSep}> / </span>
        总卡片 <span className={styles.footerNum}>{totalCount}</span>
      </footer>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 单张复习卡（正面 → 翻面 → 标记）                                            */
/* -------------------------------------------------------------------------- */

function ReviewCard({
  card,
  flipped,
  onFlip,
  onMark,
  feynmanUrl,
}: {
  card: ChapterConceptCard
  flipped: boolean
  onFlip: () => void
  onMark: (result: ReviewResult) => void
  /** 费曼输出深链（翻面后在标记按钮下方显示） */
  feynmanUrl: string
}) {
  return (
    <div className={styles.card}>
      {/* 卡头：正面文字 + 翻面按钮 */}
      <div className={styles.cardTop}>
        <div className={styles.front}>
          <span className={styles.cardSideLabel}>正面</span>
          <p className={styles.frontText}>{card.front}</p>
        </div>
        <button
          type="button"
          className={styles.flipBtn}
          onClick={onFlip}
          aria-expanded={flipped}
          aria-label={flipped ? '收起背面' : '翻面显示答案'}
        >
          {flipped ? '收起' : '翻面'}
        </button>
      </div>

      {/* 背面：仅在翻面后显示（主动提取核心 —— 不翻不显示答案） */}
      {flipped && (
        <div className={styles.back}>
          <span className={styles.cardSideLabelBack}>背面</span>
          <p className={styles.backText}>{card.back}</p>
          {card.example && (
            <div className={styles.extraRow}>
              <span className={styles.extraLabel}>例子</span>
              <span className={styles.extraText}>{card.example}</span>
            </div>
          )}
          {card.source && (
            <div className={styles.extraRow}>
              <span className={styles.extraLabel}>来源</span>
              <span className={styles.extraText}>{card.source}</span>
            </div>
          )}

          {/* 三个标记按钮（翻面后才出现） */}
          <div className={styles.markRow}>
            {MARK_OPTIONS.map((o) => (
              <button
                key={o.result}
                type="button"
                className={`${styles.markBtn} ${markCls[o.result]}`}
                onClick={() => onMark(o.result)}
              >
                <span className={styles.markEmoji} aria-hidden>
                  {o.emoji}
                </span>
                <span>{o.label}</span>
              </button>
            ))}
          </div>

          {/* 费曼输出入口（标记按钮下方一行小字链接，非催促） */}
          <Link to={feynmanUrl} className={styles.feynmanLink}>
            用费曼法讲一遍 →
          </Link>
        </div>
      )}
    </div>
  )
}
