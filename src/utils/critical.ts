/**
 * 明辨（批判性思维）工具：立场标签、偏差预设、三阶段进度、Markdown 导出
 *
 * 三阶段：质疑 → 检验 → 修正
 * - 质疑：targetClaim / stance / reasoning[]
 * - 检验：biases[] / evidence / premiseCheck
 * - 修正：revisedClaim / revisedReason / nextAction
 */
import type { CriticalCase, ReadingNote } from '../types/models'
import { CASE_STANCE_LABEL } from '../types/models'
import { referenceLine } from './markdown'
import { resolveNoteRefs } from './references'

export { CASE_STANCE_LABEL }

export const STANCE_OPTIONS = ['support', 'challenge', 'neutral'] as const

/** 生成案例 id */
export function newCaseId(prefix = 'case'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface StageProgress {
  doubt: boolean
  examine: boolean
  revise: boolean
  filled: number
  total: number
}

/** 三阶段完成情况（任一阶段有实质内容即算已填） */
export function getStageProgress(c: CriticalCase): StageProgress {
  const doubt =
    Boolean(c.targetClaim?.trim()) &&
    (c.reasoning ?? []).some((r) => r.trim())

  const examine =
    (c.biases ?? []).length > 0 ||
    Boolean(c.evidence?.trim()) ||
    Boolean(c.premiseCheck?.trim())

  const revise = Boolean(c.revisedClaim?.trim())

  const flags = [doubt, examine, revise]
  return {
    doubt,
    examine,
    revise,
    filled: flags.filter(Boolean).length,
    total: 3,
  }
}

/** 目标主张截断显示 */
export function truncate(text: string, max = 24): string {
  const t = (text ?? '').trim()
  if (!t) return '（未填写目标主张）'
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/** 文件名安全化：取目标主张前 20 字（保留给列表/导出复用） */
export function safeCaseFileTitle(c: CriticalCase, max = 20): string {
  const raw = (c.targetClaim || c.title || 'untitled').trim()
  const cut = raw.length > max ? raw.slice(0, max) : raw
  return cut.replace(/[\\/:*?"<>|\s]+/g, '_') || 'untitled'
}

/**
 * 导出 Markdown：按「质疑 / 检验 / 修正」三阶段分节。
 * 层级遵循 utils/markdown.ts 的统一约定：`#` 文档标题、`##` 章节。
 * 引用的阅读笔记附「- 参考笔记：xxx」，已删除的笔记写「- 参考笔记：已删除」。
 */
export function caseToMarkdown(c: CriticalCase, notes: ReadingNote[]): string {
  const lines: string[] = []
  lines.push(`# ${(c.targetClaim || c.title || '（未命名案例）').trim()}`)
  lines.push('')
  if (c.description?.trim()) {
    lines.push(`> ${c.description.trim()}`)
    lines.push('')
  }

  /* 阶段一 */
  lines.push('## 一、质疑')
  lines.push('')
  lines.push(`**目标主张：** ${c.targetClaim?.trim() || '（未填写）'}`)
  lines.push('')
  lines.push(`**我的初始立场：** ${CASE_STANCE_LABEL[c.stance] ?? c.stance}`)
  lines.push('')
  const reasoning = (c.reasoning ?? []).map((r) => r.trim()).filter(Boolean)
  if (reasoning.length > 0) {
    lines.push('**我的初始理由：**')
    lines.push(...reasoning.map((r) => `- ${r}`))
  } else {
    lines.push('**我的初始理由：** （未填写）')
  }
  lines.push('')

  /* 阶段二 */
  lines.push('## 二、检验')
  lines.push('')
  const biases = (c.biases ?? []).filter(Boolean)
  lines.push(`**识别到的认知偏差：** ${biases.length ? biases.join('、') : '（未选择）'}`)
  lines.push('')
  lines.push('**反例与证据：**')
  lines.push(c.evidence?.trim() || '（未填写）')
  lines.push('')
  const noteRefs = resolveNoteRefs(c.noteIds, notes)
  if (noteRefs.length > 0) {
    lines.push(...noteRefs.map((ref) => referenceLine(ref.title)))
    lines.push('')
  }
  lines.push('**前提与推论检查：**')
  lines.push(c.premiseCheck?.trim() || '（未填写）')
  lines.push('')

  /* 阶段三 */
  lines.push('## 三、修正')
  lines.push('')
  lines.push(`**修正后的主张：** ${c.revisedClaim?.trim() || '（未填写）'}`)
  lines.push('')
  lines.push(`**修正理由：** ${c.revisedReason?.trim() || '（未填写）'}`)
  lines.push('')
  lines.push(`**下一步行动：** ${c.nextAction?.trim() || '（未填写）'}`)
  lines.push('')

  return lines.join('\n')
}
