import { X } from 'lucide-react'
import { Dialog as RadixDialog } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Button } from './button'

interface BaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

const overlay =
  'fixed inset-0 z-50 bg-overlay data-[state=open]:animate-fade-in data-[state=closed]:opacity-0 motion-safe:transition-opacity'

/** Centred modal (bottom sheet on phones). */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
}: BaseProps & { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={overlay} />
        <RadixDialog.Content
          className={cn(
            'fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-surface shadow-float outline-none',
            'inset-x-0 bottom-0 rounded-t-4xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-4xl',
            'data-[state=open]:animate-rise-in',
            size === 'sm' && 'sm:max-w-md',
            size === 'md' && 'sm:max-w-lg',
            size === 'lg' && 'sm:max-w-2xl',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="space-y-1">
              <RadixDialog.Title className="text-xl font-bold tracking-tight text-ink">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="text-sm text-ink-3">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">Dialog</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X aria-hidden="true" />
              </Button>
            </RadixDialog.Close>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>}
          {footer && (
            <div className="safe-bottom flex flex-col-reverse gap-2 border-t border-line px-5 pt-4 sm:flex-row sm:justify-end sm:px-6 sm:pb-5">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

/** Side drawer (full-height panel from the right; full screen on phones). */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  width = 'md',
}: BaseProps & { width?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={overlay} />
        <RadixDialog.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-float outline-none',
            'data-[state=open]:animate-sheet-in',
            width === 'sm' && 'sm:max-w-sm',
            width === 'md' && 'sm:max-w-md',
            width === 'lg' && 'sm:max-w-xl',
            width === 'xl' && 'sm:max-w-3xl',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0 space-y-0.5">
              <RadixDialog.Title className="truncate text-lg font-bold tracking-tight text-ink">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="text-sm text-ink-3">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">Panel</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X aria-hidden="true" />
              </Button>
            </RadixDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="safe-bottom border-t border-line bg-surface px-5 pt-3 sm:px-6">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

interface ConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'primary' | 'danger' | 'brand'
  loading?: boolean
  onConfirm: () => void
  children?: ReactNode
  confirmDisabled?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading,
  onConfirm,
  children,
  confirmDisabled,
}: ConfirmProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !loading && onOpenChange(next)}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : tone} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}
