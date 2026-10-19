import { useEffect } from 'react'
import Router from './router'
import { useConceptCardStore } from './stores/conceptCardStore'

export default function App() {
  /**
   * 应用挂载时补种一次概念卡种子。
   *
   * 为什么放在这里：种子原本只在 conceptCardStore 的 onRehydrateStorage 里补，
   * 冷启动（localStorage 为空）时首个页面（/today、/review）渲染那一刻 store 仍是
   * 空数组，`selectTodayCards` 读到 0 张，入口与复盘速览都会缺数据。
   * 根组件挂载即补种，任何入口页面都不用再等「先去过卡片页」。
   *
   * `ensureSeeded` 本身是幂等的（按 id + front 双去重），StrictMode 下重复执行安全。
   */
  useEffect(() => {
    useConceptCardStore.getState().ensureSeeded()
  }, [])

  return <Router />
}
