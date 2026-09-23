import { useId, type ComponentProps, type ReactElement, type ReactNode, cloneElement, isValidElement } from 'react'
import { cn } from '@/utils/cn'

const controlBase =
  'w-full rounded-xl border border-line-strong bg-surface text-ink placeholder:text-ink-3 ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-ink-3 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_oklab,var(--ring)_18%,transparent)] ' +
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3 ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-[color-mix(in_oklab,var(--danger)_18%,transparent)]'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(controlBase, 'h-11 px-3.5 text-[0.95rem]', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(controlBase, 'min-h-24 resize-y px-3.5 py-2.5 text-[0.95rem] leading-relaxed', className)} {...props} />
}

export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        controlBase,
        'h-11 appearance-none bg-[length:1rem] bg-[right_0.85rem_center] bg-no-repeat pr-10 pl-3.5 text-[0.95rem]',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b5f58' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('text-sm font-semibold text-ink', className)} {...props} />
}

interface FieldProps {
  label: ReactNode
  /** Short guidance shown under the control. */
  hint?: ReactNode
  error?: string
  required?: boolean
  optional?: boolean
  className?: string
  children: ReactElement<Record<string, unknown>>
}

/**
 * Wires a label, hint and error to a single form control via id /
 * aria-describedby / aria-invalid, and keeps the error next to the field.
 */
export function Field({ label, hint, error, required, optional, className, children }: FieldProps) {
  const id = useId()
  const controlId = (isValidElement(children) && (children.props.id as string | undefined)) || `field-${id}`
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={controlId}>
        {label}
        {required && (
          <span className="text-danger-text" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {optional && <span className="font-normal text-ink-3"> (optional)</span>}
      </Label>
      {cloneElement(children, {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-[0.8rem] leading-snug text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[0.8rem] font-medium leading-snug text-danger-text" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
