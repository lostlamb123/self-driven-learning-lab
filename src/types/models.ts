/**
 * Self-Driven Learning Lab —— 应用数据模型
 *
 * 这里的类型同时承担两个职责：
 * 1. 运行时状态的结构定义（store / 页面共享）
 * 2. 本地持久化与 JSON 导出的「序列化契约」
 *
 * 约定：
 * - 所有实体都带 `id`（字符串）、`createdAt` / `updatedAt`（ISO 8601 字符串），
 *   避免 Date 对象在 JSON 往返时丢失类型。
 * - 可选字段用 `?` 明确表达，不使用 `undefined` 占位值。
 * - 枚举一律用字符串联合类型，方便直接存进 localStorage 并保持可读。
 */

/** 持久化数据结构版本号。结构发生不兼容变更时必须递增，并在 persistence 中处理迁移。 */
export const SCHEMA_VERSION = 1

/** ISO 8601 时间字符串，例如 "2026-10-18T10:00:00.000Z" */
export type ISODateString = string

/** 本地日期字符串，格式 YYYY-MM-DD，用于按天聚合（避免时区漂移） */
export type DateKey = string

/** 所有持久化实体的公共字段 */
export interface BaseEntity {
  id: string
  createdAt: ISODateString
  updatedAt: ISODateString
}

/* -------------------------------------------------------------------------- */
/* 学习者画像                                                                  */
/* -------------------------------------------------------------------------- */

/** 学习风格倾向，用于调节每日行动的难度与形式 */
export type LearningStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'mixed'

/** 每天可用于学习的时段偏好 */
export type TimePreference = 'morning' | 'afternoon' | 'evening' | 'night'

/** 学习者画像：全局唯一，指导目标拆解与内容推荐 */
export interface LearnerProfile {
  /** 用户自述或系统生成的昵称 */
  displayName: string
  /** 长期想成为什么样的人 / 想解决什么问题，一句话 */
  aspiration: string
  /** 当前主要关注的领域标签，例如 ["认知科学", "写作"] */
  domains: string[]
  /** 每天可投入的学习分钟数，用于约束每日行动总量 */
  dailyMinutes: number
  /** 学习风格倾向 */
  learningStyle: LearningStyle
  /** 偏好的学习时段 */
  preferredTime: TimePreference
  /** 自评当前水平 1-5，用于控制阅读材料难度 */
  selfRatedLevel: number
  /** 已知的薄弱点 / 需要刻意练习的方面 */
  weaknesses: string[]
  /** 上次画像更新时间 */
  updatedAt: ISODateString
}

/* -------------------------------------------------------------------------- */
/* 目标                                                                        */
/* -------------------------------------------------------------------------- */

export type GoalStatus = 'active' | 'paused' | 'achieved' | 'archived'

/** 目标层级：长期愿景 -> 阶段目标 -> 周目标 */
export type GoalHorizon = 'long' | 'stage' | 'week'

/** 目标：所有每日行动都应挂到某个目标上，保证行动有意义 */
export interface Goal extends BaseEntity {
  title: string
  /** 为什么想达成这个目标，用于自驱力回顾 */
  motivation: string
  horizon: GoalHorizon
  status: GoalStatus
  /** 目标截止日期（YYYY-MM-DD），长期目标可为空 */
  dueDate?: DateKey
  /** 父目标 id，用于构建目标树 */
  parentId?: string
  /** 可量化的完成标准，例如 "写完 3 篇 1500 字读书笔记" */
  successCriteria: string[]
  /** 完成度 0-100，由子目标与行动自动汇总或手动维护 */
  progress: number
}

/* -------------------------------------------------------------------------- */
/* 每日行动                                                                    */
/* -------------------------------------------------------------------------- */

export type ActionType = 'read' | 'note' | 'concept' | 'write' | 'review' | 'practice'

export type ActionStatus = 'todo' | 'doing' | 'done' | 'skipped'

