-- =============================================================================
-- SCOTCH's Kitchen · 0300 Store settings and rate limiting
--
-- Store COORDINATES are deliberately NOT stored here. They are deployment
-- configuration (VITE_STORE_LATITUDE / VITE_STORE_LONGITUDE, and STORE_LATITUDE /
-- STORE_LONGITUDE for server code) and must be verified on site before launch.
-- =============================================================================

create table public.store_settings (
  id boolean primary key default true check (id),
  accepting_orders boolean not null default true,
  -- FLAT: a fixed delivery fee is charged at checkout.
  -- QUOTE: the fee is confirmed per order by the kitchen after it is placed; if the
  --        order is already paid, it becomes a delivery balance collected on delivery.
  delivery_fee_mode text not null default 'QUOTE' check (delivery_fee_mode in ('FLAT', 'QUOTE')),
  flat_delivery_fee_pesewas integer check (flat_delivery_fee_pesewas is null or flat_delivery_fee_pesewas between 0 and 1000000),
  -- What an assigned rider may do with a delivery fee.
  rider_fee_permission text not null default 'PROPOSE' check (rider_fee_permission in ('NONE', 'PROPOSE', 'SET')),
  max_quantity_per_item integer not null default 20 check (max_quantity_per_item between 1 and 500),
  -- Optional message shown in the storefront announcement strip.
  storefront_notice text check (storefront_notice is null or char_length(storefront_notice) <= 200),
  -- Optional delivery bounding box. Orders outside it are rejected, which also
  -- catches latitude/longitude swaps. Seeded with Ghana's national extent.
  service_min_latitude double precision check (service_min_latitude between -90 and 90),
  service_max_latitude double precision check (service_max_latitude between -90 and 90),
  service_min_longitude double precision check (service_min_longitude between -180 and 180),
  service_max_longitude double precision check (service_max_longitude between -180 and 180),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  check (delivery_fee_mode <> 'FLAT' or flat_delivery_fee_pesewas is not null),
  check (
    (service_min_latitude is null and service_max_latitude is null
      and service_min_longitude is null and service_max_longitude is null)
    or (service_min_latitude < service_max_latitude and service_min_longitude < service_max_longitude)
  )
);
comment on table public.store_settings is 'Single-row operational configuration editable by admins.';

insert into public.store_settings (
  id, service_min_latitude, service_max_latitude, service_min_longitude, service_max_longitude
) values (true, 4.5, 11.2, -3.3, 1.3);

create function private.stamp_store_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger store_settings_stamp before update on public.store_settings
  for each row execute function private.stamp_store_settings();
create trigger store_settings_audit after update on public.store_settings
  for each row execute function private.audit_row_change('store_settings');

alter table public.store_settings enable row level security;

create policy "store_settings: anyone can read"
  on public.store_settings for select to anon, authenticated
  using (true);
create policy "store_settings: admins can update"
  on public.store_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

revoke all on public.store_settings from anon, authenticated;
grant select on public.store_settings to anon, authenticated;
grant update (
  accepting_orders, delivery_fee_mode, flat_delivery_fee_pesewas, rider_fee_permission,
  max_quantity_per_item, storefront_notice, service_min_latitude, service_max_latitude,
  service_min_longitude, service_max_longitude
) on public.store_settings to authenticated;
grant all on public.store_settings to service_role;

-- -----------------------------------------------------------------------------
-- Fixed-window rate limiter used by sensitive RPCs.
-- -----------------------------------------------------------------------------
create table private.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

create function private.consume_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_hits integer;
begin
  insert into private.rate_limits as rl (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = rl.hits + 1
  returning hits into v_hits;

  -- Opportunistic cleanup keeps the table small without a scheduler.
  if random() < 0.02 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

-- Best-effort client IP from the PostgREST request headers.
create function private.request_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(split_part(
      coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for', ''),
      ',', 1), ''),
    'unknown'
  );
$$;
