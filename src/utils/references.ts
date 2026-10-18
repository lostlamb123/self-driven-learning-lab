/**
 * 引用完整性：把「一堆笔记 id」解析成可以直接渲染的引用项
 *
 * 背景：笔记被删除时，卡片（sourceNoteIds）、大纲节点（evidenceIds）、
 * 明辨案例（noteIds）里可能残留已失效的 id。
 * 这里统一降级策略：**找不到对应笔记就标记为「已删除」**，
 * 既不崩溃，也不静默丢行——渲染和 Markdown 导出都走同一套解析结果。
 */
import type { ReadingNote } from '../types/models'

/** 引用标签前缀（卡片页、写作页、明辨页与导出共用） */
export const REFERENCE_LABEL = '参考笔记：'

/** 笔记已被删除时展示的标题 */
export const DELETED_NOTE_TITLE = '已删除'

export interface NoteRef {
  /** 原始 id */
  id: string
  /** 可展示的标题；缺失时为「已删除」，空标题时为「（未命名笔记）」 */
  title: string
  /** 是否已失效（对应笔记不存在） */
  missing: boolean
}

/**
 * 批量解析笔记引用。
 * @param ids 关联的笔记 id 列表（可能是 undefined / 重复 id）
 * @param notes 当前全部阅读笔记
 */
export function resolveNoteRefs(
  ids: readonly string[] | undefined | null,
  notes: readonly ReadingNote[],
): NoteRef[] {
  const byId = new Map(notes.map((n) => [n.id, n]))
  return (ids ?? []).map((id) => {
    const note = byId.get(id)
    if (!note) return { id, title: DELETED_NOTE_TITLE, missing: true }
    return { id, title: note.title.trim() || '（未命名笔记）', missing: false }
  })
}

/** 单个引用（找不到时返回 missing 项而不是 null） */
export function resolveNoteRef(id: string, notes: readonly ReadingNote[]): NoteRef {
  return resolveNoteRefs([id], notes)[0]
}
