/**
 * localStorage 持久化层
 *
 * 职责：
 * - 统一 key：`sdlab:v1`
 * - 自动保存：写入后 debounce 500ms 落盘，避免高频操作打爆同步 IO
 * - JSON 导出：生成带版本号的快照文件并触发浏览器下载
 * - JSON 导入：解析 -> 校验版本号 -> 校验结构 -> 返回规范化数据
 *
 * 设计取舍：
 * - 不依赖任何框架，纯函数 + 一个可关闭的自动保存器；
 * - 导入失败一律抛出 `PersistenceError`，由 UI 决定如何提示，
 *   不在这里做 toast / console 之外的表现层逻辑。
 */
import {
  SCHEMA_VERSION,
  createEmptyAppData,
  type AppData,
} from '../types/models'

/** localStorage 中使用的唯一 key */
export const STORAGE_KEY = 'sdlab:v1'

/** 自动保存的防抖间隔（毫秒） */
export const AUTOSAVE_DEBOUNCE_MS = 500

/** 导出文件默认名前缀，实际文件名会追加日期 */
export const EXPORT_FILE_PREFIX = 'sdlab-backup'

/** 持久化相关错误的错误码，便于调用方分支处理 */
export type PersistenceErrorCode =
  | 'READ_FAILED'
  | 'WRITE_FAILED'
  | 'PARSE_FAILED'
  | 'INVALID_SHAPE'
  | 'VERSION_MISSING'
  | 'VERSION_UNSUPPORTED'

/** 持久化层统一抛出的错误类型 */
export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode
  /** 导入时发现的实际版本号（若可读取） */
  readonly actualVersion?: number
  /** 当前应用支持的版本号 */
  readonly expectedVersion: number
  /** 原始错误，便于排查底层原因（tsconfig 为 ES2020，未启用原生 cause） */
  readonly reason?: unknown

  constructor(
    code: PersistenceErrorCode,
    message: string,
    options: { actualVersion?: number; cause?: unknown } = {},
  ) {
    super(message)
    this.name = 'PersistenceError'
    this.code = code
    this.actualVersion = options.actualVersion
    this.expectedVersion = SCHEMA_VERSION
    this.reason = options.cause
  }
}

/* -------------------------------------------------------------------------- */
/* 基础读写                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 读取原始字符串。
 * 浏览器禁用存储、隐私模式等情况下 localStorage 访问本身会抛错，这里统一收敛为 null。
 */
function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** 写入原始字符串，失败时抛出 PersistenceError（通常是配额超限） */
function writeRaw(value: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch (cause) {
    throw new PersistenceError('WRITE_FAILED', '写入本地存储失败，可能是空间已满。', { cause })
  }
}

/* -------------------------------------------------------------------------- */
/* 结构校验                                                                    */
/* -------------------------------------------------------------------------- */

/** 判断是否为普通对象（排除 null 与数组） */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 必须存在的集合字段，缺失时补空数组，保证 UI 不会因 undefined 崩溃 */
const COLLECTION_KEYS = [
  'goals',
  'actions',
  'concepts',
  'notes',
  'outlines',
  'cases',
  'reviews',
  'feedback',
] as const

/**
 * 把任意来源的对象规范化为 AppData。
 *
 * 策略是「宽松读取、严格版本」：
 * - 版本号缺失或不匹配 -> 直接拒绝（结构可能已不兼容，静默修复会丢数据）；
 * - 版本号正确但个别字段缺失 -> 用默认值补齐，尽量让用户的数据能打开。
 */
