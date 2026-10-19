import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import TodayPage from './pages/TodayPage'
import CardsPage from './pages/CardsPage'
import ConceptCardsPage from './pages/ConceptCardsPage'
import ReviewPage from './pages/ReviewPage'
import MetaReviewPage from './pages/MetaReviewPage'
import OutputPage from './pages/OutputPage'
import ReadingPage from './pages/ReadingPage'
import WritingPage from './pages/WritingPage'
import CriticalPage from './pages/CriticalPage'
import SettingsPage from './pages/SettingsPage'

/**
 * 路由配置
 *
 * - 根路由使用 AppLayout（侧边栏 + 底部 Tab + Outlet）
 * - 7 个页面：今日 / 卡片 / 阅读 / 写作 / 明辨 / 复盘 / 设置（均已实现）
 * - 根路径 / 自动重定向到 /today
 */
export default function Router() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/cards" element={<CardsPage />} />
        <Route path="/concept-cards" element={<ConceptCardsPage />} />
        <Route path="/reading" element={<ReadingPage />} />
        <Route path="/writing" element={<WritingPage />} />
        <Route path="/critical" element={<CriticalPage />} />
        {/* 元认知复盘（今日复盘）——新模块，/review 主入口 */}
        <Route path="/review" element={<MetaReviewPage />} />
        {/* 费曼输出（/output?tab=feynman|one-pager），Tab 承载费曼输出与一页纸 */}
        <Route path="/output" element={<OutputPage />} />
        {/* 旧的打分式复盘保留在独立路由，避免破坏已有功能 */}
        <Route path="/scoring-review" element={<ReviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  )
}
