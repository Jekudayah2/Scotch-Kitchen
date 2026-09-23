import { AtSign, Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router'
import { KitchenLogo } from '@/components/brand/brand-marks'
import { store } from '@/config/store'

const columns = [
  {
    title: 'Our brands',
    links: [
      { to: '/zobopop', label: 'ZOBOPOP' },
      { to: '/creamypop', label: 'Creamypop' },
      { to: '/order', label: 'Full menu' },
    ],
  },
  {
    title: 'Orders',
    links: [
      { to: '/order', label: 'Order now' },
      { to: '/track-order', label: 'Track an order' },
      { to: '/cart', label: 'Your cart' },
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
    <footer className="bg-[#4e0e19] text-[#fff8f1] dark:bg-[#1c0a0e]">
      <div className="container-page grid gap-12 py-14 lg:grid-cols-[1.3fr_2fr] lg:py-16">
        <div className="space-y-5">
          <KitchenLogo tone="light" />
          <p className="max-w-sm text-[0.95rem] leading-relaxed text-[#f0d9d4]">
            The home of ZOBOPOP and Creamypop. Ghanaian drinks and frozen treats, delivered to your exact pin around{' '}
            {store.areaLabel}.
          </p>
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
              <h2 className="mb-4 font-display text-base font-bold tracking-tight text-white">{column.title}</h2>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link to={link.to} className="text-sm text-[#f0d9d4] transition-colors hover:text-white hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 pb-28 text-xs text-[#e6c9c3] sm:flex-row sm:items-center sm:justify-between lg:pb-6">
          <p>© {year} SCOTCH’s Kitchen. ZOBOPOP and Creamypop are SCOTCH’s Kitchen brands.</p>
          <p>Payments are processed securely by Paystack.</p>
        </div>
      </div>
    </footer>
  )
}
