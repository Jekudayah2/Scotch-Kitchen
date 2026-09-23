import { House, MapPinned, ShoppingBag, UserRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  end?: boolean
}

/** Desktop primary navigation (order matters). */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/zobopop', label: 'ZOBOPOP' },
  { to: '/creamypop', label: 'Creamypop' },
  { to: '/order', label: 'Order' },
  { to: '/track-order', label: 'Track Order' },
]

export interface BottomNavItem extends NavItem {
  icon: LucideIcon
}

/** Mobile bottom navigation: four destinations, as specified. */
export const BOTTOM_NAV: BottomNavItem[] = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/order', label: 'Order', icon: ShoppingBag },
  { to: '/track-order', label: 'Track', icon: MapPinned },
  { to: '/account', label: 'Account', icon: UserRound },
]
