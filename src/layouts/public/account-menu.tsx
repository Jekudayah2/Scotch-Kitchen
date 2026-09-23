import { Bike, ChevronDown, LayoutDashboard, LogOut, MapPinned, Package, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { signOut } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-provider'
import { friendlyError } from '@/utils/errors'

export function useSignOut() {
  const navigate = useNavigate()
  return async () => {
    try {
      await signOut()
      toast.success('You’re signed out.')
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(friendlyError(error))
    }
  }
}

export function AccountMenu() {
  const auth = useAuth()
  const navigate = useNavigate()
  const handleSignOut = useSignOut()

  if (auth.status !== 'signed_in') {
    return (
      <Button asChild variant="secondary" size="md" className="gap-2 pr-4 pl-3">
        <Link to="/sign-in">
          <UserRound aria-hidden="true" />
          Sign in
        </Link>
      </Button>
    )
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="flex h-11 items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label={`Account menu for ${auth.displayName || 'your account'}`}
        >
          <Avatar src={auth.profile?.avatar_url} name={auth.displayName} size="sm" />
          <span className="max-w-28 truncate">{auth.firstName || 'Account'}</span>
          <ChevronDown className="size-4 text-ink-3" aria-hidden="true" />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>
          <p className="truncate text-sm font-bold text-ink">{auth.displayName || 'Your account'}</p>
          {auth.user?.email && <p className="truncate text-xs text-ink-3">{auth.user.email}</p>}
        </MenuLabel>
        <MenuSeparator />
        <MenuItem icon={<UserRound />} onSelect={() => navigate('/account')}>
          My Account
        </MenuItem>
        <MenuItem icon={<Package />} onSelect={() => navigate('/account/orders')}>
          My Orders
        </MenuItem>
        <MenuItem icon={<MapPinned />} onSelect={() => navigate('/track-order')}>
          Track Order
        </MenuItem>
        {(auth.isAdmin || auth.isRider) && <MenuSeparator />}
        {auth.isAdmin && (
          <MenuItem icon={<LayoutDashboard />} onSelect={() => navigate('/admin')}>
            Admin Dashboard
          </MenuItem>
        )}
        {auth.isRider && (
          <MenuItem icon={<Bike />} onSelect={() => navigate('/rider')}>
            Rider Dashboard
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem icon={<LogOut />} tone="danger" onSelect={() => void handleSignOut()}>
          Sign Out
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
