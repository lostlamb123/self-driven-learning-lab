/**
 * Markdown 导出公共层（阅读页 / 写作页 / 明辨页共用）
 *
 * 统一约定：
 * - 文件名：`<prefix>-<标题 slug>-YYYY-MM-DD.md`，日期取本地时区的 `YYYY-MM-DD`
 * - 标题层级：`#` 文档标题、`##` 章节、`###` 章节内小节，叶子要点用 `-`
 * - 参考附注行：`- 参考笔记：<标题>`，笔记已删除时为 `- 参考笔记：已删除`
 * - 正文统一以单个换行结尾（部分编辑器对无尾换行的文件会提示）
 */
import { toDateKey } from './date'
import { REFERENCE_LABEL } from './references'

/** 文件名中不允许 / 不友好的字符（含空白） */
const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|\s]+/g

/**
 * 标题 → 文件名片段。
 * 截断到 max 个字符、替换非法字符、去掉首尾下划线，空标题回落 untitled。
 */
export function markdownSlug(text: string, max = 40): string {
  const raw = (text ?? '').trim()
  const cut = raw.length > max ? raw.slice(0, max) : raw
  const cleaned = cut.replace(UNSAFE_FILENAME_CHARS, '_').replace(/^_+|_+$/g, '')
  return cleaned || 'untitled'
}

/** 统一的导出文件名：`<prefix>-<slug>-YYYY-MM-DD.md` */
export function markdownFileName(prefix: string, title: string, max = 40): string {
  return `${prefix}-${markdownSlug(title, max)}-${toDateKey()}.md`
}

/**
 * 参考附注行。
 * @param title 解析后的标题（已删除的引用传 `DELETED_NOTE_TITLE`）
 * @param indent 缩进（嵌在列表项下时用两个空格）
 */
export function referenceLine(title: string, indent = ''): string {
  return `${indent}- ${REFERENCE_LABEL}${title}`
}

/** 触发浏览器下载；filename 在前，content 在后 */
export function downloadMarkdown(filename: string, content: string): void {
  // 统一结尾：去掉多余空行，只保留一个换行
  const text = `${content.replace(/\n+$/, '')}\n`
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 立即撤销在部分浏览器会让下载中断，放到下一轮事件循环
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
