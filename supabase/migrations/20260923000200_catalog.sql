-- =============================================================================
-- SCOTCH's Kitchen · 0200 Catalog
-- Brands → products → variants (+ ingredients, images). The storefront reads
-- prices ONLY from product_variants.price_pesewas.
-- =============================================================================

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  tagline text check (tagline is null or char_length(tagline) <= 160),
  description text check (description is null or char_length(description) <= 2000),
  -- Selects a front-end colour scope. Unknown keys fall back to the parent-brand theme.
  theme_key text not null default 'kitchen' check (theme_key ~ '^[a-z0-9-]{1,40}$'),
  logo_url text check (logo_url is null or char_length(logo_url) <= 1024),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.brands is 'Product brands under the SCOTCH''s Kitchen parent brand (ZOBOPOP, Creamypop, future brands).';

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  subtitle text check (subtitle is null or char_length(subtitle) <= 160),
  description text check (description is null or char_length(description) <= 4000),
  product_type text not null default 'OTHER'
    check (product_type in ('DRINK', 'FROZEN_DESSERT', 'FOOD', 'OTHER')),
  -- Storage guidance printed on the official packaging (e.g. "Keep refrigerated").
  storage_note text check (storage_note is null or char_length(storage_note) <= 160),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_brand_idx on public.products (brand_id);

-- Ingredients of a single recipe. They are NOT selectable flavours.
create table public.product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  ingredient_group text not null check (ingredient_group in ('BASE', 'SPICE', 'FRUIT', 'OTHER')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, name)
);
create index product_ingredients_product_idx on public.product_ingredients (product_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  sku text not null unique check (sku ~ '^[A-Z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 80),
  size_label text check (size_label is null or char_length(size_label) <= 40),
  volume_ml integer check (volume_ml is null or volume_ml > 0),
  flavour text check (flavour is null or char_length(flavour) <= 60),
  price_pesewas integer not null check (price_pesewas > 0 and price_pesewas <= 10000000),
  currency text not null default 'GHS' check (currency = 'GHS'),
  track_stock boolean not null default false,
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  is_available boolean not null default true,
  is_active boolean not null default true,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, product_id),
  check (not track_stock or stock_quantity is not null)
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid,
  -- Either an absolute Storage URL or a site-relative path for bundled official photography.
  url text not null check (char_length(url) between 1 and 1024 and (url ~ '^https://' or url ~ '^/')),
  storage_path text check (storage_path is null or char_length(storage_path) <= 512),
  alt_text text not null default '' check (char_length(alt_text) <= 240),
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (variant_id, product_id) references public.product_variants (id, product_id) on delete cascade
);
create index product_images_product_idx on public.product_images (product_id);
create index product_images_variant_idx on public.product_images (variant_id);
create unique index product_images_one_primary_idx
  on public.product_images (product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_primary;

create trigger brands_touch_updated_at before update on public.brands
  for each row execute function private.touch_updated_at();
create trigger products_touch_updated_at before update on public.products
  for each row execute function private.touch_updated_at();
create trigger product_variants_touch_updated_at before update on public.product_variants
  for each row execute function private.touch_updated_at();

-- Audit every catalog change (price, visibility, availability, stock, images...).
create trigger brands_audit after insert or update or delete on public.brands
  for each row execute function private.audit_row_change('brand');
create trigger products_audit after insert or update or delete on public.products
  for each row execute function private.audit_row_change('product');
create trigger product_variants_audit after insert or update or delete on public.product_variants
  for each row execute function private.audit_row_change('product_variant');
create trigger product_images_audit after insert or update or delete on public.product_images
  for each row execute function private.audit_row_change('product_image');
create trigger product_ingredients_audit after insert or update or delete on public.product_ingredients
  for each row execute function private.audit_row_change('product_ingredient');

-- -----------------------------------------------------------------------------
-- Visibility helpers
-- -----------------------------------------------------------------------------
create function private.brand_is_public(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.brands b
    where b.id = p_brand_id and b.is_active and b.is_visible
  );
$$;

create function private.product_is_public(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    join public.brands b on b.id = p.brand_id
    where p.id = p_product_id
      and p.is_active and p.is_visible
      and b.is_active and b.is_visible
  );
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;

create policy "brands: public can read visible"
  on public.brands for select to anon, authenticated
  using (is_active and is_visible);
create policy "brands: admins can read all"
  on public.brands for select to authenticated
  using ((select private.is_admin()));
create policy "brands: admins can insert"
  on public.brands for insert to authenticated
  with check ((select private.is_admin()));
create policy "brands: admins can update"
  on public.brands for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "products: public can read visible"
  on public.products for select to anon, authenticated
  using (is_active and is_visible and private.brand_is_public(brand_id));
create policy "products: admins can read all"
  on public.products for select to authenticated
  using ((select private.is_admin()));
create policy "products: admins can insert"
  on public.products for insert to authenticated
  with check ((select private.is_admin()));
create policy "products: admins can update"
  on public.products for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "product_ingredients: public can read with product"
  on public.product_ingredients for select to anon, authenticated
  using (private.product_is_public(product_id));
create policy "product_ingredients: admins can read all"
  on public.product_ingredients for select to authenticated
  using ((select private.is_admin()));
create policy "product_ingredients: admins can write"
  on public.product_ingredients for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "product_variants: public can read visible"
  on public.product_variants for select to anon, authenticated
  using (is_active and is_visible and private.product_is_public(product_id));
create policy "product_variants: admins can read all"
  on public.product_variants for select to authenticated
  using ((select private.is_admin()));
create policy "product_variants: admins can insert"
  on public.product_variants for insert to authenticated
  with check ((select private.is_admin()));
create policy "product_variants: admins can update"
  on public.product_variants for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "product_images: public can read with product"
  on public.product_images for select to anon, authenticated
  using (private.product_is_public(product_id));
create policy "product_images: admins can read all"
  on public.product_images for select to authenticated
  using ((select private.is_admin()));
create policy "product_images: admins can write"
  on public.product_images for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Brands, products and variants are never hard-deleted from the app: they are
-- deactivated, so historical order_items keep their references.
revoke all on public.brands, public.products, public.product_ingredients,
  public.product_variants, public.product_images from anon, authenticated;

grant select on public.brands, public.products, public.product_ingredients,
  public.product_variants, public.product_images to anon, authenticated;
grant insert, update on public.brands, public.products, public.product_variants to authenticated;
grant insert, update, delete on public.product_ingredients, public.product_images to authenticated;

grant all on public.brands, public.products, public.product_ingredients,
  public.product_variants, public.product_images to service_role;
