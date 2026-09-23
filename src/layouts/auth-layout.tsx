import { Link, Outlet } from 'react-router'
import { KitchenLogo } from '@/components/brand/logo'
import { ThemeToggle } from '@/features/theme/theme-toggle'

/** Split-screen shell for sign-in / sign-up. The left panel uses the official product photography. */
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#4e0e19] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_40%,rgba(194,58,82,0.45),transparent_70%)]"
        />
        <Link
          to="/"
          aria-label="SCOTCH’s Kitchen home"
          className="relative w-fit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <KitchenLogo variant="stacked" tone="on-dark" className="h-24" />
        </Link>

        <div className="relative mx-auto grid w-full max-w-lg grid-cols-5 items-end gap-4 py-10">
          <figure className="col-span-3 overflow-hidden rounded-media shadow-float ring-1 ring-white/10">
            <img
              src="/images/products/zobopop-bottle.webp"
              alt="A bottle of ZOBOPOP premium hibiscus drink"
              width={439}
              height={550}
              className="aspect-[4/5] w-full object-cover"
            />
          </figure>
          <div className="col-span-2 flex flex-col gap-4 pb-6">
            <figure className="overflow-hidden rounded-card shadow-float ring-1 ring-white/10">
              <img
                src="/images/products/creamypop-strawberry.jpg"
                alt="A tub of Creamypop strawberry ice cream"
                width={1280}
                height={960}
                className="aspect-square w-full object-cover"
              />
            </figure>
            <figure className="overflow-hidden rounded-card shadow-float ring-1 ring-white/10">
              <img
                src="/images/products/creamypop-vanilla.webp"
                alt="A tub of Creamypop vanilla ice cream"
                width={733}
                height={553}
                className="aspect-square w-full object-cover"
              />
            </figure>
          </div>
        </div>

        <div className="relative space-y-2">
          <p className="display-campaign-sm text-[clamp(2.6rem,1rem+3.2vw,4.2rem)]">
            Made to <span className="text-[#f4c9a8]">refresh.</span>
          </p>
          <p className="max-w-md text-[0.95rem] text-[#f0d9d4]">
            Sign in to order ZOBOPOP and Creamypop, save your delivery pins and follow every order to your door.
          </p>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link
            to="/"
            aria-label="SCOTCH’s Kitchen home"
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring lg:invisible"
          >
            <KitchenLogo className="h-9" />
          </Link>
          <ThemeToggle />
        </div>
        <main id="main" className="flex flex-1 items-center justify-center px-5 pt-4 pb-16 sm:px-8">
          <div className="w-full max-w-[26rem]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
