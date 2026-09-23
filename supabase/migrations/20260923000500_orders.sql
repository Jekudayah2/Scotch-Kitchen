-- =============================================================================
-- SCOTCH's Kitchen · 0500 Orders, payments, delivery-fee history, archival,
-- notifications. All order mutations go through RPCs (see 0600); clients have
-- read-only access filtered by RLS.
-- =============================================================================

create type public.order_status as enum (
  'PENDING', 'PAID', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'
);
create type public.payment_status as enum ('PENDING', 'PAID', 'FAILED');
create type public.payment_attempt_status as enum ('PENDING', 'PAID', 'FAILED', 'ABANDONED', 'SUPERSEDED');

-- -----------------------------------------------------------------------------
-- Archive batches ("Reset Demo / Existing Orders" never hard-deletes)
-- -----------------------------------------------------------------------------
create table public.archive_batches (
  id uuid primary key default gen_random_uuid(),
  reason text check (reason is null or char_length(reason) <= 500),
  order_count integer not null default 0 check (order_count >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique check (order_reference ~ '^SK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6,10}$'),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  idempotency_key uuid not null,

  -- Contact snapshot captured at checkout (email stays in the profile, riders never need it).
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  contact_phone text not null check (private.is_valid_phone(contact_phone)),

  -- Money, in pesewas.
  currency text not null default 'GHS' check (currency = 'GHS'),
  subtotal_pesewas integer not null check (subtotal_pesewas > 0),
  delivery_fee_pesewas integer not null default 0 check (delivery_fee_pesewas between 0 and 1000000),
  delivery_fee_status text not null default 'SET' check (delivery_fee_status in ('SET', 'QUOTE_PENDING')),
  total_pesewas integer not null generated always as (subtotal_pesewas + delivery_fee_pesewas) stored,
  -- Extra delivery money agreed AFTER a completed payment. The paid amount is never rewritten.
  delivery_balance_pesewas integer not null default 0 check (delivery_balance_pesewas between 0 and 1000000),
  delivery_balance_collected_at timestamptz,
  amount_paid_pesewas integer not null default 0 check (amount_paid_pesewas >= 0),
  delivery_fee_set_by uuid references auth.users (id) on delete set null,
  delivery_fee_updated_at timestamptz,
  delivery_fee_note text check (delivery_fee_note is null or char_length(delivery_fee_note) <= 500),

  payment_status public.payment_status not null default 'PENDING',
  order_status public.order_status not null default 'PENDING',

  assigned_rider_id uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz,

  -- Delivery destination snapshot. Independent of saved_locations by design.
  delivery_address text not null check (char_length(delivery_address) between 3 and 300),
  delivery_landmark text check (delivery_landmark is null or char_length(delivery_landmark) <= 200),
  delivery_area text check (delivery_area is null or char_length(delivery_area) <= 120),
  delivery_latitude double precision not null check (delivery_latitude between -90 and 90),
  delivery_longitude double precision not null check (delivery_longitude between -180 and 180),
  delivery_location_accuracy double precision check (
    delivery_location_accuracy is null or (delivery_location_accuracy >= 0 and delivery_location_accuracy <= 100000)
  ),
  delivery_location_source text not null check (delivery_location_source in ('GPS', 'SEARCH', 'MAP', 'SAVED')),
  delivery_instructions text check (delivery_instructions is null or char_length(delivery_instructions) <= 500),
  saved_location_id uuid references public.saved_locations (id) on delete set null,

  -- Immutable item digest written at creation (items never change after checkout).
  item_count integer not null default 0 check (item_count >= 0),
  items_summary text not null default '',
  brand_ids uuid[] not null default '{}',
  product_ids uuid[] not null default '{}',

  paid_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) <= 500),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archive_batch_id uuid references public.archive_batches (id) on delete restrict,

  unique (customer_id, idempotency_key),
  check ((archived_at is null) = (archive_batch_id is null)),
  check (not (delivery_latitude = 0 and delivery_longitude = 0)),
  check (order_status not in ('ASSIGNED', 'OUT_FOR_DELIVERY') or assigned_rider_id is not null),
  check (order_status <> 'DELIVERED' or delivered_at is not null)
);
comment on table public.orders is 'Customer orders. Mutated only through SECURITY DEFINER RPCs that enforce the status machine.';
comment on column public.orders.delivery_balance_pesewas is
  'Additional delivery money owed after payment completed. The original Paystack charge is never modified.';

