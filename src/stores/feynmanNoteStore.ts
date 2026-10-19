/**
 * 费曼输出 store（Zustand + persist）
 *
 * - 独立于主 appStore 与其余模块，单独持久化到 localStorage，key 为
 *   `sdl_feynman_notes`。
 * - 费曼四步：用教小学生的语言写 → 标记卡壳 → 回去重学 → 用比喻简化。
 *   目的是逼用户暴露「我其实没懂」的地方（对应第一章「主动参与」「模式提取」）。
 * - 不做评分、不做 AI 批改、不做完成度；后三步可空，「填了会更容易发现没懂的地方」。
 * - 所有变更只通过本 store 的 action 完成，组件不直接写 localStorage。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FeynmanNote } from '../types/models'

const STORAGE_KEY = 'sdl_feynman_notes'

/** 生成本地唯一的实体 id（带类型前缀，便于跨类型去重与调试） */
function newNoteId(): string {
  return `fy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface FeynmanNoteStore {
  /** 全部费曼笔记（含历史），按 createdAt 倒序展示（见 selectRecentNotes） */
  notes: FeynmanNote[]

  /** 新增一条费曼笔记（id / createdAt 由 store 生成，组件只传内容字段） */
  addNote: (note: Omit<FeynmanNote, 'id' | 'createdAt'>) => void
  /** 局部更新一条笔记（按 id 合并 partial，不升 SCHEMA_VERSION） */
  updateNote: (id: string, partial: Partial<Omit<FeynmanNote, 'id' | 'createdAt'>>) => void
  /** 删除一条笔记（轻量，不做级联；关联的卡片 evidenceIds / noteIds 只保留 id） */
  removeNote: (id: string) => void
}

export const useFeynmanNoteStore = create<FeynmanNoteStore>()(
  persist(
    (set) => ({
      notes: [],

      addNote: (note) => {
        const record: FeynmanNote = {
          id: newNoteId(),
          ...note,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ notes: [...state.notes, record] }))
      },

      updateNote: (id, partial) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, ...partial } : n,
          ),
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
export function selectRecentNotes(
  state: FeynmanNoteStore,
): FeynmanNote[] {
  return [...state.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
