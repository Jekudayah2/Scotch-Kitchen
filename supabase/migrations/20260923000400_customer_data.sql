-- =============================================================================
-- SCOTCH's Kitchen · 0400 Customer data: saved delivery locations and carts
-- =============================================================================

create table public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 40),
  address text not null check (char_length(trim(address)) between 3 and 300),
  landmark text check (landmark is null or char_length(landmark) <= 200),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or (accuracy_m >= 0 and accuracy_m <= 100000)),
  delivery_instructions text check (delivery_instructions is null or char_length(delivery_instructions) <= 500),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Null Island is almost always an unset coordinate, never a real address.
  check (not (latitude = 0 and longitude = 0))
);
comment on table public.saved_locations is
  'Reusable delivery locations. Orders copy these values into their own snapshot, so edits here never change past orders.';

create index saved_locations_user_idx on public.saved_locations (user_id);
create unique index saved_locations_one_default_idx on public.saved_locations (user_id) where is_default;

create trigger saved_locations_touch_updated_at before update on public.saved_locations
  for each row execute function private.touch_updated_at();

create function private.limit_saved_locations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.saved_locations where user_id = new.user_id) >= 10 then
    raise exception using errcode = 'P0001', message = 'SAVED_LOCATION_LIMIT',
      detail = 'A customer can keep up to 10 saved locations.';
  end if;
  return new;
end;
$$;

create trigger saved_locations_limit before insert on public.saved_locations
  for each row execute function private.limit_saved_locations();

-- Making one location the default clears the previous default atomically.
create function private.single_default_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_default then
    update public.saved_locations
       set is_default = false
     where user_id = new.user_id
       and id <> new.id
       and is_default;
  end if;
  return new;
end;
$$;

create trigger saved_locations_single_default before insert or update of is_default on public.saved_locations
  for each row when (new.is_default) execute function private.single_default_location();

alter table public.saved_locations enable row level security;

create policy "saved_locations: owner can read"
  on public.saved_locations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "saved_locations: owner can insert"
  on public.saved_locations for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "saved_locations: owner can update"
  on public.saved_locations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "saved_locations: owner can delete"
  on public.saved_locations for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.saved_locations from anon, authenticated;
grant select, insert, update, delete on public.saved_locations to authenticated;
grant all on public.saved_locations to service_role;

-- -----------------------------------------------------------------------------
-- Persistent cart. Stores only variant + quantity; prices are always read live
-- from product_variants, and create_order re-prices everything server-side.
-- -----------------------------------------------------------------------------
create table public.cart_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, variant_id)
);
create index cart_items_variant_idx on public.cart_items (variant_id);

create trigger cart_items_touch_updated_at before update on public.cart_items
  for each row execute function private.touch_updated_at();

alter table public.cart_items enable row level security;

create policy "cart_items: owner can read"
  on public.cart_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy "cart_items: owner can insert"
  on public.cart_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "cart_items: owner can update"
  on public.cart_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "cart_items: owner can delete"
  on public.cart_items for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.cart_items from anon, authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant all on public.cart_items to service_role;
