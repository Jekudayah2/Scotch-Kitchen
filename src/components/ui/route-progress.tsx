import { useNavigation } from 'react-router'
import { cn } from '@/utils/cn'

/**
 * A slim bar at the very top while a route (or its code) is loading. It only
 * appears if loading takes longer than a moment, so fast navigations stay calm.
 */
export function RouteProgress() {
  const busy = useNavigation().state !== 'idle'
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] transition-opacity duration-300',
        busy ? 'opacity-100 delay-150' : 'opacity-0',
      )}
    >
      {busy && <div className="h-full origin-left animate-route-progress rounded-r-full bg-red" />}
    </div>
  )
}
