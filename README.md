# SCOTCH’s Kitchen

Online ordering, delivery and operations for **SCOTCH’s Kitchen** and its two brands:

- **ZOBOPOP**, the premium hibiscus drink (sobolo): 330ml and 500ml.
- **Creamypop**, the ice cream: Vanilla and Strawberry, 200ml tubs.

One codebase serves three audiences:

| Who | Where | What they do |
| --- | --- | --- |
| Customers | `/`, `/zobopop`, `/creamypop`, `/order`, `/checkout`, `/account` | Browse, fill a bag, drop a delivery pin, pay with Paystack, track the order live, reorder, keep saved places |
| Kitchen (admins) | `/admin` | Run the day: new orders, preparation, riders, delivery fees, products and photos, customers, payments, analytics, settings, archival, audit log |
| Riders | `/rider` | Go available, see assigned drops, get directions, call the customer, start and complete deliveries, collect delivery balances |

Prices, stock and availability always come from the database. Nothing on the storefront (prices, reviews, stock, ETAs, distances) is invented.

---

## Stack

- **Frontend:** React 19, TypeScript, Vite, React Router, Tailwind CSS 4, Motion (Framer Motion), Radix UI, TanStack Query, React Hook Form + Zod, Lucide icons, Sonner toasts, MapLibre GL with OpenFreeMap tiles and OpenStreetMap Nominatim search.
- **Backend:** Supabase: Postgres with Row Level Security everywhere, Auth (email + password, Google), Storage, Realtime, and three Deno Edge Functions for Paystack.
- **Payments:** Paystack hosted checkout, initialised and verified **only on the server**, plus a signed, idempotent webhook.
- **Quality:** Vitest (unit tests in jsdom; database tests against the real migrations in PGlite), ESLint, strict TypeScript, `deno check` for the Edge Functions, and Playwright-driven end-to-end QA scripts.

Fonts: Bricolage Grotesque (SIL Open Font License). The logo is vector artwork generated from Cinzel (SIL OFL) letterforms; see [Brand assets](#brand-assets).

---

## Quick start (no accounts needed): the QA preview

The fastest way to see everything working is the built-in QA preview. It runs the **real SQL migrations** inside the browser (PGlite) and emulates the Supabase API, Auth and the Paystack Edge Functions locally. It exists only in development and is stripped from production builds.

```bash
npm install
npm run dev:qa
```

Open <http://127.0.0.1:5173>. Sign in with any of these (password `Kitchen2026`):

| Account | Roles |
| --- | --- |
| `customer@qa.local` | Customer |
| `admin@qa.local` | Admin + Rider |
| `rider@qa.local` | Rider |

Payments go to a local **Paystack simulator** page (success / declined / cancelled), and the order is still only marked paid after the (emulated) server verification step. Realtime and Storage uploads aren’t emulated: screens fall back to polling, and photo uploads show a clear message.

---

## Setting up for real

### 1. Prerequisites

- Node.js 22.22 or newer (developed on Node 24) and npm.
- A Supabase project (free tier is fine) and the Supabase CLI (`npx supabase ...`).
- A Paystack account (test keys first, then live keys).

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` (everything prefixed `VITE_` is public and bundled into the browser):

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`) | yes | Safe for browsers: RLS protects every table |
| `VITE_SITE_URL` | yes | Public site URL, no trailing slash |
| `VITE_STORE_LATITUDE`, `VITE_STORE_LONGITUDE` | recommended | The kitchen’s pin. **Verify on site before launch.** Until set, maps show no kitchen pin rather than a guess |
| `VITE_STORE_AREA_LABEL` | optional | e.g. `KNUST & Kumasi` |
| `VITE_MAP_STYLE_URL`, `VITE_MAP_STYLE_URL_DARK`, `VITE_MAP_DEFAULT_CENTER`, `VITE_GEOCODER_URL` | optional | Map style, camera default and geocoder overrides |
| `VITE_CONTACT_PHONE`, `VITE_CONTACT_EMAIL`, `VITE_CONTACT_WHATSAPP`, `VITE_INSTAGRAM_URL` | optional | Shown in the footer only when set |

