/**
 * 第二章《内驱的学习者》概念卡种子
 *
 * 与第一章共用同一套数据结构、id 生成规则（`seed-ch2-` + front 文本 djb2 hash）
 * 与初始化逻辑（status=new、nextReviewAt=今天、reviewCount=0）。
 *
 * 这些卡把第二章的核心认知——内控/外控、喜欢与擅长的因果、自我效能感、
 * 最小行动的证据作用、「你必须」vs「我想要」、自由玩耍的价值——变成可主动提取的卡。
 *
 * 新卡会以「今天待刷」加入队列；已存在的用户卡片数据不会被修改。
 */
import type { ChapterConceptCard } from '../types/models'
import { makeSeedCard } from './firstChapterCards'

/** 第二章种子 id 前缀（与第一章区分，避免 id 冲突） */
export const SEED_ID_PREFIX_CH2 = 'seed-ch2-'

/** 第二章概念卡种子（6 张） */
export const SECOND_CHAPTER_CARDS: ChapterConceptCard[] = [
  makeSeedCard(
    {
      front: '内控者和外控者的核心区别是什么？',
      back: '内控者相信「我的行动能改变结果」，像驾驶员；外控者认为「结果由环境、运气、别人决定」，像乘客。面对同一件难事，驾驶员会搜集信息、提前规划、持续努力，乘客则等待运气、寻找借口。',
      source: '第二章',
    },
    SEED_ID_PREFIX_CH2,
  ),
  makeSeedCard(
    {
      front: '为什么说「喜欢」常常是「擅长」的结果，而不是原因？',
      back: '人先有点擅长某事，更容易获得成就感，不断得到正反馈，才会感觉喜欢，于是做得更多，变得更熟练，形成正反馈闭环。所以不要等「先喜欢」再努力，可以先从「做出一小点成果」开始。',
      source: '第二章',
    },
    SEED_ID_PREFIX_CH2,
  ),
  makeSeedCard(
    {
      front: '什么是自我效能感？它从哪里来？',
      back: '自我效能感是「我相信我的行为能产生预期结果」。它来自一次次「我做到了」的成功经验，尤其是从最小行动开始、完成后被看见、被肯定的经验。',
      source: '第二章',
    },
    SEED_ID_PREFIX_CH2,
  ),
  makeSeedCard(
    {
      front: '为什么「最小行动 + 每日记录」能改变外控型心态？',
      back: '外控者不相信每日持续的小行动能带来真实改变。最小行动把目标拆到足够小、可完成，每日记录把「我做到了」变成可见证据，持续积累自我效能感，逐渐把外控转为内控。',
      source: '第二章',
    },
    SEED_ID_PREFIX_CH2,
  ),
  makeSeedCard(
    {
      front: '「你必须」和「我想要」的区别为什么重要？',
      back: '强迫式灌输即使短期见效，也会压抑学习者的「自我」，破坏内在动机。把「你必须」变成「我想要」，让学习者自己发现目标、界定问题、为决定负责，才能形成内驱。',
      source: '第二章',
    },
    SEED_ID_PREFIX_CH2,
  ),
  makeSeedCard(
    {
      front: '自由玩耍为什么是「正经事」？',
      back: '自由玩耍发展社会智能、情绪调节、前额叶执行功能和创造性。长期剥夺自由玩耍，可能压抑探索本能，导致多动、拖延、倦怠和社恐风险。玩耍不是「没用」，是大脑必需的生长营养。',
      source: '第二章',
    },
    SEED_ID_PREFIX_CH2,
  ),
]
