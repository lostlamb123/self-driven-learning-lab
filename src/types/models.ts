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
/* 今日最小行动（自我效能感积累）                                                */
/* -------------------------------------------------------------------------- */

/**
 * 行动类型标签：每个标签对应一个可追溯的认知科学原理。
 * 界面上以 chip 呈现，选中时显示一句「原理短句」标签。
 */
export type MinimalActionTag =
  | 'curiosity' // 🌱 好奇探索
  | 'proximity' // 🎯 最近学习区
  | 'output' // ✍️ 主动输出
  | 'pattern' // 🧩 模式提取
  | 'habit' // 🔁 习惯巩固

/** 标签对应的中文显示名（含 emoji），用于 chip 与卡片渲染 */
export const MINIMAL_TAG_LABEL: Record<MinimalActionTag, string> = {
  curiosity: '🌱 好奇探索',
  proximity: '🎯 最近学习区',
  output: '✍️ 主动输出',
  pattern: '🧩 模式提取',
  habit: '🔁 习惯巩固',
}

/** 标签对应的原理短句：选中该标签时显示在旁，让每个功能可追溯到原理 */
export const MINIMAL_TAG_PRINCIPLE: Record<MinimalActionTag, string> = {
  curiosity: '好奇心驱动下，大脑主动检索并深化联结。',
  proximity: '踮脚够得着，是最有效的难度。',
  output: '输出倒逼组织，是理解的最短路径。',
  pattern: '从具体到抽象，模式比细节更耐用。',
  habit: '降低启动成本，让重复成为默认路径。',
}

/** 难度自评：用于调节「难度」维度，不评判，只记录 */
export type MinimalDifficulty = 'easy' | 'just' | 'hard'

export const MINIMAL_DIFFICULTY_LABEL: Record<MinimalDifficulty, string> = {
  easy: '太简单',
  just: '刚好',
  hard: '有点难',
}

/** 完成后记录的情绪：供后续复盘模块读取 */
export type MinimalMood = 'good' | 'neutral' | 'hard'

/** 情绪按钮的 emoji 图标（用于卡片 / 选择器渲染） */
export const MINIMAL_MOOD_EMOJI: Record<MinimalMood, string> = {
  good: '😊',
  neutral: '😐',
  hard: '😣',
}

/** 情绪按钮的描述文案（emoji 单独用 MINIMAL_MOOD_EMOJI） */
export const MINIMAL_MOOD_TEXT: Record<MinimalMood, string> = {
  good: '有成就感，我还想再来一次',
  neutral: '做完了，平平',
  hard: '有点难，但我还是做到了',
}

/** 不同情绪选择后的即时回应（正向、具体、非评判） */
export const MINIMAL_MOOD_RESPONSE: Record<MinimalMood, string> = {
  good: '记下这种感觉，它就是明天继续的最小燃料。',
  neutral: '完成本身就是胜利。明天可以试试把行动再拆小一点，或者换一个你更想做的素材。',
  hard: '“有点难但我做到了”，这正是最近学习区的信号。你刚刚在大脑里修了一条新路。',
}

/** 今日最小行动：小到不会逃避的最小单元，完成后记录情绪积累自我效能感 */
export interface MinimalAction {
  id: string
  /** 行动文本（用户填写的最小行动描述） */
  text: string
  /** 选中的类型标签（可多个） */
  tags: MinimalActionTag[]
  /** 难度自评（可选，默认不选） */
  difficulty?: MinimalDifficulty
  /** 完成状态：待完成 / 已完成 */
  status: 'pending' | 'done'
  /** 完成时记录的情绪（可选） */
  mood?: MinimalMood
  /** 创建时间（ISO 8601） */
  createdAt: ISODateString
  /** 完成时间（ISO 8601），未完成时为空 */
  completedAt?: ISODateString
}

/**
 * 「第一章原理金句」轮播数组。
 * 今日最小行动卡每次渲染随机取一条，作为可追溯的认知科学原理标签。
 */
