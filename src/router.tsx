import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import TodayPage from './pages/TodayPage'
import CardsPage from './pages/CardsPage'
import ReviewPage from './pages/ReviewPage'
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
        <Route path="/reading" element={<ReadingPage />} />
        <Route path="/writing" element={<WritingPage />} />
        <Route path="/critical" element={<CriticalPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  )
}
