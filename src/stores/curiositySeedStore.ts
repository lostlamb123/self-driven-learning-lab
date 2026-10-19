/**
 * 好奇种子 store（Zustand + persist）
 *
 * - 独立于「今日最小行动」与主 appStore，单独持久化到 localStorage，
 *   key 为 `sdl_curiosity_seeds`。
 * - 探索欲是内驱力的源头：只「种下」，不要求解决、不打卡、不设目标数量、
 *   不做进度条、不提醒。因此这里**没有**任何完成/状态/目标字段。
 * - 所有变更只通过本 store 的 action 完成，组件不直接写 localStorage。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CuriositySeed } from '../types/models'
import { toDateKey } from '../utils/date'

const STORAGE_KEY = 'sdl_curiosity_seeds'

/** 生成本地唯一的实体 id（带类型前缀，便于跨类型去重与调试） */
function newSeedId(): string {
  return `seed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface CuriositySeedStore {
  /** 全部好奇种子（含历史），按 createdAt 升序存储 */
  seeds: CuriositySeed[]

  /** 种下一颗好奇种子（自由文本，无需任何额外信息） */
  addSeed: (text: string) => void
  /** 移除一颗种子（轻量，不做确认/级联） */
  removeSeed: (id: string) => void
}

export const useCuriositySeedStore = create<CuriositySeedStore>()(
  persist(
    (set) => ({
      seeds: [],

      addSeed: (text) => {
        const seed: CuriositySeed = {
          id: newSeedId(),
          text: text.trim(),
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ seeds: [...state.seeds, seed] }))
      },

      removeSeed: (id) => {
        set((state) => ({ seeds: state.seeds.filter((s) => s.id !== id) }))
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      /** 只持久化 seeds；派生值不入库 */
      partialize: (state) => ({ seeds: state.seeds }),
    },
  ),
)

/* -------------------------------------------------------------------------- */
/* 派生 selector（组件内使用）                                                 */
/* -------------------------------------------------------------------------- */

/** 取今天种下的种子（createdAt 落在今天的），createdAt 升序（早种的在上） */
export function selectTodaySeeds(state: CuriositySeedStore): CuriositySeed[] {
  const todayKey = toDateKey()
  return state.seeds
    .filter((s) => toDateKey(new Date(s.createdAt)) === todayKey)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
