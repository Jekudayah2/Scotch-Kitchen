import { Avatar as RadixAvatar } from 'radix-ui'
import { cn } from '@/utils/cn'

export function initialsOf(name: string | null | undefined, fallback = '?') {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return fallback
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function Avatar({
  src,
  name,
  size = 'md',
  className,
}: {
  src?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' }
  return (
    <RadixAvatar.Root
      className={cn('relative inline-flex shrink-0 overflow-hidden rounded-full bg-primary-soft ring-2 ring-surface', sizes[size], className)}
    >
      {src && <RadixAvatar.Image src={src} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />}
      <RadixAvatar.Fallback className="grid size-full place-items-center font-bold text-primary-text" delayMs={src ? 400 : 0}>
        {initialsOf(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  )
}
