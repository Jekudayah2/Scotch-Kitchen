import { Check, Minus, Plus } from 'lucide-react'
import { Checkbox as RadixCheckbox, Switch as RadixSwitch } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function Switch({ className, ...props }: ComponentProps<typeof RadixSwitch.Root>) {
  return (
    <RadixSwitch.Root
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-surface-3 ring-1 ring-line-strong transition-colors',
        'data-[state=checked]:bg-primary data-[state=checked]:ring-primary',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <RadixSwitch.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow-soft transition-transform data-[state=checked]:translate-x-6" />
    </RadixSwitch.Root>
  )
}

export function Checkbox({ className, ...props }: ComponentProps<typeof RadixCheckbox.Root>) {
  return (
    <RadixCheckbox.Root
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-md border border-line-strong bg-surface transition-colors',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-ink',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    >
      <RadixCheckbox.Indicator>
        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )
}

interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

/** Single-choice pill group, keyboard accessible as a radio group. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = 'md',
}: {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  label: string
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('scrollbar-none inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1 ring-1 ring-line', className)}
      onKeyDown={(event) => {
        const index = options.findIndex((o) => o.value === value)
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault()
          const next = options[(index + 1) % options.length]
          if (next) onChange(next.value)
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault()
          const prev = options[(index - 1 + options.length) % options.length]
          if (prev) onChange(prev.value)
        }
      }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors',
              size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
              active ? 'bg-surface text-ink shadow-soft' : 'text-ink-3 hover:text-ink',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring [&_svg]:size-4',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Integer quantity input that can never produce an invalid value. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
  size = 'md',
  className,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label: string
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.trunc(n)))
  const button = cn(
    'grid shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-surface-3 disabled:opacity-40',
    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
    size === 'sm' ? 'size-8' : 'size-10',
  )
  return (
    <div
      className={cn('inline-flex items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-line', className)}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className={button}
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label}`}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(clamp(next))
        }}
        className={cn(
          'tabular w-9 bg-transparent text-center font-bold text-ink outline-none',
          size === 'sm' ? 'text-sm' : 'text-base',
        )}
      />
      <button
        type="button"
        className={button}
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label}`}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
