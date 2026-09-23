import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { accountKeys, markAllNotificationsRead, markNotificationRead, useNotifications } from '@/features/account/api'
import { useAuth } from '@/features/auth/auth-provider'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { Notification } from '@/types/domain'
import { cn } from '@/utils/cn'
import { formatRelative } from '@/utils/dates'
import { friendlyError } from '@/utils/errors'

export default function NotificationsPage() {
  useDocumentTitle('Notifications')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const notifications = useNotifications()
  const key = accountKeys.notifications(user?.id ?? null)
  const unread = notifications.data?.filter((n) => !n.read_at).length ?? 0

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
    onError: (error) => toast.error(friendlyError(error)),
  })

  const open = (notification: Notification) => {
    if (!notification.read_at) {
      queryClient.setQueryData<Notification[]>(key, (list) =>
        list?.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)),
      )
      markNotificationRead(notification.id).catch(() => void queryClient.invalidateQueries({ queryKey: key }))
    }
    if (notification.link) navigate(notification.link)
  }

  if (notifications.isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading notifications">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>
    )
  }
  if (notifications.isError) {
    return <ErrorState title="We couldn’t load your notifications" error={notifications.error} onRetry={() => void notifications.refetch()} />
  }

  const list = notifications.data
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-3">{unread > 0 ? `${unread} unread` : 'You’re all caught up.'}</p>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending} leadingIcon={<CheckCheck aria-hidden="true" />}>
            Mark all as read
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={Bell} title="No notifications yet" description="Updates about your orders, like payment and delivery, will appear here." />
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {list.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className="flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none sm:px-5"
              >
                <span
                  className={cn('mt-2 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-red')}
                  aria-label={n.read_at ? undefined : 'Unread'}
                  role={n.read_at ? undefined : 'img'}
                />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-ink', n.read_at ? 'font-medium' : 'font-bold')}>{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-sm text-ink-2">{n.body}</span>}
                  <span className="mt-1 block text-xs text-ink-3">{formatRelative(n.created_at)}</span>
                </span>
                {n.link && <ChevronRight className="mt-1 size-4 shrink-0 text-ink-3" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