/** 每日行动：最小执行单元，一天内的待办清单 */
export interface DailyAction extends BaseEntity {
  /** 归属日期（YYYY-MM-DD） */
  date: DateKey
  /** 所属目标 id */
  goalId?: string
  title: string
  /** 行动类型，决定完成面板的填写形式 */
  type: ActionType
  status: ActionStatus
  /** 预计耗时（分钟） */
  estimatedMinutes: number
  /** 实际耗时（分钟），完成后填写 */
  actualMinutes?: number
  /** 排序权重，数字越小越靠前 */
  order: number
  /** 完成后的一句话收获 */
  takeaway?: string
}

/* -------------------------------------------------------------------------- */
/* 概念卡片                                                                    */
/* -------------------------------------------------------------------------- */

/** 概念掌握程度：未知 -> 有印象 -> 能解释 -> 能应用 */
export type ConceptMastery = 'unknown' | 'familiar' | 'explainable' | 'applicable'

/** 概念卡片：用于间隔复习的最小知识单元 */
export interface ConceptCard extends BaseEntity {
  /** 卡片类型 */
  type: ConceptCardType
  /** 概念名称，例如 "刻意练习" */
  term: string
  /** 用自己的话下的定义 */
  definition: string
  /** 为什么重要 / 用在哪里 */
  whyItMatters: string
  /** 例子 */
  examples: string[]
  /** 易混淆的相近概念 */
  confusions: string[]
  /** 来源笔记 id 列表 */
  sourceNoteIds: string[]
  /** 标签，便于横向串联 */
  tags: string[]
  mastery: ConceptMastery
  /** 复习次数（答对且成功通过间隔的累计） */
  reviewCount: number
  /** 下次复习日期（YYYY-MM-DD），配合间隔重复算法维护 */
  nextReviewAt?: DateKey
  /** 上次复习日期（YYYY-MM-DD），用于"今日已复习"统计 */
  lastReviewedAt?: DateKey
}

/* -------------------------------------------------------------------------- */
/* 阅读笔记                                                                    */
/* -------------------------------------------------------------------------- */

export type NoteKind = 'book' | 'article' | 'paper' | 'course' | 'video'

/** 三级笔记：手动维护，MVP 阶段不做自动抽取 */
export interface ThreeLevelNote {
  /** 一级：核心概念 / 主旨（从第一步关键词中选） */
  level1: string[]
  /** 二级：衍生概念、定义、逻辑展开 */
  level2: string[]
  /** 三级：具体例子、证据、数据（从第三/四步中提取） */
  level3: string[]
}

/** 阅读笔记：一次阅读的产出，可提炼出概念卡片与写作素材 */
export interface ReadingNote extends BaseEntity {
  kind: NoteKind
  title: string
  author?: string
  /** 原文链接 */
  sourceUrl?: string
  /** 阅读起止日期 */
  startedAt?: DateKey
  finishedAt?: DateKey
  /** 原文摘录，保留原始表述 */
  highlights: string[]
  /** 自己的理解与批注 */
  reflections: string[]
  /** 由此笔记提炼出的概念卡片 id */
  conceptIds: string[]
  tags: string[]

  /* 阅读理解五步法（均为可选，旧数据缺省时 normalize 回填） */
  /** 第一步：关键词列表 */
  keywords?: string[]
  /** 第二步：关键词链与核心对立项（自由文本） */
  keywordChain?: string
  /** 第三步：费曼总结（用自己的话） */
  feynman?: string
  /** 第三步：是否已确认"用的是自己的话" */
  feynmanOwnWords?: boolean
  /** 第四步：费曼×3（多次提炼 / 深层关联 / 前提与结论检查） */
  feynmanDeepen?: string
  /** 第五步：提出的新问题（可多个） */
  newQuestions?: string[]
  /** 三级笔记（手动增删节点） */
  threeLevel?: ThreeLevelNote
}

/* -------------------------------------------------------------------------- */
/* 写作大纲                                                                    */
/* -------------------------------------------------------------------------- */

export type OutlineStatus = 'drafting' | 'structured' | 'writing' | 'done'

/** 写作文体：说明 / 记叙 / 论证 */
export type OutlineGenre = 'expository' | 'narrative' | 'argumentative'

