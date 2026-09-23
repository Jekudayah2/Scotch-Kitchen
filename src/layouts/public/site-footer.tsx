import { ArrowRight, AtSign, Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router'
import { KitchenLogo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { store } from '@/config/store'

const columns = [
  {
    title: 'Brands',
    links: [
      { to: '/zobopop', label: 'ZOBOPOP' },
      { to: '/creamypop', label: 'Creamypop' },
      { to: '/order', label: 'Full menu' },
    ],
  },
  {
    title: 'Orders',
    links: [
      { to: '/order', label: 'Order Now' },
      { to: '/track-order', label: 'Track an order' },
      { to: '/cart', label: 'Your bag' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/account', label: 'My account' },
      { to: '/account/orders', label: 'My orders' },
      { to: '/sign-in', label: 'Sign in' },
    ],
  },
]

export function SiteFooter() {
  const year = new Date().getFullYear()
  const { contact } = store
  return (
    <footer className="relative overflow-hidden bg-[#2a0a10] text-[#fff5ee] dark:bg-[#150507]">
      <div className="container-page grid gap-12 pt-16 pb-10 lg:grid-cols-[1.2fr_2fr] lg:pt-20">
        <div className="space-y-6">
          <Link to="/" aria-label="SCOTCH’s Kitchen home" className="inline-block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <KitchenLogo variant="stacked" tone="on-dark" className="h-28 sm:h-32" />
          </Link>
          <p className="max-w-sm text-[0.95rem] leading-relaxed text-[#f0d9d4]">
            Fresh products. Easy ordering. Reliable delivery. The home of ZOBOPOP and Creamypop, delivering around {store.areaLabel}.
          </p>
          <Button asChild variant="light" size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
            <Link to="/order">Order Now</Link>
          </Button>
          <ul className="space-y-2.5 text-sm text-[#f0d9d4]">
            <li className="flex items-center gap-2.5">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              Delivering around {store.areaLabel}
            </li>
            {contact.phone && (
              <li>
                <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="flex items-center gap-2.5 hover:text-white hover:underline">
                  <Phone className="size-4 shrink-0" aria-hidden="true" />
                  {contact.phone}
                </a>
              </li>
            )}
            {contact.email && (
              <li>
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2.5 hover:text-white hover:underline">
                  <Mail className="size-4 shrink-0" aria-hidden="true" />
                  {contact.email}
                </a>
              </li>
            )}
            {contact.instagram && (
              <li>
                <a href={contact.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 hover:text-white hover:underline">
                  <AtSign className="size-4 shrink-0" aria-hidden="true" />
                  Instagram
                </a>
              </li>
            )}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="mb-4 text-xs font-bold tracking-[0.18em] text-[#d8b6ae] uppercase">{column.title}</h2>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link to={link.to} className="text-[0.95rem] text-[#fff5ee] transition-colors hover:text-white hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <p
        aria-hidden="true"
        className="container-page -mb-[0.12em] font-display text-[length:min(12.4rem,calc((100vw_-_2rem)/6.1))] leading-[0.8] font-extrabold tracking-[-0.01em] whitespace-nowrap text-white/[0.07] uppercase select-none [font-stretch:75%]"
      >
        Scotch’s Kitchen
      </p>

      <div className="relative border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 pb-32 text-xs text-[#d8b6ae] sm:flex-row sm:items-center sm:justify-between lg:pb-6">
          <p>© {year} SCOTCH’s Kitchen. ZOBOPOP and Creamypop are SCOTCH’s Kitchen brands.</p>
          <p>Secure payments powered by Paystack.</p>
        </div>
      </div>
    </footer>
  )
}