**Never** put the Paystack secret key or the Supabase service-role key in a `VITE_` variable or in `.env.local`. They are server secrets (step 5).

### 3. Database

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This applies `supabase/migrations/` in order: schema, RLS policies, SECURITY DEFINER functions, admin views, storage buckets (`product-images`, `brand-assets`, `avatars`, no SVG), realtime publication, and the starting catalog (ZOBOPOP 330ml GH₵10, 500ml GH₵15; Creamypop Vanilla and Strawberry 200ml GH₵8, with the official photography in `public/images/products`).

To regenerate the TypeScript types after changing the schema: `npm run db:types`.

### 4. Authentication

In Supabase → Authentication:

- **URL configuration:** set the Site URL to your `VITE_SITE_URL`, and add `<site>/auth/callback` and `<site>/reset-password` as redirect URLs.
- **Google:** enable the Google provider with your Google Cloud OAuth client (authorised redirect: `https://<project-ref>.supabase.co/auth/v1/callback`).

Every new account gets the `CUSTOMER` role automatically.

### 5. Paystack (Edge Functions)

```bash
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx SITE_URL=https://your-site ALLOWED_ORIGINS=https://your-site
npx supabase functions deploy paystack-initialize
npx supabase functions deploy paystack-verify
npx supabase functions deploy paystack-webhook --no-verify-jwt
```

Then in the Paystack dashboard → Settings → API Keys & Webhooks, set the webhook URL to:

```
https://<project-ref>.supabase.co/functions/v1/paystack-webhook
```

How payment works: the browser asks `paystack-initialize` to start a transaction for an order; the function prices it from the database, not from the browser. After paying, Paystack redirects to `/checkout/callback`, which asks `paystack-verify` to confirm the transaction with Paystack’s API. The webhook confirms it independently: its HMAC-SHA512 signature is checked, duplicates are ignored, and the transaction is re-verified with Paystack before anything changes. An order is marked **paid** only when Paystack confirms the exact amount and currency.

### 6. Make the owner an admin (one time)

After **jkscotch2004@gmail.com** has signed up, open the Supabase SQL Editor and run [`supabase/bootstrap-owner.sql`](supabase/bootstrap-owner.sql). It grants ADMIN and RIDER through a function that only the service role can call; the browser can never grant roles. Add further admins and riders from **Admin → Settings → Team**.

### 7. Run and deploy

```bash
npm run dev       # against your Supabase project
npm run verify    # typecheck app + functions, lint, all tests, production build
npm run build     # outputs dist/
```

`dist/` is a static single-page app. `vercel.json` and `public/_redirects` + `public/_headers` (Netlify) route every path to `index.html` and add security headers. Remember to add your production URL to the Supabase Auth redirect URLs and to `ALLOWED_ORIGINS`.

---

## How it’s built

### Security model

- **RLS on every table.** Customers read and write only their own profile, cart, saved places, orders and notifications. Riders read only orders assigned to them (and their own completed drops for 24 hours). Admins read everything through `security_invoker` views.
- **Changes go through SECURITY DEFINER functions** with `search_path = ''`, explicit grants, input validation and role checks: `create_order` prices every line itself, and there are functions for order transitions, rider assignment, delivery fees and balances, fee proposals, notes, roles and archival. Frontend role checks only decide what to show.
- **Payments are server-side only.** The secret key never reaches the browser; payment functions are callable only by the service role.
- **Customer coordinates** are visible only to the customer, admins and the assigned rider.
- **Audit log:** append-only (no updates or deletes, not even by admins), with secrets redacted.
- **Abuse limits:** rate limiting on order creation, idempotency keys for checkout, strict limits on quantities, notes and uploads.

### Money, places and time

- Money is stored as integer **pesewas** (GH₵1 = 100 pesewas) and formatted as cedis in one place (`src/utils/money.ts`).
- Coordinates are always `{ latitude, longitude }`. Only `src/utils/geo.ts` converts to MapLibre’s `[lng, lat]`. The database refuses pins outside the service area, which also catches swapped coordinates.
- Delivery location has two slots: a *proposed* pin and a *confirmed* one. Only an explicit “Confirm This Location” can replace the destination.
- Business days and “today” use Africa/Accra time.

