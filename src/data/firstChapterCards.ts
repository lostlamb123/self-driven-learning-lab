/**
 * 第一章概念卡种子
 *
 * 这些卡片用于把「学习是建模、用进废退、成长思维」等核心概念
 * 变成用户自己的认知。新用户首次进入概念卡页面时，若 store 为空，
 * 会自动种下这一批种子；后续用户可继续新增自己的卡片。
 *
 * 约定：
 * - `status` 一律 `new`（从未复习过），`nextReviewAt` 设为今天，
 *   这样首次进入页面即出现在「今日待刷」区。
 * - `id` 用稳定字符串，便于后续「已掌握」状态在多个会话间保持一致。
 */
import type { ChapterConceptCard } from '../types/models'
import { toDateKey } from '../utils/date'

/** 种子 id 前缀，避免与用户自建卡片 id 冲突 */
export const SEED_ID_PREFIX = 'seed-ch1-'

/**
 * 生成稳定种子 id（djb2 hash）。
 * 同一张卡在不同设备/会话里 id 一致，这样「已掌握」状态可以跨会话保留。
 * prefix 可指定章节，默认第一章前缀。
 */
export function seedId(front: string, prefix: string = SEED_ID_PREFIX): string {
  let h = 5381
  for (let i = 0; i < front.length; i++) {
    h = (h * 33) ^ front.charCodeAt(i)
  }
  // 转无符号 32 位，取 16 进制
  return `${prefix}${(h >>> 0).toString(16).padStart(8, '0')}`
}

/** 构建一张种子卡（章节前缀可指定，status / nextReviewAt 初始化规则各章一致） */
export function makeSeedCard(
  seed: {
    front: string
    back: string
    example?: string
    source?: string
  },
  prefix: string = SEED_ID_PREFIX,
): ChapterConceptCard {
  return {
    id: seedId(seed.front, prefix),
    front: seed.front,
    back: seed.back,
    example: seed.example,
    source: seed.source,
    status: 'new',
    reviewCount: 0,
    // 今天即进入待刷，让新用户第一次打开就能看到这批卡
    nextReviewAt: toDateKey(),
    createdAt: new Date().toISOString(),
  }
}

/** 第一章内部别名（保持下方卡片定义写法不变） */
const mkSeed = makeSeedCard

/** 第一章概念卡种子（8 张） */
export const FIRST_CHAPTER_CARDS: ChapterConceptCard[] = [
  mkSeed({
    front: '学习的本质是什么？',
    back: '主动抓取信息 → 提取模式 → 生成心理表征 → 构建模型 → 根据反馈迭代模型。学习不是记住答案，而是建立模型。',
    source: '第一章',
  }),
  mkSeed({
    front: '学得好的标准是什么？',
    back: '不是少犯错、符合标准答案，而是能在不同情境下提取相关模式，把知识迁移到新场景，做出准确归类和判断。',
    source: '第一章',
  }),
  mkSeed({
    front: '知识储存在大脑的哪里？',
    back: '不在单个神经元「之中」，而在神经元「之间」。知识以神经元突触联结的模式存储，提取时是多个脑区协同放电。',
    source: '第一章',
  }),
  mkSeed({
    front: '为什么有效学习不会累坏大脑，无效应试灌输才会？',
    back: '大脑约 1000 亿神经元、100 万亿突触，不存在「被装满」问题。有效学习修剪杂乱联结、建立有序联结；无效灌输让大脑不堪重负。',
    source: '第一章',
  }),
  mkSeed({
    front: '固定思维 vs 成长思维，一句话区别是什么？',
    back: '固定思维：「我天生就不是这块料。」成长思维：「我只是暂时还没找到方法，大脑可以通过练习改变。」',
    source: '第一章',
  }),
  mkSeed({
    front: '专家和新手的核心区别是什么？',
    back: '专家拥有更结构化、层次化的心理表征，能快速识别模式并调用方案；新手依赖表面规则，条件一改就不会。',
    source: '第一章',
  }),
  mkSeed({
    front: '为什么「灌耳音」不是有效学习？',
    back: '没有注意力参与，相应脑区不会反应。大脑学习的关键特征是主动；注意力像聚光灯，光圈外的声音再大也无法开启学习。',
    source: '第一章',
  }),
  mkSeed({
    front: '「丰富模式」是刺激越多越好吗？',
    back: '不是。丰富是可吸收、可互动、可选择、可重复。过多的、不被注意的信息只是噪声干扰。',
    source: '第一章',
  }),
]
