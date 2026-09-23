import { Link, Outlet } from 'react-router'
import { KitchenLogo, Watermark } from '@/components/brand/brand-marks'
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
        <Watermark text="SCOTCH’S" className="-bottom-6 -left-6 text-[13rem] [-webkit-text-stroke-color:rgba(255,255,255,0.08)]" />

        <Link to="/" className="relative w-fit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <KitchenLogo tone="light" />
        </Link>

        <div className="relative mx-auto grid w-full max-w-lg grid-cols-5 items-end gap-4 py-10">
          <figure className="col-span-3 -rotate-3 overflow-hidden rounded-4xl shadow-float ring-1 ring-white/10">
            <img
              src="/images/products/zobopop-500ml.webp"
              alt="A bottle of ZOBOPOP premium hibiscus drink"
              width={444}
              height={555}
              className="aspect-[4/5] w-full object-cover"
            />
          </figure>
          <div className="col-span-2 flex flex-col gap-4 pb-6">
            <figure className="rotate-3 overflow-hidden rounded-3xl shadow-float ring-1 ring-white/10">
              <img
                src="/images/products/creamypop-strawberry.jpg"
                alt="A tub of Creamypop strawberry ice cream"
                width={1280}
                height={960}
                className="aspect-square w-full object-cover"
              />
            </figure>
            <figure className="-rotate-2 overflow-hidden rounded-3xl shadow-float ring-1 ring-white/10">
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
          <p className="font-display text-4xl font-extrabold tracking-[-0.03em]">
            Two Ghanaian favourites. <span className="font-serif font-normal italic text-[#f4c9a8]">One kitchen.</span>
          </p>
          <p className="max-w-md text-[0.95rem] text-[#f0d9d4]">
            Sign in to order ZOBOPOP and Creamypop, save your delivery pins and follow every order to your door.
          </p>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring lg:invisible">
            <KitchenLogo />
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