/** 文体对应的中文显示名 */
export const OUTLINE_GENRE_LABEL: Record<OutlineGenre, string> = {
  expository: '说明文',
  narrative: '记叙文',
  argumentative: '议论文',
}

/** 写作大纲的一个段落节点 */
export interface OutlineSection {
  id: string
  /** 层级，0 为一级标题 */
  level: number
  /** 小标题 */
  heading: string
  /** 该段要表达的核心论点 */
  thesis: string
  /** 支撑材料，通常引用 ReadingNote 摘录 / ConceptCard / CriticalCase 的 id */
  evidenceIds: string[]
  /** 计划字数 */
  targetWords?: number
  /** 是否已完成初稿 */
  drafted: boolean
}

/** 写作大纲：把零散笔记组织成有说服力的表达 */
export interface WritingOutline extends BaseEntity {
  title: string
  /** 文体，影响模板提示；旧数据缺失时按说明文处理 */
  genre?: OutlineGenre
  /** 这篇写作想说服谁、说服什么 */
  intent: string
  /** 目标读者 */
  audience: string
  status: OutlineStatus
  sections: OutlineSection[]
  /** 关联的阅读笔记 id */
  noteIds: string[]
  /** 关联的概念卡片 id */
  conceptIds: string[]
  /** 计划总字数 */
  targetWords?: number
}

/* -------------------------------------------------------------------------- */
/* 批判性案例                                                                  */
/* -------------------------------------------------------------------------- */

/** 案例类型：理论反例、现实事件、他人观点等 */
export type CaseKind = 'counterexample' | 'real-world' | 'opinion' | 'analogy'

/** 立场判断：这个案例支持还是挑战当前观点 */
export type CaseStance = 'support' | 'challenge' | 'neutral'

/** 立场对应的中文显示名 */
export const CASE_STANCE_LABEL: Record<CaseStance, string> = {
  support: '支持',
  challenge: '反对',
  neutral: '中立',
}

/**
 * 常见认知偏差预设清单。
 * 模型的 `biases` 是自由字符串数组（无独立枚举类型），
 * 这里提供一组常用选项供多选，用户也可通过"其他"自行补充。
 */
export const COMMON_BIASES = [
  '确认偏误',
  '可得性偏误',
  '锚定效应',
  '幸存者偏差',
  '沉没成本谬误',
  '从众效应',
  '权威偏误',
  '后见之明偏误',
  '以偏概全',
  '非黑即白',
] as const

/** 批判性案例：用于训练「质疑—检验—修正」的思维动作 */
export interface CriticalCase extends BaseEntity {
  title: string
  kind: CaseKind
  /** 案例事实描述 */
  description: string
  /** 它质疑或支持的原始观点 */
  targetClaim: string
  stance: CaseStance
  /** 反驳或支持的理由链 */
  reasoning: string[]
  /** 该案例暴露出的认知偏差 */
  biases: string[]
  /** 由案例引发的修正后观点 */
  revisedClaim?: string
  /** 关联的概念卡片 */
  conceptIds: string[]

  /* 三阶段流程补充字段（均可选，旧数据缺失时按空处理） */
  /** 引用的阅读笔记 id（阶段二搜集证据） */
  noteIds?: string[]
  /** 阶段二：搜集到的反例与证据 */
  evidence?: string
  /** 阶段二：前提与推论检查 */
  premiseCheck?: string
  /** 阶段三：修正后的理由 */
  revisedReason?: string
  /** 阶段三：下一步行动 */
  nextAction?: string
}

/* -------------------------------------------------------------------------- */
/* 每日复盘                                                                    */
/* -------------------------------------------------------------------------- */

/** 自驱力评分维度 */
export interface ReviewScores {
  /** 专注度 1-5 */
  focus: number
  /** 完成度 1-5 */
  completion: number
  /** 好奇心 1-5，是否有主动延伸 */
  curiosity: number
  /** 精力状态 1-5 */
  energy: number
}

