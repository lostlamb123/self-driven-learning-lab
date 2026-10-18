import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import Toaster from '../Toaster'

/** 导航项：path 为路由，icon 用单字符/emoji 占位，后续可替换为图标组件 */
const NAV_ITEMS = [
  { path: '/today', label: '今日', icon: '☀' },
  { path: '/cards', label: '卡片', icon: '▤' },
  { path: '/reading', label: '阅读', icon: '📖' },
  { path: '/writing', label: '写作', icon: '✎' },
  { path: '/critical', label: '明辨', icon: '⚖' },
  { path: '/review', label: '复盘', icon: '↻' },
  { path: '/settings', label: '设置', icon: '⚙' },
] as const

/** 把 settings.theme 解析为实际生效的 'light' | 'dark' */
function resolveTheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export default function AppLayout() {
  const theme = useAppStore((s) => s.data.settings.theme)
  const effective = resolveTheme(theme)

  // 把主题类挂到 <html>，body 背景（CSS 变量）随之切换；
  // 同时监听系统偏好变化（system 模式下刷新）
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', effective === 'dark')

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = (e: MediaQueryListEvent) => {
        root.classList.toggle('dark', e.matches)
      }
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    return undefined
  }, [theme, effective])

  return (
    <div className="min-h-screen bg-[var(--surface-app)] text-slate-900 dark:text-slate-100">
      <Toaster />
      <DesktopSidebar />
      <MobileTabBar />
      <main className="mx-auto w-full px-4 pb-28 pt-6 md:px-8 md:pb-10 lg:pl-64 lg:pr-8 lg:pt-10">
        <div className="mx-auto max-w-3xl">
          <Outlet />
        </div>
      </main>
      <LocalCorruptionNotice />
    </div>
  )
}

/** 桌面端：左侧固定侧边栏（lg 以上显示，移动端优先隐藏） */
function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 lg:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="text-base font-semibold tracking-tight">Self-Driven</span>
        <span className="text-base font-semibold tracking-tight text-teal-600 dark:text-teal-400">
          Lab
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.path} item={item} />
        ))}
      </nav>
      <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400 dark:border-slate-700">
        自驱式学习实验
      </div>
    </aside>
  )
}

function SidebarLink({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-teal-600 text-white'
            : 'text-slate-600 hover:bg-teal-50 hover:text-teal-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-teal-400'
        }`
      }
    >
      <span className="w-4 text-center" aria-hidden>
        {item.icon}
      </span>
      {item.label}
    </NavLink>
  )
}

/** 移动端：底部标签导航栏（lg 以下显示） */
function MobileTabBar() {
  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-700 dark:bg-slate-800/95 lg:hidden"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex min-h-12 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[11px] font-medium transition-colors ${
              isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`text-base leading-none ${isActive ? 'scale-110' : ''} transition-transform`}
                aria-hidden
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/** 初始化时本地数据损坏的提示 */
function LocalCorruptionNotice() {
  const localCorrupted = useAppStore((s) => s.localCorrupted)
  const notify = useAppStore((s) => s.notify)
  const shown = useRef(false)

  useEffect(() => {
    if (localCorrupted && !shown.current) {
      shown.current = true
      notify(
        'error',
        '本地数据无法解析，已回落到空白数据（原数据仍保留在本地，可在「设置」中导入修复）',
      )
    }
  }, [localCorrupted, notify])

  return null
}
