/**
 * 三级笔记 → Markdown
 *
 * 格式遵循 utils/markdown.ts 的统一约定：
 * `#` 文档标题、`##` 章节、`###` 小节、`-` 叶子要点，元信息用 `>` 引用块。
 */
import type { ReadingNote } from '../types/models'

export function noteToMarkdown(note: ReadingNote): string {
  const lines: string[] = []
  lines.push(`# ${note.title || '（未命名笔记）'}`)
  lines.push('')

  if (note.author || note.sourceUrl) {
    const src = [note.author, note.sourceUrl].filter(Boolean).join(' · ')
    lines.push(`> 来源：${src}`)
    lines.push('')
  }

  const keywords = note.keywords ?? []
  if (keywords.length > 0) {
    lines.push('## 第一步 · 关键概念')
    lines.push(...keywords.map((k) => `- ${k}`))
    lines.push('')
  }

  if (note.keywordChain?.trim()) {
    lines.push('## 第二步 · 关键词链与对立项')
    lines.push(note.keywordChain.trim())
    lines.push('')
  }

  if (note.feynman?.trim()) {
    lines.push('## 第三步 · 思想费曼')
    lines.push(note.feynman.trim())
    lines.push('')
  }

  if (note.feynmanDeepen?.trim()) {
    lines.push('## 第四步 · 费曼×3')
    lines.push(note.feynmanDeepen.trim())
    lines.push('')
  }

  const questions = note.newQuestions ?? []
  if (questions.length > 0) {
    lines.push('## 第五步 · 新问题')
    lines.push(...questions.map((q) => `- ${q}`))
    lines.push('')
  }

  const three = note.threeLevel
  if (three) {
    const sections: [string, string[]][] = [
      ['一级 · 核心概念/主旨', three.level1],
      ['二级 · 衍生概念/定义/逻辑', three.level2],
      ['三级 · 例子/证据/数据', three.level3],
    ]
    const filled = sections.filter(([, items]) => items.length > 0)
    if (filled.length > 0) {
      lines.push('## 三级笔记')
      lines.push('')
      for (const [title, items] of filled) {
        lines.push(`### ${title}`)
        lines.push(...items.map((it) => `- ${it}`))
        lines.push('')
      }
    }
  }

  const conceptIds = note.conceptIds ?? []
  if (conceptIds.length > 0) {
    lines.push(`> 已提炼卡片：${conceptIds.length} 张`)
    lines.push('')
  }

  return lines.join('\n')
}