function normalizeAppData(input: unknown): AppData {
  if (!isRecord(input)) {
    throw new PersistenceError('INVALID_SHAPE', '导入内容不是一个有效的 JSON 对象。')
  }

  const rawVersion = input.version
  if (typeof rawVersion !== 'number' || Number.isNaN(rawVersion)) {
    throw new PersistenceError('VERSION_MISSING', '导入文件缺少版本号（version）字段。')
  }

  if (rawVersion !== SCHEMA_VERSION) {
    throw new PersistenceError(
      'VERSION_UNSUPPORTED',
      `数据版本不兼容：文件为 v${rawVersion}，当前应用支持 v${SCHEMA_VERSION}。`,
      { actualVersion: rawVersion },
    )
  }

  const fallback = createEmptyAppData()

  const profile = isRecord(input.profile)
    ? ({ ...fallback.profile, ...input.profile } as AppData['profile'])
    : fallback.profile

  const settings = isRecord(input.settings)
    ? ({ ...fallback.settings, ...input.settings } as AppData['settings'])
    : fallback.settings

  // 集合字段：仅接受数组，非数组一律回落为空数组
  const collections: Partial<Record<(typeof COLLECTION_KEYS)[number], unknown[]>> = {}
  for (const key of COLLECTION_KEYS) {
    const value = input[key]
    collections[key] = Array.isArray(value) ? value : []
  }

  return {
    version: SCHEMA_VERSION,
    profile,
    goals: collections.goals as AppData['goals'],
    actions: collections.actions as AppData['actions'],
    concepts: collections.concepts as AppData['concepts'],
    notes: collections.notes as AppData['notes'],
    outlines: collections.outlines as AppData['outlines'],
    cases: collections.cases as AppData['cases'],
    reviews: collections.reviews as AppData['reviews'],
    feedback: collections.feedback as AppData['feedback'],
    settings,
    savedAt: typeof input.savedAt === 'string' ? input.savedAt : fallback.savedAt,
  }
}

/* -------------------------------------------------------------------------- */
/* 读取 / 写入 AppData                                                          */
/* -------------------------------------------------------------------------- */

/**
 * 从 localStorage 读取应用数据。
 * 首次使用、数据损坏、版本不符等情况一律返回空数据，保证应用总能启动。
 */
export function loadAppData(): AppData {
  const raw = readRaw()
  if (raw === null) return createEmptyAppData()

  try {
    return normalizeAppData(JSON.parse(raw))
  } catch {
    // 本地数据不可用时不清空存储，留给用户自行导出排查
    return createEmptyAppData()
  }
}

/**
 * 读取本地数据并区分「损坏」状态，供初始化时给出提示。
 * - 无数据 / 无 key -> `{ data: 默认数据, corrupted: false }`
 * - 有 key 但解析/版本校验失败 -> `{ data: 默认数据, corrupted: true }`
 *
 * 注意：即便 corrupted=true，本地存储不会被清除，
 * 用户可以走「导出 -> 修复 -> 导入」的路径找回数据。
 */
export function loadAppDataWithError(): { data: AppData; corrupted: boolean } {
  const raw = readRaw()
  if (raw === null) return { data: createEmptyAppData(), corrupted: false }

  try {
    return { data: normalizeAppData(JSON.parse(raw)), corrupted: false }
  } catch {
    return { data: createEmptyAppData(), corrupted: true }
  }
}

/**
 * 立即写入（同步）。会刷新 `savedAt`。
 * 适合「用户点了保存」「即将关闭页面」等需要确定落盘的场景。
 */
export function saveAppData(data: AppData): void {
  const payload: AppData = {
    ...data,
    version: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
  }
  writeRaw(JSON.stringify(payload))
}

/** 清空本地数据（调试 / 重置用）。会取消待执行的自动保存。 */
export function clearAppData(): void {
  cancelPendingSave()
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 无存储权限时忽略
  }
}

/* -------------------------------------------------------------------------- */
/* 自动保存（debounce）                                                        */
/* -------------------------------------------------------------------------- */

let pendingTimer: ReturnType<typeof setTimeout> | null = null
let pendingData: AppData | null = null

/** 取消尚未落盘的自动保存 */
export function cancelPendingSave(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer)
    pendingTimer = null
  }
  pendingData = null
}