create index orders_customer_created_idx on public.orders (customer_id, created_at desc);
create index orders_assigned_rider_idx on public.orders (assigned_rider_id) where assigned_rider_id is not null;
create index orders_order_status_idx on public.orders (order_status);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_archived_at_idx on public.orders (archived_at);
create index orders_active_created_idx on public.orders (created_at desc) where archived_at is null;
create index orders_archive_batch_idx on public.orders (archive_batch_id) where archive_batch_id is not null;
create index orders_brand_ids_idx on public.orders using gin (brand_ids);
create index orders_product_ids_idx on public.orders using gin (product_ids);

create trigger orders_touch_updated_at before update on public.orders
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Order items: a price/name snapshot so history survives catalog edits.
-- -----------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  brand_id uuid references public.brands (id) on delete set null,
  brand_name text not null,
  product_name text not null,
  variant_name text not null,
  size_label text,
  flavour text,
  sku text,
  image_url text,
  unit_price_pesewas integer not null check (unit_price_pesewas > 0),
  quantity integer not null check (quantity between 1 and 500),
  line_total_pesewas integer not null generated always as (unit_price_pesewas * quantity) stored,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
create index order_items_brand_idx on public.order_items (brand_id);

-- -----------------------------------------------------------------------------
-- Timeline / status history
-- -----------------------------------------------------------------------------
create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  event text not null check (event in (
    'ORDER_PLACED', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'STATUS_CHANGED', 'RIDER_ASSIGNED',
    'RIDER_UNASSIGNED', 'PICKED_UP', 'DELIVERY_FEE_UPDATED', 'DELIVERY_BALANCE_UPDATED',
    'BALANCE_COLLECTED', 'ARCHIVED'
  )),
  from_status public.order_status,
  to_status public.order_status,
  actor_id uuid references auth.users (id) on delete set null,
  actor_role text not null check (actor_role in ('CUSTOMER', 'ADMIN', 'RIDER', 'SYSTEM')),
  note text check (note is null or char_length(note) <= 500),
  is_customer_visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- -----------------------------------------------------------------------------
