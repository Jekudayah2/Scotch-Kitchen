import { MapPin } from 'lucide-react'
import { store } from '@/config/store'
import { useStoreSettings } from '@/features/products/queries'

/** Slim top strip. Shows the admin's storefront notice when one is set. */
export function AnnouncementBar() {
  const settings = useStoreSettings()
  const notice = settings.data?.storefront_notice?.trim()
  const paused = settings.data?.accepting_orders === false

  return (
    <div className="bg-[#4e0e19] text-[#fff8f1] dark:bg-[#2a0a10]">
      <p className="container-page flex min-h-9 items-center justify-center gap-2 py-1.5 text-center text-[0.8rem] font-medium">
        {paused ? (
          <span>We’re not taking new orders right now. You can still browse and track existing orders.</span>
        ) : notice ? (
          <span>{notice}</span>
        ) : (
          <>
            <MapPin className="size-3.5 shrink-0 text-[#f4c9a8]" aria-hidden="true" />
            <span>
              Now delivering around <strong className="font-semibold">{store.areaLabel}</strong>
              <span className="hidden sm:inline"> · order online, pay securely, track every step</span>
            </span>
          </>
        )}
      </p>
    </div>
  )
}