/**
 * 是否有等待写入的数据。
 * 配合 `flushPendingSave` 使用，可在路由切换或页面卸载前判断是否需要补写。
 */
export function hasPendingSave(): boolean {
  return pendingData !== null
}

/** 立刻把待写入的数据落盘（若有），并清除定时器 */
export function flushPendingSave(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer)
    pendingTimer = null
  }
  if (pendingData !== null) {
    const data = pendingData
    pendingData = null
    saveAppData(data)
  }
}

/**
 * 自动保存：500ms 内多次调用只写最后一次，返回取消函数。
 *
 * @example
 * const cancel = scheduleAutoSave(nextState)
 * // 组件卸载或需要立即提交时
 * cancel()
 */
export function scheduleAutoSave(data: AppData, delay = AUTOSAVE_DEBOUNCE_MS): () => void {
  pendingData = data
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer)
  }
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    const latest = pendingData
    pendingData = null
    if (latest !== null) {
      try {
        saveAppData(latest)
      } catch {
        // 自动保存失败不打断交互，交由下次写入或手动保存重试
      }
    }
  }, delay)

  return cancelPendingSave
}

/** 页面关闭前尽力落盘，避免丢失最后 500ms 内的修改 */
export function attachUnloadFlush(): () => void {
  const handler = () => flushPendingSave()
  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}

/* -------------------------------------------------------------------------- */
/* 导出                                                                        */
/* -------------------------------------------------------------------------- */

/** 生成导出用的 JSON 文本（2 空格缩进，便于人工审阅与 diff） */
export function serializeAppData(data: AppData): string {
  return JSON.stringify(
    { ...data, version: SCHEMA_VERSION, savedAt: new Date().toISOString() },
    null,
    2,
  )
}

/** 生成默认导出文件名：sdlab-backup-2026-10-18.json */
export function buildExportFileName(date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${EXPORT_FILE_PREFIX}-${yyyy}-${mm}-${dd}.json`
}

/**
 * 触发浏览器下载当前数据快照。
 * 返回实际使用的文件名，便于调用方展示「已导出 xxx.json」。
 */
export function exportAppData(data: AppData, fileName = buildExportFileName()): string {
  const blob = new Blob([serializeAppData(data)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // 交给浏览器完成下载后再回收，避免部分浏览器取消下载
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return fileName
}

/* -------------------------------------------------------------------------- */
/* 导入                                                                        */
/* -------------------------------------------------------------------------- */

/** 导入成功后的统计信息，便于给用户反馈「恢复了多少条数据」 */
export interface ImportResult {
  data: AppData
  summary: {
    goals: number
    actions: number
    concepts: number
    notes: number
    outlines: number
    cases: number
    reviews: number
    feedback: number
  }
}

/**
 * 解析 JSON 文本并校验版本号，返回可直接写入 store 的数据。
 *
 * 校验顺序：能否解析 -> 是否对象 -> 有无 version -> version 是否等于 SCHEMA_VERSION。
 * 任一环节失败抛出 `PersistenceError`，调用方可通过 `code` 区分提示语。
 */
export function parseImportedJson(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new PersistenceError('PARSE_FAILED', '文件内容不是合法的 JSON。', { cause })
  }

  const data = normalizeAppData(parsed)

  return {
    data,
    summary: {
      goals: data.goals.length,
      actions: data.actions.length,
      concepts: data.concepts.length,
      notes: data.notes.length,
      outlines: data.outlines.length,
      cases: data.cases.length,
      reviews: data.reviews.length,
      feedback: data.feedback.length,
    },
  }
}

/**
 * 从 `<input type="file">` 选中的文件导入并立即落盘。
 * 导入会覆盖当前数据，调用方应先向用户确认。
 */
export async function importAppDataFromFile(file: File): Promise<ImportResult> {
  const text = await file.text()
  const result = parseImportedJson(text)
  saveAppData(result.data)
  return result
}