-- Admin-only notes live apart from orders so customers and riders never see them.
-- -----------------------------------------------------------------------------
create table public.order_admin_notes (
  order_id uuid primary key references public.orders (id) on delete cascade,
  notes text not null default '' check (char_length(notes) <= 4000),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Delivery fee / balance history, including rider proposals.
-- -----------------------------------------------------------------------------
create table public.delivery_fee_changes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null check (kind in ('DELIVERY_FEE', 'DELIVERY_BALANCE')),
  status text not null check (status in ('APPLIED', 'PROPOSED', 'APPROVED', 'REJECTED')),
  previous_amount_pesewas integer not null check (previous_amount_pesewas >= 0),
  amount_pesewas integer not null check (amount_pesewas between 0 and 1000000),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_by_role text not null check (created_by_role in ('ADMIN', 'RIDER', 'SYSTEM')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index delivery_fee_changes_order_idx on public.delivery_fee_changes (order_id, created_at desc);
create index delivery_fee_changes_proposed_idx on public.delivery_fee_changes (created_at desc) where status = 'PROPOSED';

-- -----------------------------------------------------------------------------
-- Payments (one row per Paystack transaction attempt)
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null default 'PAYSTACK' check (provider in ('PAYSTACK')),
  purpose text not null default 'ORDER' check (purpose in ('ORDER')),
  reference text not null unique check (reference ~ '^[A-Za-z0-9.=-]{8,100}$'),
  amount_pesewas integer not null check (amount_pesewas > 0),
  amount_received_pesewas integer check (amount_received_pesewas is null or amount_received_pesewas >= 0),
  currency text not null default 'GHS' check (currency = 'GHS'),
  status public.payment_attempt_status not null default 'PENDING',
  access_code text,
  authorization_url text check (authorization_url is null or authorization_url ~ '^https://'),
  channel text,
  gateway_response text,
  provider_transaction_id text,
  failure_reason text,
  paid_at timestamptz,
  verified_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.payments is
  'Paystack attempts. Rows reach PAID only through confirm_paystack_payment(), called server-side after verification.';

-- payments.reference is indexed by its UNIQUE constraint.
create index payments_order_idx on public.payments (order_id, created_at desc);
create index payments_status_idx on public.payments (status);
create index payments_created_at_idx on public.payments (created_at desc);

create trigger payments_touch_updated_at before update on public.payments
  for each row execute function private.touch_updated_at();

-- Webhook de-duplication. Only the service role touches this table.
create table public.payment_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null default 'PAYSTACK',
  event_type text not null,
  reference text,
  payload_sha256 text not null unique check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index payment_webhook_events_reference_idx on public.payment_webhook_events (reference);

-- -----------------------------------------------------------------------------
-- In-app notifications (the realtime channel riders, customers and admins watch)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 60),
  title text not null check (char_length(title) between 1 and 160),
  body text check (body is null or char_length(body) <= 500),
  order_id uuid references public.orders (id) on delete cascade,
  link text check (link is null or link ~ '^/'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.archive_batches enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_admin_notes enable row level security;
alter table public.delivery_fee_changes enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.notifications enable row level security;

-- archive_batches
create policy "archive_batches: admins can read"
  on public.archive_batches for select to authenticated
  using ((select private.is_admin()));

-- orders
create policy "orders: customers read own"
  on public.orders for select to authenticated
  using (customer_id = (select auth.uid()));

-- Riders see only orders assigned to them, only while the delivery is live
-- (plus 24 hours after delivery for end-of-shift reconciliation).
create policy "orders: riders read assigned deliveries"
  on public.orders for select to authenticated
  using (
    assigned_rider_id = (select auth.uid())
    and archived_at is null
    and (select private.is_rider())
    and (
      order_status in ('PREPARING', 'ASSIGNED', 'OUT_FOR_DELIVERY')
      or (order_status = 'DELIVERED' and delivered_at > now() - interval '24 hours')
    )
  );

create policy "orders: admins read all"
  on public.orders for select to authenticated
  using ((select private.is_admin()));

-- order_items follow the visibility of their order (the sub-select is itself RLS-filtered).
create policy "order_items: visible with their order"
  on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id));

create policy "order_status_history: admins read all"
  on public.order_status_history for select to authenticated
  using ((select private.is_admin()));
create policy "order_status_history: customer-visible events with their order"
  on public.order_status_history for select to authenticated
  using (
    is_customer_visible
    and exists (select 1 from public.orders o where o.id = order_status_history.order_id)
  );

create policy "order_admin_notes: admins can read"
  on public.order_admin_notes for select to authenticated
  using ((select private.is_admin()));

create policy "delivery_fee_changes: admins read all"
  on public.delivery_fee_changes for select to authenticated
  using ((select private.is_admin()));
create policy "delivery_fee_changes: assigned rider reads own order"
  on public.delivery_fee_changes for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = delivery_fee_changes.order_id
      and o.assigned_rider_id = (select auth.uid())
  ));

create policy "payments: customers read own"
  on public.payments for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = payments.order_id and o.customer_id = (select auth.uid())
  ));
create policy "payments: admins read all"
  on public.payments for select to authenticated
  using ((select private.is_admin()));

-- payment_webhook_events: no policies → no client access at all.

create policy "notifications: owner can read"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: owner can mark read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: owner can delete"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on public.archive_batches, public.orders, public.order_items, public.order_status_history,
  public.order_admin_notes, public.delivery_fee_changes, public.payments, public.payment_webhook_events,
  public.notifications from anon, authenticated;

grant select on public.archive_batches, public.orders, public.order_items, public.order_status_history,
  public.order_admin_notes, public.delivery_fee_changes, public.payments to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant all on public.archive_batches, public.orders, public.order_items, public.order_status_history,
  public.order_admin_notes, public.delivery_fee_changes, public.payments, public.payment_webhook_events,
  public.notifications to service_role;
