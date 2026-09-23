import { CupSoda, House, MapPinned, UserRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  end?: boolean
  /** Rendered as the primary ordering action rather than a plain link. */
  emphasis?: boolean
}

/** Desktop primary navigation, in the specified order. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/zobopop', label: 'ZOBOPOP' },
  { to: '/creamypop', label: 'Creamypop' },
  { to: '/order', label: 'Order', emphasis: true },
  { to: '/track-order', label: 'Track Order' },
]

export interface BottomNavItem extends NavItem {
  icon: LucideIcon
}

/** Mobile floating navigation: four destinations (the cart sits beside them). */
export const BOTTOM_NAV: BottomNavItem[] = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/order', label: 'Order', icon: CupSoda },
  { to: '/track-order', label: 'Track', icon: MapPinned },
  { to: '/account', label: 'Account', icon: UserRound },
]

/** Focused flows hide the floating navigation to keep attention on the task. */
export const FOCUS_ROUTES = ['/checkout']
