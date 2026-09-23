import { DropdownMenu } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger

export function MenuContent({ className, align = 'end', sideOffset = 8, ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-56 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-float',
          'data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  )
}

export function MenuItem({
  className,
  icon,
  children,
  tone,
  ...props
}: ComponentProps<typeof DropdownMenu.Item> & { icon?: ReactNode; tone?: 'danger' }) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 text-sm font-medium outline-none',
        'data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-3',
        tone === 'danger' && 'text-danger-text [&_svg]:text-danger-text',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  )
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn('px-3 pt-2 pb-1.5', className)} {...props} />
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn('my-1.5 h-px bg-line', className)} {...props} />
}
