import { useRef, useState, type ChangeEvent } from 'react'
import { useAppStore } from '../store/appStore'
import { PersistenceError } from '../store/persistence'
import {
  DEFAULT_DAILY_CARD_LIMIT,
  DEFAULT_REVIEW_INTERVALS,
} from '../utils/cards'
import type { Settings, ThemeMode } from '../types/models'

/**
 * 设置页
 *
 * 按 Settings 真实字段分组：
 * - 外观：theme（浅色/深色/跟随系统）
 * - 学习节奏：dailyCardLimit（3-20 滑杆）、reviewIntervals（逗号分隔编辑，
 *   校验：≥2 个、递增、整数天）、autoPromptReview 开关、reminderTime 时间选择
 * - 语言：language（按模型枚举 'zh-CN' | 'en'）
 * - 数据管理：导出（store.exportData）、导入（store.importData，二次确认）、
 *   清空（二次确认，文案写明不可恢复）
 *
 * 所有数据仅存于本浏览器 localStorage，导入/导出/清空均通过 store 完成。
 */
export default function SettingsPage() {
  const data = useAppStore((s) => s.data)
  const updateData = useAppStore((s) => s.updateData)
  const exportData = useAppStore((s) => s.exportData)
  const importData = useAppStore((s) => s.importData)
  const notify = useAppStore((s) => s.notify)

  const settings = data.settings

  /* 本地表单草稿：reviewIntervals 用逗号字符串编辑，提交时校验 */
  const [intervalsDraft, setIntervalsDraft] = useState<string>(
    (settings.reviewIntervals.length
      ? settings.reviewIntervals
      : DEFAULT_REVIEW_INTERVALS
    ).join(','),
  )
  const [intervalError, setIntervalError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  /** 解析逗号字符串为递增正整数数组；非法返回 null */
  function parseIntervals(raw: string): number[] | null {
    const items = raw
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10))
    if (items.length < 2) return null
    for (let i = 0; i < items.length; i++) {
      if (!Number.isInteger(items[i]) || items[i] < 1) return null
      if (i > 0 && items[i] <= items[i - 1]) return null
    }
    return items
  }

  /* ------------------------------ 外观 ------------------------------ */
  function changeTheme(theme: ThemeMode) {
    updateData((d) => {
      d.settings.theme = theme
    })
  }

  /* --------------------------- 学习节奏 --------------------------- */
  function changeDailyCardLimit(value: number) {
    updateData((d) => {
      d.settings.dailyCardLimit = value
    })
  }

  function commitIntervals() {
    const parsed = parseIntervals(intervalsDraft)
    if (parsed === null) {
      setIntervalError('至少 2 个、递增的正整数天数，用逗号分隔（如 1,3,7,15,30）')
      return
    }
    setIntervalError(null)
    updateData((d) => {
      d.settings.reviewIntervals = parsed
    })
    notify('success', '复习间隔已更新', 2000)
  }

  function changeAutoPromptReview(value: boolean) {
    updateData((d) => {
      d.settings.autoPromptReview = value
    })
  }

  function changeReminderTime(value: string) {
    updateData((d) => {
      d.settings.reminderTime = value || undefined
    })
  }

  /* ------------------------------ 语言 ------------------------------ */
  function changeLanguage(lang: Settings['language']) {
    updateData((d) => {
      d.settings.language = lang
    })
  }

  /* ---------------------------- 数据管理 ---------------------------- */
  function handleExport() {
    const fileName = exportData()
    notify('success', `已导出 ${fileName}`, 3000)
  }

  function handleClear() {
    updateData((d) => {
      const empty = d
      empty.actions = []
      empty.concepts = []
      empty.notes = []
      empty.outlines = []
      empty.cases = []
      empty.reviews = []
      empty.feedback = []
      empty.goals = []
    })
    notify('info', '已清空数据（导出备份可找回）', 3000)
  }

  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmImport, setConfirmImport] = useState(false)
  const pendingFileRef = useRef<File | null>(null)

  /** 文件选择后立即暂存，弹出二次确认 */
  function onPickImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    pendingFileRef.current = file
    setConfirmImport(true)
  }

  /** 确认后真正执行导入 */
  function confirmImportNow() {
    const file = pendingFileRef.current
    setConfirmImport(false)
    pendingFileRef.current = null
    if (!file) return
    importData(file)
      .then((result) => {
        notify(
          'success',
          `导入成功：${result.summary.goals} 目标 / ${result.summary.actions} 行动 / ${result.summary.concepts} 卡片`,
          3500,
        )
      })
      .catch((err) => {
        const msg =
          err instanceof PersistenceError ? err.message : '导入失败，文件可能损坏。'
        notify('error', msg, 5000)
      })
  }

  function cancelImport() {
    pendingFileRef.current = null
    setConfirmImport(false)
  }

  const intervalsValue = settings.reviewIntervals?.length
    ? settings.reviewIntervals
    : DEFAULT_REVIEW_INTERVALS

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部固定说明：不可折叠、不可关闭 */}
      <div className="rounded-lg border border-teal-300 bg-teal-50 px-4 py-3 text-sm text-teal-800">
        所有数据仅保存在本浏览器，请定期导出备份。
      </div>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
      </header>

      {/* 外观 */}
      <SettingsGroup title="外观">
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-500">主题</label>
          <div className="flex gap-2">
            {(
              [
                { value: 'light', label: '浅色' },
                { value: 'dark', label: '深色' },
                { value: 'system', label: '跟随系统' },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => changeTheme(o.value)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  settings.theme === o.value
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </SettingsGroup>

      {/* 学习节奏 */}
      <SettingsGroup title="学习节奏">
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">
                每日卡片复习数量上限
              </label>
              <span className="text-sm font-semibold text-teal-600">
                {settings.dailyCardLimit ?? DEFAULT_DAILY_CARD_LIMIT}
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={20}
              value={settings.dailyCardLimit ?? DEFAULT_DAILY_CARD_LIMIT}
              onChange={(e) => changeDailyCardLimit(Number(e.target.value))}
              className="w-full accent-teal-600"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>3</span>
              <span>20</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              复习间隔（天，逗号分隔，至少 2 个、递增）
            </label>
            <div className="flex gap-2">
              <input
                value={intervalsDraft}
                onChange={(e) => setIntervalsDraft(e.target.value)}
                onBlur={commitIntervals}
                placeholder="1,3,7,15,30"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={commitIntervals}
                className="rounded-lg bg-teal-600 px-3 py-2 text-sm text-white hover:bg-teal-700"
              >
                应用
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {intervalsValue.map((v, i) => (
                <span
                  key={i}
                  className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500"
                >
                  {v} 天
                </span>
              ))}
            </div>
            {intervalError ? (
              <p className="mt-1 text-xs text-red-600">{intervalError}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                当前生效：{intervalsValue.join(' → ')} 天
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">完成后自动提醒复盘</div>
              <div className="text-xs text-slate-400">完成行动后弹出复盘提示</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoPromptReview}
              onClick={() => changeAutoPromptReview(!settings.autoPromptReview)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                settings.autoPromptReview ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  settings.autoPromptReview ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              每日提醒时间（可选）
            </label>
            <input
              type="time"
              value={settings.reminderTime ?? ''}
              onChange={(e) => changeReminderTime(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>
      </SettingsGroup>

      {/* 语言 */}
      <SettingsGroup title="语言">
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-500">界面语言</label>
          <select
            value={settings.language}
            onChange={(e) => changeLanguage(e.target.value as Settings['language'])}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          >
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
        </div>
      </SettingsGroup>

      {/* 数据管理 */}
      <SettingsGroup title="数据管理">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg border border-teal-300 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
          >
            导出全部数据（JSON）
          </button>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              导入 JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={onPickImportFile}
              className="hidden"
            />
            {confirmImport && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span>将覆盖当前数据，是否继续？</span>
                <button
                  type="button"
                  onClick={confirmImportNow}
                  className="rounded bg-amber-600 px-2 py-1 text-white"
                >
                  确认导入
                </button>
                <button
                  type="button"
                  onClick={cancelImport}
                  className="rounded border border-slate-300 px-2 py-1 text-slate-600"
                >
                  取消
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              清空全部数据
            </button>
            {confirmClear && (
              <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                <span>此操作不可恢复，请先导出备份。确定清空？</span>
                <button
                  type="button"
                  onClick={() => {
                    handleClear()
                    setConfirmClear(false)
                  }}
                  className="rounded bg-red-600 px-2 py-1 text-white"
                >
                  确认清空
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded border border-slate-300 px-2 py-1 text-slate-600"
                >
                  取消
                </button>
              </div>
            )}
          </div>
        </div>
      </SettingsGroup>
    </div>
  )
}

function SettingsGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </section>
  )
}