export const MINIMAL_ACTION_PRINCIPLES = [
  '学习不是记住答案，而是建立模型。',
  '大脑用进废退：用脑越多，联结越有序。',
  '越焦虑，越难学进去。',
  '学得好，不是少犯错，而是能迁移。',
  '知识存储在神经元之间，不在单个神经元里。',
  '丰富不是刺激多，是可吸收、可互动、可选择。',
] as const

/* -------------------------------------------------------------------------- */
/* 今日好奇种子（探索欲 · 不设目标 / 不打卡 / 不催促）                          */
/* -------------------------------------------------------------------------- */

/**
 * 好奇种子：一个「咦？为什么会这样？」的瞬间。
 * 不要求解决、不要求打卡、不设数量目标，只要求「种下来」——
 * 防止好奇心在「必须有用」的压力下被扼杀。
 */
export interface CuriositySeed {
  id: string
  /** 种子的内容（那个「咦？」的瞬间，自由文本） */
  text: string
  /** 种下时间（ISO 8601） */
  createdAt: ISODateString
}

/* -------------------------------------------------------------------------- */
/* 第一章概念卡（主动提取 + 间隔重复，独立的轻量模块）                          */
/* -------------------------------------------------------------------------- */

/**
 * 概念卡片的掌握状态：
 * - new：刚种下，从未复习过
 * - review：进入间隔重复序列，等待下次复习
 * - mastered：用户标记「会了」，进入长期记忆（7 天后不再主动打扰，但保留记录）
 *
 * 注意：这里的 `ConceptCardStatus` 与上方 `ConceptCard`（间隔复习工具卡）是两套
 * 独立体系，互不共享字段；为避免命名冲突，本模块类型统一用 `ChapterConceptCard`
 * 前缀，对应「第一章核心概念」的种子卡 + 用户后续新增的概念卡。
 */
export type ConceptCardStatus = 'new' | 'review' | 'mastered'

/** 第一章概念卡：内化核心认知的轻量卡片，正面主动回想，翻背面核对 */
export interface ChapterConceptCard {
  id: string
  /** 正面：问题或概念，要求用户先主动回想 */
  front: string
  /** 背面：答案或解释 */
  back: string
  /** 可选：一个具体例子 */
  example?: string
  /** 可选：来自哪一章 / 哪本书 */
  source?: string
  /** 掌握状态 */
  status: ConceptCardStatus
  /** 累计成功复习次数（标记「会了」/「再刷」时 +1，「不会」不增） */
  reviewCount: number
  /** 上次复习时间（ISO 8601） */
  lastReviewedAt?: string
  /** 下次应复习时间（ISO 8601 或 YYYY-MM-DD，用于筛选今日待刷） */
  nextReviewAt?: string
  /** 创建时间（ISO 8601） */
  createdAt: string
}

/* -------------------------------------------------------------------------- */
/* 今日复盘（元认知自问 + 模型迭代，独立的轻量模块）                            */
/* -------------------------------------------------------------------------- */

/**
 * 元认知复盘的「注意力」维度：在线 / 时有时无 / 不太在线。
 * 非评判 —— 问的是「注意力在不在」，不是「你今天做得怎么样」。
 */
export type AttentionLevel = 'on' | 'partial' | 'off'

/** 「方法有效」维度：有效 / 部分有效 / 没太有效 */
export type MethodEffect = 'worked' | 'partly' | 'not_worked'

/**
 * 每日复盘（一条 = 一天，id 即日期 YYYY-MM-DD）。
 * 复盘不是打分、不是总结报告，而是用几个固定问题完成一次
 * 「元认知自问 + 模型迭代」，把「根据反馈调整模型」变成每天 2 分钟的习惯。
 *
 * 注意：模型里已存在一个旧的 `DailyReview`（基于分数/清单的复盘，走 appStore.data.reviews）。
 * 本模块是全新的元认知复盘，独立 store（dailyReviewStore）+ 独立持久化 key
 * （sdl_daily_reviews），为避免 TS 重复标识符，命名为 `DailyMetaReview`。
 * 所有字段（除 id/date/createdAt/attention/method 外）均为可选，旧数据缺省无碍。
 */
