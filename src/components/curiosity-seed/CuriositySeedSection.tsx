/**
 * 今日好奇种子 —— 模块组件
 *
 * 定位：不要求完成、不要求打卡、不设目标、不做进度条、不提醒。
 * 只有一个输入框，把「咦？为什么会这样？」的瞬间种下来。
 *
 * 与「今日最小行动」完全解耦：独立 store（useCuriositySeedStore）、
 * 独立持久化 key（sdl_curiosity_seeds），不共享任何完成逻辑。
 *
 * 今日种子列表：最多显示 5 条，超出显示「还有 N 颗种子」可展开；
 * 只支持删除，不支持编辑。空状态用正向、非压力文案。
 */
import { useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  useCuriositySeedStore,
  selectTodaySeeds,
} from '../../stores/curiositySeedStore'
import styles from './CuriositySeed.module.css'

/** 标题文案 */
const TITLE = '今天有没有一个「咦？为什么会这样？」的瞬间？'
/** 输入框 placeholder */
const INPUT_PLACEHOLDER = '不需要解决，不需要查资料，只是种下来。'
/** 输入框下方小字 */
const FOOTER_NOTE = '它不会催你，它只是在这里。'
/** 列表默认最多显示条数，超出折叠 */
const SEEDS_VISIBLE_LIMIT = 5

export default function CuriositySeedSection() {
  const addSeed = useCuriositySeedStore((s) => s.addSeed)
  const removeSeed = useCuriositySeedStore((s) => s.removeSeed)
  /** useShallow：派生数组每次是新引用，浅比较避免无限渲染 */
  const todaySeeds = useCuriositySeedStore(useShallow(selectTodaySeeds))

  const [draft, setDraft] = useState('')
  /** 是否展开查看全部种子（默认收起，最多显示 5 条） */
  const [showAll, setShowAll] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    addSeed(text)
    setDraft('')
  }

  const extraCount = todaySeeds.length - SEEDS_VISIBLE_LIMIT
  const visibleSeeds = showAll ? todaySeeds : todaySeeds.slice(0, SEEDS_VISIBLE_LIMIT)

  return (
    <section className={styles.section}>
      {/* 模块标题 */}
      <h2 className={styles.title}>{TITLE}</h2>

      {/* 种下入口 */}
      <form
        onSubmit={handleSubmit}
        className={styles.form}
        aria-label="种下好奇种子"
      >
        <input
          type="text"
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={INPUT_PLACEHOLDER}
          aria-label="好奇种子"
          autoComplete="off"
        />
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={!draft.trim()}
        >
          种下
        </button>
      </form>
      <p className={styles.footerNote}>{FOOTER_NOTE}</p>

      {/* 今日已种下的种子（只读、轻量、可删除，不做任何进度/目标） */}
      {todaySeeds.length === 0 ? (
        <p className={styles.empty}>
          今天还没有种下种子。好奇心的种子不用很多，一颗也够。
        </p>
      ) : (
        <div>
          <ul className={styles.seedList} aria-label="今天种下的种子">
            {visibleSeeds.map((seed) => (
              <li key={seed.id} className={styles.seedItem}>
                <span className={styles.seedEmoji} aria-hidden>
                  ✿
                </span>
                <span className={styles.seedText}>{seed.text}</span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeSeed(seed.id)}
                  aria-label="移除这颗种子"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {/* 超出 5 条时，显示可展开的折叠提示 */}
          {extraCount > 0 && !showAll && (
            <button
              type="button"
              className={styles.expandBtn}
              onClick={() => setShowAll(true)}
            >
              还有 {extraCount} 颗种子，点开展开
            </button>
          )}

          {/* 已展开时，提供收起 */}
          {extraCount > 0 && showAll && (
            <button
              type="button"
              className={styles.expandBtn}
              onClick={() => setShowAll(false)}
            >
              收起
            </button>
          )}
        </div>
      )}
    </section>
  )
}
