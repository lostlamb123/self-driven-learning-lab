/**
 * 一页纸挑战 store（Zustand + persist）
 *
 * - 独立于主 appStore 与费曼模块，单独持久化到 localStorage，key 为
 *   `sdl_one_page_notes`。
 * - 一页纸：选一个主题，用一段结构化文本把「核心概念 + 它们的关系」串起来，
 *   补上「从点到网」的环节（对应第一章「学得好 = 模式提取 + 迁移」）。
 * - 不做评分、不做模板、不做 AI 批改、不做完成度；内容用等宽字体便于画箭头/缩进。
 * - 与费曼笔记各自独立 store / 独立 key，互不干扰。
 * - 所有变更只通过本 store 的 action 完成，组件不直接写 localStorage。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OnePageNote } from '../types/models'

const STORAGE_KEY = 'sdl_one_page_notes'

/** 生成本地唯一的实体 id（带类型前缀，便于跨类型去重与调试） */
function newNoteId(): string {
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface OnePageNoteStore {
  /** 全部一页纸（含历史），按 createdAt 倒序展示（见 selectRecentNotes） */
  notes: OnePageNote[]

  /** 新增一页纸（id / createdAt 由 store 生成，组件只传主题与内容） */
  addNote: (topic: string, content: string) => void
  /** 局部更新一条一页纸（按 id 合并 partial，不升 SCHEMA_VERSION） */
  updateNote: (id: string, partial: Partial<Omit<OnePageNote, 'id' | 'createdAt'>>) => void
  /** 删除一页纸（轻量，不做级联） */
  removeNote: (id: string) => void
}

export const useOnePageNoteStore = create<OnePageNoteStore>()(
  persist(
    (set) => ({
      notes: [],

      addNote: (topic, content) => {
        const record: OnePageNote = {
          id: newNoteId(),
          topic: topic.trim(),
          content: content.trim(),
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ notes: [...state.notes, record] }))
      },

      updateNote: (id, partial) => {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, ...partial } : n)),
        }))
      },

      removeNote: (id) => {
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }))
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      /** 只持久化 notes；派生值不入库 */
      partialize: (state) => ({ notes: state.notes }),
    },
  ),
)

/* -------------------------------------------------------------------------- */
/* 派生 selector（组件内使用）                                                 */
/* -------------------------------------------------------------------------- */

/** 按 createdAt 倒序（最新的在上） */
export function selectRecentNotes(state: OnePageNoteStore): OnePageNote[] {
  return [...state.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