export interface DailyMetaReview {
  /** 日期 YYYY-MM-DD，一天一条（id = date） */
  id: string
  date: string
  /** 今天注意力在线吗 */
  attention: AttentionLevel
  /** 今天的方法有效吗 */
  method: MethodEffect
  /** 可选：可能是什么打断了注意力（选「时有时无/不太在线」时填写） */
  attentionNote?: string
  /** 今天有没有遇到反例/意外，让我发现原来的理解需要修正（模型迭代核心字段） */
  surprise?: string
  /** 明天想调整的一个小地方 */
  nextTweak?: string
  /** 创建时间（ISO 8601） */
  createdAt: string
}

/**
 * 费曼输出笔记：选一个概念，按费曼四步走——
 * ① 用教小学生的语言讲 → ② 标记卡壳 → ③ 回去重学 → ④ 用比喻简化。
 * 目的是逼用户暴露「我其实没懂」的地方（对应第一章「主动参与」「模式提取」）。
 *
 * 独立 store（feynmanNoteStore）+ 独立持久化 key（sdl_feynman_notes）。
 * 除 conceptText / simpleExplanation / createdAt 外，其余字段均可选（保持可选字段风格，
 * 不升 SCHEMA_VERSION）；后三步留空也能保存，「填了会更容易发现没懂的地方」。
 */
export interface FeynmanNote {
  id: string
  /** 要讲清楚的概念名（必填） */
  conceptText: string
  /** 可选：来自哪张概念卡（从卡片页深链跳转时记录，便于回链核对） */
  sourceCardId?: string
  /** 第一步：用教小学生的语言写（必填） */
  simpleExplanation: string
  /** 第二步：哪里卡壳了（可选） */
  gaps?: string
  /** 第三步：回去重学后补充（可选） */
  relearn?: string
  /** 第四步：用比喻简化（可选） */
  analogy?: string
  /** 创建时间（ISO 8601） */
  createdAt: string
}

/**
 * 一页纸挑战：选一个主题，用一段结构化文本把「核心概念 + 它们的关系」串起来，
 * 补上「从点到网」的环节（对应第一章「学得好 = 模式提取 + 迁移」）。
 * 与费曼输出互补：费曼攻单个概念，一页纸连多个概念。
 *
 * 独立 store（onePageNoteStore）+ 独立持久化 key（sdl_one_page_notes），与费曼笔记互不干扰。
 * 不做富文本、不做画布、不做自动排版；内容用等宽字体便于画箭头和缩进，「只要自己能看懂」。
 */
export interface OnePageNote {
  id: string
  /** 要整理的主题（必填，如「第一章 学习的本质」） */
  topic: string
  /** 一页纸正文：核心概念与关系的结构化文本（必填，可用缩进/箭头/短句） */
  content: string
  /** 创建时间（ISO 8601） */
  createdAt: string
}

/** 注意力三选项的中文标签 + emoji */
export const ATTENTION_OPTIONS: { value: AttentionLevel; emoji: string; label: string }[] = [
  { value: 'on', emoji: '🟢', label: '在线' },
  { value: 'partial', emoji: '🟡', label: '时有时无' },
  { value: 'off', emoji: '🔴', label: '不太在线' },
]

/** 方法有效三选项的中文标签 + emoji */
export const METHOD_OPTIONS: { value: MethodEffect; emoji: string; label: string }[] = [
  { value: 'worked', emoji: '🟢', label: '有效' },
  { value: 'partly', emoji: '🟡', label: '部分有效' },
  { value: 'not_worked', emoji: '🔴', label: '没太有效' },
]

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