### Delivery fees

Admins choose in **Settings → Store**:

- **Confirm per order** (default): the kitchen sets each order’s fee for its pin. If it’s set after the customer has paid, it becomes a **delivery balance** collected on delivery. The amount paid online never changes.
- **Flat fee:** every order pays the same fee at checkout.

Riders may do nothing, **propose** a fee (an admin approves it), or set it directly, per the same settings page.

### Order lifecycle

`PENDING` (awaiting payment) → `PAID` (only by verified Paystack confirmation) → `PREPARING` → `READY` → `ASSIGNED` (rider) → `OUT_FOR_DELIVERY` → `DELIVERED`, with `CANCELLED` (reason required) from any open state. The database enforces the transitions; the UI mirrors them, and a test keeps the two identical.

### Data management

**Admin → Settings → Data management** exports orders to CSV and can **reset orders**: typing `RESET ORDERS` (checked on the server too) archives every current order, removing it from dashboards, maps and analytics. **Nothing is deleted**: archived orders, payments and history remain and can still be exported. Each reset is recorded in the audit log.

---

## Project layout

```
src/
  app.tsx, router.tsx          providers and routes (admin and rider apps are code-split)
  components/brand/            logo (inline SVG, theme-aware gold) and brand wordmarks
  components/ui/               buttons, fields, sheets/dialogs, tabs, feedback states
  features/                    auth, cart, checkout, delivery (location picker), maps,
                               orders, payments, products, storefront, account, admin, rider
  layouts/                     public shell, focused checkout chrome, account, admin, rider
  pages/                       one file per screen
  dev/qa/                      QA preview (PGlite, API/Auth/Functions emulators, Paystack simulator)
supabase/
  migrations/                  schema, RLS, functions, views, storage, seed catalog
  functions/                   paystack-initialize, paystack-verify, paystack-webhook
  bootstrap-owner.sql          one-time owner role grant
tests/                         database tests (PGlite) and Paystack signature tests
scripts/                       QA flows, screenshots, DB type generation, logo build
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run dev:qa` | Dev server against Supabase / the in-browser QA preview |
| `npm run verify` | Typecheck (app + Edge Functions), lint, all tests, production build |
| `npm test`, `npm run test:unit`, `npm run test:db` | All tests / unit only / database only |
| `npm run db:types` | Regenerate `src/types/database.ts` from the migrations |
| `npm run qa:checkout`, `qa:admin`, `qa:rider`, `qa:cart` | End-to-end runs against `npm run dev:qa` (uses installed Microsoft Edge; add `-- --out <folder>`) |
| `npm run qa:shots -- --routes /,/order --widths 1440,390 --schemes light,dark` | Screenshots with overflow and console-error checks |
| `npm run brand:logo` | Rebuild the logo SVGs, favicon and app icons |

## Brand assets

- Official product photography: `public/images/products` (sources in `assets/official-photography`). Packaging is shown exactly as supplied: never redrawn, recoloured or replaced.
- Logo: `public/brand/scotchs-kitchen-logo.svg` (stacked) and `scotchs-kitchen-mark.svg` (emblem), transparent, with no tile or white surround. They are a faithful **vector redraw** of the supplied logo image, built by `scripts/build-logo.ts`. If you have the original vector file, drop it in and point the favicon and `src/components/brand/logo.tsx` at it.
- Favicon: `public/favicon.svg` switches to a deeper gold on light browser tabs. PNG fallbacks and the Apple touch icon are generated by `scripts/rasterize-icons.ts`.

## Before launch checklist

- [ ] Verify the kitchen’s coordinates on site and set `VITE_STORE_LATITUDE` / `VITE_STORE_LONGITUDE`.
- [ ] Set Paystack **live** keys and the webhook URL; run a real low-value payment end to end.
- [ ] Run `supabase/bootstrap-owner.sql` after the owner signs up.
- [ ] Add riders in Admin → Settings → Team.
- [ ] Choose the delivery-fee mode and the rider fee permission in Admin → Settings → Store.
- [ ] Fill in the public contact details, if you want them in the footer.
- [ ] If you tested with real orders, clear them with Admin → Settings → Data management → Reset orders (nothing is deleted).
