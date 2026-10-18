/**
 * 写作大纲工具：文体模板、层级结构（扁平 → 树）、Markdown 导出
 *
 * 结构约定（与 OutlineSection.level 一致）：
 * - level 0 -> 一级节点（核心论点/主旨，只能有一个）
 * - level 1 -> 二级节点（可多个）
 * - level 2 -> 三级节点（挂在最近的二级节点下）
 *
 * 模型里 sections 是扁平数组，这里用 buildTree / flattenTree 做树形视图与回写，
 * 所有增删改排序都先改树再扁平化，保证顺序稳定。
 */
import type { ReadingNote, OutlineSection, OutlineGenre, WritingOutline } from '../types/models'
import { OUTLINE_GENRE_LABEL } from '../types/models'
import { referenceLine } from './markdown'
import { resolveNoteRefs } from './references'

export { OUTLINE_GENRE_LABEL }

export const GENRE_OPTIONS: OutlineGenre[] = ['expository', 'narrative', 'argumentative']

/** 三种文体的二级节点骨架（只预填二级，不预填三级内容） */
export const OUTLINE_TEMPLATES: Record<OutlineGenre, string[]> = {
  expository: ['是什么', '性质与特征', '数量与关系', '空间与时间', '动作与影响'],
  narrative: ['起因', '发展', '冲突', '转折', '结果'],
  argumentative: ['核心论点', '分论点一', '分论点二', '反方观点与驳斥', '结论'],
}

export function newOutlineId(prefix = 'outline'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function newSectionId(): string {
  return `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 新建一个节点 */
export function createSection(level: 0 | 1 | 2, heading = '', thesis = ''): OutlineSection {
  return {
    id: newSectionId(),
    level,
    heading,
    thesis,
    evidenceIds: [],
    drafted: false,
  }
}

/** 依据模板生成二级骨架 */
export function createTemplateSections(genre: OutlineGenre): OutlineSection[] {
  return OUTLINE_TEMPLATES[genre].map((h) => createSection(1, h))
}

/* ----------------------------- 树结构 ----------------------------- */

export interface OutlineGroup {
  section: OutlineSection
  children: OutlineSection[]
}
export interface OutlineTree {
  root: OutlineSection | null
  groups: OutlineGroup[]
}

/** 扁平数组 → 树（相邻的 level-2 归属最近的 level-1） */
export function buildTree(sections: OutlineSection[]): OutlineTree {
  let root: OutlineSection | null = null
  const groups: OutlineGroup[] = []
  let current: OutlineGroup | null = null

  for (const s of sections) {
    if (s.level === 0) {
      if (!root) root = s
      continue
    }
    if (s.level === 1) {
      current = { section: s, children: [] }
      groups.push(current)
      continue
    }
    if (s.level === 2 && current) {
      current.children.push(s)
    }
  }
  return { root, groups }
}

/** 树 → 扁平数组（一级在最前，随后二级及其三级） */
export function flattenTree(tree: OutlineTree): OutlineSection[] {
  const out: OutlineSection[] = []
  if (tree.root) out.push(tree.root)
  for (const g of tree.groups) {
    out.push(g.section)
    out.push(...g.children)
  }
  return out
}

/** 统计各级节点数 */
export function countSections(sections: OutlineSection[]) {
  return {
    level1: sections.filter((s) => s.level === 0).length,
    level2: sections.filter((s) => s.level === 1).length,
    level3: sections.filter((s) => s.level === 2).length,
    total: sections.length,
  }
}

/* --------------------------- Markdown 导出 --------------------------- */

/**
 * 生成大纲 Markdown。
 * 层级遵循 utils/markdown.ts 的统一约定：
 * `#` 文档标题、`##` 一级论点、`###` 二级节点、`-` 三级节点。
 * 三级节点若引用了阅读笔记，附一行「参考笔记：xxx」；笔记已删除时写「参考笔记：已删除」。
 */
export function outlineToMarkdown(outline: WritingOutline, notes: ReadingNote[]): string {
  const lines: string[] = []
  const title = outline.title.trim() || '（未命名大纲）'
  const genreLabel = OUTLINE_GENRE_LABEL[outline.genre ?? 'expository']

  lines.push(`# ${title}`)
  lines.push('')
  lines.push(`> 文体：${genreLabel}`)
  lines.push('')

  const tree = buildTree(outline.sections)

  if (tree.root) {
    lines.push(`## ${tree.root.heading.trim() || '（未填写论点）'}`)
    lines.push('')
    if (tree.root.thesis.trim()) {
      lines.push(tree.root.thesis.trim())
      lines.push('')
    }
  }

  for (const g of tree.groups) {
    lines.push(`### ${g.section.heading.trim() || '（未命名）'}`)
    lines.push('')
    if (g.section.thesis.trim()) {
      lines.push(g.section.thesis.trim())
      lines.push('')
    }
    for (const leaf of g.children) {
      const head = leaf.heading.trim()
      const body = leaf.thesis.trim()
      lines.push(`- ${head}${body ? `：${body}` : ''}`)
      for (const ref of resolveNoteRefs(leaf.evidenceIds, notes)) {
        lines.push(referenceLine(ref.title, '  '))
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

/** 从阅读笔记取一句"关键句"（优先原文摘录，其次费曼总结） */
export function pickKeySentence(note: ReadingNote): string {
  const highlight = (note.highlights ?? []).find((h) => h.trim())
  if (highlight) return highlight.trim()
  const feynman = (note.feynman ?? '').trim()
  if (feynman) {
    const first = feynman.split(/[。；;！!？?\n]+/).map((s) => s.trim()).find(Boolean)
    if (first) return first
  }
  const kw = (note.keywords ?? []).join('、')
  return kw
}