/** 每日复盘：一天的闭环，驱动第二天的行动 */
export interface DailyReview extends BaseEntity {
  date: DateKey
  /** 今天实际做了什么 */
  done: string[]
  /** 遇到的阻碍 */
  blockers: string[]
  /** 学到的最重要的一件事 */
  insight: string
  scores: ReviewScores
  /** 明天要调整的一件事 */
  nextAdjustment?: string
  /** 当天完成行动 id 列表，便于与 DailyAction 交叉校验 */
  actionIds: string[]
}

/* -------------------------------------------------------------------------- */
/* 反馈日志                                                                    */
/* -------------------------------------------------------------------------- */

export type FeedbackSource = 'self' | 'ai' | 'mentor' | 'peer'

export type FeedbackSentiment = 'positive' | 'neutral' | 'negative'

/** 反馈日志：所有外部/自我反馈的存档，用于观察成长轨迹 */
export interface FeedbackLog extends BaseEntity {
  /** 反馈针对的对象类型 */
  targetType: 'goal' | 'action' | 'note' | 'concept' | 'outline' | 'case' | 'review' | 'profile'
  /** 对象 id；针对画像时可为空 */
  targetId?: string
  source: FeedbackSource
  /** 反馈正文 */
  content: string
  sentiment: FeedbackSentiment
  /** 基于反馈采取的下一步动作 */
  followUp?: string
  /** 是否已处理 */
  resolved: boolean
}

/* -------------------------------------------------------------------------- */
/* 设置                                                                        */
/* -------------------------------------------------------------------------- */

export type ThemeMode = 'light' | 'dark' | 'system'

/** 卡片类型：中文识字 / 英文句素 / 学科概念 */
export type ConceptCardType = 'hanzi' | 'english' | 'subject'

/** 卡片类型对应的中文显示名 */
export const CONCEPT_CARD_TYPE_LABEL: Record<ConceptCardType, string> = {
  hanzi: '中文识字',
  english: '英文句素',
  subject: '学科概念',
}

/** 应用设置 */
export interface Settings {
  theme: ThemeMode
  /** 界面语言，预留 */
  language: 'zh-CN' | 'en'
  /** 每日目标行动数量上限，防止过载 */
  dailyActionLimit: number
  /** 每日卡片复习数量上限（复习区一次最多翻多少张） */
  dailyCardLimit?: number
  /** 概念卡片的复习间隔（天），对应每次复习后的递推序列 */
  reviewIntervals: number[]
  /** 每日提醒时间，格式 HH:mm，空表示不提醒 */
  reminderTime?: string
  /** 是否在完成行动后自动弹出复盘提示 */
  autoPromptReview: boolean
}

/* -------------------------------------------------------------------------- */
/* 应用根数据                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 持久化根对象。
 *
 * `version` 与 `SCHEMA_VERSION` 对应，导入时用于校验兼容性；
 * 其余字段即 localStorage 中 `sdlab:v1` 的完整内容。
 */
export interface AppData {
  version: number
  profile: LearnerProfile
  goals: Goal[]
  actions: DailyAction[]
  concepts: ConceptCard[]
  notes: ReadingNote[]
  outlines: WritingOutline[]
  cases: CriticalCase[]
  reviews: DailyReview[]
  feedback: FeedbackLog[]
  settings: Settings
  /** 上次写入时间，用于展示与冲突判断 */
  savedAt: ISODateString
}

/** 空数据工厂：新用户首次进入时的初始状态 */
export function createEmptyAppData(): AppData {
  const now = new Date().toISOString()
  return {
    version: SCHEMA_VERSION,
    profile: {
      displayName: '',
      aspiration: '',
      domains: [],
      dailyMinutes: 30,
      learningStyle: 'mixed',
      preferredTime: 'evening',
      selfRatedLevel: 3,
      weaknesses: [],
      updatedAt: now,
    },
    goals: [],
    actions: [],
    concepts: [],
    notes: [],
    outlines: [],
    cases: [],
    reviews: [],
    feedback: [],
    settings: {
      theme: 'system',
      language: 'zh-CN',
      dailyActionLimit: 3,
      dailyCardLimit: 5,
      reviewIntervals: [1, 3, 7, 15, 30],
      autoPromptReview: true,
    },
    savedAt: now,
  }
}
