import { useAppStore, type AppNotification } from '../store/appStore'

/**
 * 全局通知条：渲染在 AppLayout 顶部，订阅 store.notifications。
 * 自动消失由 store.notify 的 setTimeout 控制，这里只负责展示与手动关闭。
 */
export default function Toaster() {
  const notifications = useAppStore((s) => s.notifications)
  const dismiss = useAppStore((s) => s.dismissNotification)
  if (notifications.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 mx-auto flex w-fit max-w-[90%] flex-col gap-2">
      {notifications.map((n) => (
        <ToastItem key={n.id} item={n} onDismiss={dismiss} />
      ))}
    </div>
  )
}

function ToastItem({
  item,
  onDismiss,
}: {
  item: AppNotification
  onDismiss: (id: number) => void
}) {
  const color =
    item.type === 'success'
      ? 'border-teal-500/40 bg-teal-50 text-teal-800'
      : item.type === 'error'
        ? 'border-red-500/40 bg-red-50 text-red-800'
        : 'border-slate-400/40 bg-slate-50 text-slate-700'

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-sm ${color}`}
    >
      <span className="flex-1">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="text-xs opacity-60 hover:opacity-100"
        aria-label="关闭"
      >
        ×
      </button>
    </div>
  )
}
