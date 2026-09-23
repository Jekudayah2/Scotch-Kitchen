import { NavLink } from 'react-router'
import { cn } from '@/utils/cn'
import { BOTTOM_NAV } from './nav-items'

export function MobileBottomNav() {
  return (
    <nav aria-label="Primary" className="safe-bottom glass fixed inset-x-0 bottom-0 z-40 border-t border-line pt-1.5 lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {BOTTOM_NAV.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[0.7rem] font-semibold transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                  isActive ? 'text-primary-text' : 'text-ink-3 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid h-8 w-14 place-items-center rounded-full transition-colors',
                      isActive ? 'bg-primary-soft' : 'group-hover:bg-surface-2',
                    )}
                  >
                    <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
