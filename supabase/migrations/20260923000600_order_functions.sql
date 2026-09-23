-- =============================================================================
-- SCOTCH's Kitchen · 0600 Order, delivery and payment functions
--
-- Every order mutation lives here. Each public function:
--   * authenticates via auth.uid() and authorises via user_roles,
--   * locks the order row (FOR UPDATE) before reading its state,
--   * enforces the status machine through private.transition_order(),
--   * writes order_status_history + audit_logs + notifications.
-- Errors are raised with stable codes in the message (e.g. INVALID_TRANSITION)
-- which the front end maps to human copy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Status machine
-- -----------------------------------------------------------------------------
create function private.is_valid_transition(p_from public.order_status, p_to public.order_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from::text, p_to::text) in (
    ('PENDING', 'PAID'),
    ('PENDING', 'CANCELLED'),
    ('PAID', 'PREPARING'),
    ('PAID', 'CANCELLED'),
    ('PREPARING', 'READY'),
    ('PREPARING', 'ASSIGNED'),      -- marked ready while a rider was already assigned
    ('PREPARING', 'CANCELLED'),
    ('READY', 'ASSIGNED'),
    ('READY', 'CANCELLED'),
    ('ASSIGNED', 'READY'),          -- rider unassigned
    ('ASSIGNED', 'OUT_FOR_DELIVERY'),
    ('ASSIGNED', 'CANCELLED'),
    ('OUT_FOR_DELIVERY', 'DELIVERED'),
    ('OUT_FOR_DELIVERY', 'CANCELLED')
  );
$$;

create function private.status_headline(p_status public.order_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'PENDING' then 'Order received'
    when 'PAID' then 'Payment confirmed'
    when 'PREPARING' then 'Your order is being prepared'
    when 'READY' then 'Your order is ready'
    when 'ASSIGNED' then 'A rider has been assigned'
    when 'OUT_FOR_DELIVERY' then 'Your order is on the way'
    when 'DELIVERED' then 'Delivered. Enjoy!'
    when 'CANCELLED' then 'Order cancelled'
  end;
$$;

create function private.format_cedis(p_pesewas integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'GH₵' || case
    when p_pesewas % 100 = 0 then (p_pesewas / 100)::text
    else to_char(p_pesewas / 100.0, 'FM999999990.00')
  end;
$$;

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create function private.notify(
  p_user_id uuid, p_kind text, p_title text, p_body text, p_order_id uuid, p_link text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, order_id, link)
  select p_user_id, p_kind, p_title, left(p_body, 500), p_order_id, p_link
  where p_user_id is not null;
$$;

create function private.notify_admins(
  p_kind text, p_title text, p_body text, p_order_id uuid, p_link text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, order_id, link)
  select ur.user_id, p_kind, p_title, left(p_body, 500), p_order_id, p_link
  from public.user_roles ur
  where ur.role = 'ADMIN';
$$;

create function private.record_order_event(
  p_order_id uuid,
  p_event text,
  p_from public.order_status,
  p_to public.order_status,
  p_actor_role text,
  p_note text,
  p_customer_visible boolean
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.order_status_history
    (order_id, event, from_status, to_status, actor_id, actor_role, note, is_customer_visible)
  values
    (p_order_id, p_event, p_from, p_to, auth.uid(), p_actor_role, left(p_note, 500), p_customer_visible);
$$;

-- -----------------------------------------------------------------------------
-- Payment / stock helpers
-- -----------------------------------------------------------------------------
create function private.supersede_pending_payments(p_order_id uuid, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payments
     set status = 'SUPERSEDED', failure_reason = p_reason
   where order_id = p_order_id
     and status = 'PENDING';
$$;

-- p_direction: -1 when an order is paid, +1 when a paid order is cancelled.
create function private.adjust_stock_for_order(p_order_id uuid, p_direction integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference text;
  v_short text;
begin
  if p_direction not in (-1, 1) then
    raise exception 'p_direction must be -1 or 1';
  end if;

  if p_direction = -1 then
    select string_agg(v.sku, ', ') into v_short
    from public.product_variants v
    join (
      select oi.variant_id, sum(oi.quantity) as qty
      from public.order_items oi
      where oi.order_id = p_order_id and oi.variant_id is not null
      group by oi.variant_id
    ) need on need.variant_id = v.id
    where v.track_stock and v.stock_quantity < need.qty;

    if v_short is not null then
      select order_reference into v_reference from public.orders where id = p_order_id;
      perform private.notify_admins(
        'STOCK_SHORTFALL', 'Stock shortfall',
        format('%s was paid but stock was short for: %s. Please review.', v_reference, v_short),
        p_order_id, '/admin/products'
      );
    end if;
  end if;

  update public.product_variants v
     set stock_quantity = greatest(v.stock_quantity + p_direction * need.qty, 0)
    from (
      select oi.variant_id, sum(oi.quantity)::integer as qty
      from public.order_items oi
      where oi.order_id = p_order_id and oi.variant_id is not null
      group by oi.variant_id
    ) need
   where v.id = need.variant_id
     and v.track_stock;
end;
$$;

-- -----------------------------------------------------------------------------
-- The single place an order changes status.
-- -----------------------------------------------------------------------------
create function private.transition_order(
  p_order public.orders,
  p_to public.order_status,
  p_actor_role text,
  p_note text default null,
  p_audit_action text default 'order.status_changed'
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_from public.order_status := p_order.order_status;
begin
  if not private.is_valid_transition(v_from, p_to) then
    raise exception using errcode = 'P0001', message = 'INVALID_TRANSITION',
      detail = format('Order %s cannot move from %s to %s.', p_order.order_reference, v_from, p_to);
  end if;

  update public.orders o set
    order_status = p_to,
    paid_at = case when p_to = 'PAID' then coalesce(o.paid_at, now()) else o.paid_at end,
    preparing_at = case when p_to = 'PREPARING' then now() else o.preparing_at end,
    ready_at = case
      when p_to = 'READY' or (p_to = 'ASSIGNED' and v_from = 'PREPARING') then coalesce(o.ready_at, now())
      else o.ready_at end,
    picked_up_at = case when p_to = 'OUT_FOR_DELIVERY' then coalesce(o.picked_up_at, now()) else o.picked_up_at end,
    out_for_delivery_at = case when p_to = 'OUT_FOR_DELIVERY' then now() else o.out_for_delivery_at end,
    delivered_at = case when p_to = 'DELIVERED' then now() else o.delivered_at end,
    cancelled_at = case when p_to = 'CANCELLED' then now() else o.cancelled_at end,
    cancellation_reason = case when p_to = 'CANCELLED' then left(p_note, 500) else o.cancellation_reason end
  where o.id = p_order.id
  returning o.* into v_order;

  perform private.record_order_event(
    v_order.id,
    case when p_to = 'PAID' then 'PAYMENT_CONFIRMED' else 'STATUS_CHANGED' end,
    v_from, p_to, p_actor_role, p_note, true
  );

  -- Customer is told about every step of their own order.
  perform private.notify(
    v_order.customer_id, 'ORDER_STATUS', private.status_headline(p_to),
    format('Order %s', v_order.order_reference),
    v_order.id, '/track-order/' || v_order.order_reference
  );

  if p_to = 'PAID' then
    perform private.notify_admins(
      'NEW_PAID_ORDER', 'New paid order',
      format('%s · %s · %s', v_order.order_reference, private.format_cedis(v_order.total_pesewas), v_order.items_summary),
      v_order.id, '/admin/orders?order=' || v_order.id
    );
  end if;

  if v_order.assigned_rider_id is not null then
    if p_to = 'ASSIGNED' and v_from = 'PREPARING' then
      perform private.notify(
        v_order.assigned_rider_id, 'DELIVERY_READY', 'Ready for pickup',
        format('%s is packed and waiting at the kitchen.', v_order.order_reference),
        v_order.id, '/rider/deliveries/' || v_order.id
      );
    elsif p_to = 'CANCELLED' then
      perform private.notify(
        v_order.assigned_rider_id, 'DELIVERY_CANCELLED', 'Delivery cancelled',
        format('%s was cancelled. Do not deliver it.', v_order.order_reference),
        v_order.id, '/rider/deliveries'
      );
    end if;
  end if;

  if p_to = 'CANCELLED' and p_order.payment_status = 'PAID' then
    perform private.adjust_stock_for_order(v_order.id, 1);
    perform private.notify_admins(
      'REFUND_REQUIRED', 'Refund may be required',
      format('%s was cancelled after payment of %s. Refund it from the Paystack dashboard if appropriate.',
        v_order.order_reference, private.format_cedis(v_order.amount_paid_pesewas)),
      v_order.id, '/admin/payments'
    );
  end if;

  perform private.write_audit(
    p_audit_action, 'order', v_order.id::text,
    format('%s: %s → %s', v_order.order_reference, v_from, p_to),
    jsonb_build_object('order_reference', v_order.order_reference, 'from', v_from, 'to', p_to, 'note', p_note),
    p_actor_role
  );

  return v_order;
end;
$$;

-- Shared guard for loading an order that staff will mutate.
create function private.lock_order_for_staff(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'ORDER_ARCHIVED';
  end if;
  return v_order;
end;
$$;

create function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
end;
$$;

-- =============================================================================
-- Customer: create an order (authoritative pricing)
-- =============================================================================
create function public.create_order(
  p_items jsonb,
  p_contact jsonb,
  p_delivery jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_settings public.store_settings;
  v_existing public.orders;
  v_order public.orders;
  v_reference text;
  v_line record;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal integer := 0;
  v_item_count integer := 0;
  v_fee integer := 0;
  v_fee_status text := 'SET';
  v_summary text[] := '{}';
  v_brand_ids uuid[] := '{}';
  v_product_ids uuid[] := '{}';
  v_name text;
  v_phone text;
  v_address text;
  v_landmark text;
  v_area text;
  v_instructions text;
  v_source text;
  v_lat double precision;
  v_lng double precision;
  v_accuracy double precision;
  v_saved_location_id uuid;
  v_uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  -- A retried submission returns the order it already created.
  select * into v_existing from public.orders
   where customer_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'order_id', v_existing.id,
      'order_reference', v_existing.order_reference,
      'subtotal_pesewas', v_existing.subtotal_pesewas,
      'delivery_fee_pesewas', v_existing.delivery_fee_pesewas,
      'delivery_fee_status', v_existing.delivery_fee_status,
      'total_pesewas', v_existing.total_pesewas,
      'replayed', true
    );
  end if;

  if not private.consume_rate_limit('create_order:' || v_uid::text, 10, 600) then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;

  select * into v_settings from public.store_settings where id;
  if not coalesce(v_settings.accepting_orders, false) then
    raise exception using errcode = 'P0001', message = 'STORE_NOT_ACCEPTING_ORDERS';
  end if;

  -- ---- Contact ---------------------------------------------------------------
  if jsonb_typeof(p_contact) is distinct from 'object' then
    raise exception using errcode = 'P0001', message = 'INVALID_CONTACT_NAME';
  end if;
  v_name := nullif(trim(coalesce(p_contact ->> 'name', '')), '');
  v_phone := nullif(trim(coalesce(p_contact ->> 'phone', '')), '');
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception using errcode = 'P0001', message = 'INVALID_CONTACT_NAME';
  end if;
  if v_phone is null or not private.is_valid_phone(v_phone) then
    raise exception using errcode = 'P0001', message = 'INVALID_CONTACT_PHONE';
  end if;

  -- ---- Delivery location (must be an explicitly confirmed pin) ----------------
  if jsonb_typeof(p_delivery) is distinct from 'object' then
    raise exception using errcode = 'P0001', message = 'INVALID_DELIVERY_LOCATION';
  end if;
  if (p_delivery -> 'confirmed') is distinct from 'true'::jsonb then
    raise exception using errcode = 'P0001', message = 'LOCATION_NOT_CONFIRMED';
  end if;
  if jsonb_typeof(p_delivery -> 'latitude') is distinct from 'number'
     or jsonb_typeof(p_delivery -> 'longitude') is distinct from 'number' then
    raise exception using errcode = 'P0001', message = 'INVALID_COORDINATES';
  end if;
  v_lat := (p_delivery ->> 'latitude')::double precision;
  v_lng := (p_delivery ->> 'longitude')::double precision;
  if v_lat < -90 or v_lat > 90 then
    raise exception using errcode = 'P0001', message = 'INVALID_LATITUDE';
  end if;
  if v_lng < -180 or v_lng > 180 then
    raise exception using errcode = 'P0001', message = 'INVALID_LONGITUDE';
  end if;
  if v_lat = 0 and v_lng = 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_COORDINATES';
  end if;
  if v_settings.service_min_latitude is not null and (
       v_lat < v_settings.service_min_latitude or v_lat > v_settings.service_max_latitude
    or v_lng < v_settings.service_min_longitude or v_lng > v_settings.service_max_longitude
  ) then
    raise exception using errcode = 'P0001', message = 'OUTSIDE_SERVICE_AREA';
  end if;

  if jsonb_typeof(p_delivery -> 'accuracy') = 'number' then
    v_accuracy := (p_delivery ->> 'accuracy')::double precision;
    if v_accuracy < 0 or v_accuracy > 100000 then
      raise exception using errcode = 'P0001', message = 'INVALID_ACCURACY';
    end if;
  elsif coalesce(jsonb_typeof(p_delivery -> 'accuracy'), 'null') <> 'null' then
    raise exception using errcode = 'P0001', message = 'INVALID_ACCURACY';
  end if;

  v_source := upper(coalesce(p_delivery ->> 'source', ''));
  if v_source not in ('GPS', 'SEARCH', 'MAP', 'SAVED') then
    raise exception using errcode = 'P0001', message = 'INVALID_LOCATION_SOURCE';
  end if;

  v_address := nullif(trim(coalesce(p_delivery ->> 'address', '')), '');
  if v_address is null or char_length(v_address) < 3 or char_length(v_address) > 300 then
    raise exception using errcode = 'P0001', message = 'INVALID_DELIVERY_ADDRESS';
  end if;
  v_landmark := left(nullif(trim(coalesce(p_delivery ->> 'landmark', '')), ''), 200);
  v_area := left(nullif(trim(coalesce(p_delivery ->> 'area', '')), ''), 120);
  v_instructions := left(nullif(trim(coalesce(p_delivery ->> 'instructions', '')), ''), 500);

  if coalesce(p_delivery ->> 'saved_location_id', '') ~ v_uuid_pattern then
    select sl.id into v_saved_location_id
    from public.saved_locations sl
    where sl.id = (p_delivery ->> 'saved_location_id')::uuid
      and sl.user_id = v_uid;
  end if;

  -- ---- Items: shape first, then authoritative prices from the catalog ---------
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'CART_EMPTY';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception using errcode = 'P0001', message = 'TOO_MANY_ITEMS';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) as e
    where jsonb_typeof(e) is distinct from 'object'
       or jsonb_typeof(e -> 'variant_id') is distinct from 'string'
       or (e ->> 'variant_id') !~ v_uuid_pattern
       or jsonb_typeof(e -> 'quantity') is distinct from 'number'
       or (e ->> 'quantity') !~ '^[0-9]{1,4}$'
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_CART_ITEM';
  end if;

  for v_line in
    select
      agg.variant_id,
      agg.quantity,
      v.sku,
      v.name as variant_name,
      v.size_label,
      v.flavour,
      v.price_pesewas,
      v.track_stock,
      v.stock_quantity,
      coalesce(v.is_active and v.is_visible and v.is_available
        and p.is_active and p.is_visible and b.is_active and b.is_visible, false) as orderable,
      p.id as product_id,
      p.name as product_name,
      b.id as brand_id,
      b.name as brand_name,
      coalesce(
        (select pi.url from public.product_images pi
          where pi.variant_id = v.id
          order by pi.is_primary desc, pi.sort_order limit 1),
        (select pi.url from public.product_images pi
          where pi.product_id = p.id and pi.variant_id is null
          order by pi.is_primary desc, pi.sort_order limit 1)
      ) as image_url
    from (
      select (e ->> 'variant_id')::uuid as variant_id, sum((e ->> 'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) as e
      group by 1
    ) as agg
    left join public.product_variants v on v.id = agg.variant_id
    left join public.products p on p.id = v.product_id
    left join public.brands b on b.id = p.brand_id
    order by b.sort_order nulls last, p.sort_order, v.sort_order
  loop
    if v_line.sku is null or not v_line.orderable then
      raise exception using errcode = 'P0001', message = 'ITEM_UNAVAILABLE', detail = v_line.variant_id::text;
    end if;
    if v_line.quantity < 1 or v_line.quantity > v_settings.max_quantity_per_item then
      raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY',
        detail = format('%s: quantity must be between 1 and %s.', v_line.sku, v_settings.max_quantity_per_item);
    end if;
    if v_line.track_stock and v_line.stock_quantity < v_line.quantity then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK', detail = v_line.sku;
    end if;

    v_subtotal := v_subtotal + v_line.price_pesewas * v_line.quantity;
    v_item_count := v_item_count + v_line.quantity;
    v_lines := v_lines || jsonb_build_array(to_jsonb(v_line));
    v_summary := v_summary || format('%s × %s %s', v_line.quantity, v_line.product_name, v_line.variant_name);
    if not (v_line.brand_id = any (v_brand_ids)) then
      v_brand_ids := v_brand_ids || v_line.brand_id;
    end if;
    if not (v_line.product_id = any (v_product_ids)) then
      v_product_ids := v_product_ids || v_line.product_id;
    end if;
  end loop;

  -- ---- Delivery fee -----------------------------------------------------------
  if v_settings.delivery_fee_mode = 'FLAT' then
    v_fee := coalesce(v_settings.flat_delivery_fee_pesewas, 0);
    v_fee_status := 'SET';
  else
    v_fee := 0;
    v_fee_status := 'QUOTE_PENDING';
  end if;

  loop
    v_reference := 'SK-' || private.random_code(6);
    exit when not exists (select 1 from public.orders where order_reference = v_reference);
  end loop;

  begin
    insert into public.orders (
      order_reference, customer_id, idempotency_key, contact_name, contact_phone,
      subtotal_pesewas, delivery_fee_pesewas, delivery_fee_status,
      delivery_address, delivery_landmark, delivery_area, delivery_latitude, delivery_longitude,
      delivery_location_accuracy, delivery_location_source, delivery_instructions, saved_location_id,
      item_count, items_summary, brand_ids, product_ids
    ) values (
      v_reference, v_uid, p_idempotency_key, v_name, v_phone,
      v_subtotal, v_fee, v_fee_status,
      v_address, v_landmark, v_area, v_lat, v_lng,
      v_accuracy, v_source, v_instructions, v_saved_location_id,
      v_item_count, array_to_string(v_summary, ', '), v_brand_ids, v_product_ids
    )
    returning * into v_order;
  exception when unique_violation then
    select * into v_existing from public.orders
     where customer_id = v_uid and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'order_id', v_existing.id,
        'order_reference', v_existing.order_reference,
        'subtotal_pesewas', v_existing.subtotal_pesewas,
        'delivery_fee_pesewas', v_existing.delivery_fee_pesewas,
        'delivery_fee_status', v_existing.delivery_fee_status,
        'total_pesewas', v_existing.total_pesewas,
        'replayed', true
      );
    end if;
    raise;
  end;

  insert into public.order_items (
    order_id, product_id, variant_id, brand_id, brand_name, product_name, variant_name,
    size_label, flavour, sku, image_url, unit_price_pesewas, quantity
  )
  select
    v_order.id, l.product_id, l.variant_id, l.brand_id, l.brand_name, l.product_name, l.variant_name,
    l.size_label, l.flavour, l.sku, l.image_url, l.price_pesewas, l.quantity
  from jsonb_to_recordset(v_lines) as l(
    product_id uuid, variant_id uuid, brand_id uuid, brand_name text, product_name text,
    variant_name text, size_label text, flavour text, sku text, image_url text,
    price_pesewas integer, quantity integer
  );

  perform private.record_order_event(v_order.id, 'ORDER_PLACED', null, 'PENDING', 'CUSTOMER', null, true);

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_reference', v_order.order_reference,
    'subtotal_pesewas', v_order.subtotal_pesewas,
    'delivery_fee_pesewas', v_order.delivery_fee_pesewas,
    'delivery_fee_status', v_order.delivery_fee_status,
    'total_pesewas', v_order.total_pesewas,
    'replayed', false
  );
end;
$$;

-- =============================================================================
-- Customer: cancel an unpaid order
-- =============================================================================
create function public.customer_cancel_order(p_order_id uuid, p_reason text default null)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.customer_id <> auth.uid() then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.order_status <> 'PENDING' or v_order.payment_status = 'PAID' then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_CANCELLABLE';
  end if;
  perform private.supersede_pending_payments(v_order.id, 'ORDER_CANCELLED');
  return private.transition_order(
    v_order, 'CANCELLED', 'CUSTOMER', coalesce(nullif(trim(p_reason), ''), 'Cancelled by customer')
  );
end;
$$;

-- =============================================================================
-- Admin: move an order through preparation / delivery / cancellation
-- =============================================================================
create function public.admin_update_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_target public.order_status := p_status;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  perform private.require_admin();
  v_order := private.lock_order_for_staff(p_order_id);

  if p_status in ('PENDING', 'PAID') then
    -- Payment state is only ever set by verified Paystack confirmation.
    raise exception using errcode = 'P0001', message = 'STATUS_SET_BY_PAYMENT';
  end if;
  if p_status = 'ASSIGNED' then
    raise exception using errcode = 'P0001', message = 'USE_ASSIGN_RIDER';
  end if;
  if p_status = 'CANCELLED' and v_note is null then
    raise exception using errcode = 'P0001', message = 'CANCELLATION_REASON_REQUIRED';
  end if;

  if p_status = 'READY' and v_order.order_status = 'PREPARING' and v_order.assigned_rider_id is not null then
    v_target := 'ASSIGNED';
  end if;

  if v_target = 'CANCELLED' then
    perform private.supersede_pending_payments(v_order.id, 'ORDER_CANCELLED');
  end if;

  return private.transition_order(
    v_order, v_target, 'ADMIN', v_note,
    case v_target
      when 'OUT_FOR_DELIVERY' then 'delivery.started'
      when 'DELIVERED' then 'delivery.completed'
      when 'CANCELLED' then 'order.cancelled'
      else 'order.status_changed'
    end
  );
end;
$$;

-- =============================================================================
-- Admin: rider assignment
-- =============================================================================
create function public.admin_assign_rider(p_order_id uuid, p_rider_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_previous uuid;
begin
  perform private.require_admin();
  v_order := private.lock_order_for_staff(p_order_id);

  if p_rider_id is null or not private.user_has_role(p_rider_id, 'RIDER') then
    raise exception using errcode = 'P0001', message = 'NOT_A_RIDER';
  end if;
  if v_order.order_status not in ('PREPARING', 'READY', 'ASSIGNED') then
    raise exception using errcode = 'P0001', message = 'CANNOT_ASSIGN_IN_STATUS',
      detail = format('Riders can be assigned while an order is PREPARING, READY or ASSIGNED (it is %s).', v_order.order_status);
  end if;
  if v_order.assigned_rider_id is not distinct from p_rider_id then
    return v_order;
  end if;

  v_previous := v_order.assigned_rider_id;

  update public.orders
     set assigned_rider_id = p_rider_id, assigned_at = now()
   where id = v_order.id
  returning * into v_order;

  perform private.record_order_event(
    v_order.id, 'RIDER_ASSIGNED', null, null, 'ADMIN',
    case when v_previous is null then 'Rider assigned' else 'Rider reassigned' end, false
  );

  if v_order.order_status = 'READY' then
    v_order := private.transition_order(v_order, 'ASSIGNED', 'ADMIN', null);
  end if;

  perform private.notify(
    p_rider_id, 'DELIVERY_ASSIGNED', 'New delivery assigned',
    format('%s · %s', v_order.order_reference, coalesce(v_order.delivery_area, v_order.delivery_address)),
    v_order.id, '/rider/deliveries/' || v_order.id
  );
  if v_previous is not null then
    perform private.notify(
      v_previous, 'DELIVERY_UNASSIGNED', 'Delivery reassigned',
      format('%s has been given to another rider.', v_order.order_reference),
      v_order.id, '/rider/deliveries'
    );
  end if;

  perform private.write_audit(
    'order.rider_assigned', 'order', v_order.id::text,
    format('%s assigned to a rider', v_order.order_reference),
    jsonb_build_object('order_reference', v_order.order_reference, 'rider_id', p_rider_id, 'previous_rider_id', v_previous),
    'ADMIN'
  );
  return v_order;
end;
$$;

create function public.admin_unassign_rider(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_previous uuid;
begin
  perform private.require_admin();
  v_order := private.lock_order_for_staff(p_order_id);

  if v_order.assigned_rider_id is null then
    raise exception using errcode = 'P0001', message = 'NO_RIDER_ASSIGNED';
  end if;
  if v_order.order_status not in ('PREPARING', 'ASSIGNED') then
    raise exception using errcode = 'P0001', message = 'CANNOT_UNASSIGN_IN_STATUS';
  end if;

  v_previous := v_order.assigned_rider_id;
  if v_order.order_status = 'ASSIGNED' then
    v_order := private.transition_order(v_order, 'READY', 'ADMIN', 'Rider unassigned');
  end if;

  update public.orders
     set assigned_rider_id = null, assigned_at = null
   where id = v_order.id
  returning * into v_order;

  perform private.record_order_event(v_order.id, 'RIDER_UNASSIGNED', null, null, 'ADMIN', null, false);
  perform private.notify(
    v_previous, 'DELIVERY_UNASSIGNED', 'Delivery unassigned',
    format('%s is no longer assigned to you.', v_order.order_reference),
    v_order.id, '/rider/deliveries'
  );
  perform private.write_audit(
    'order.rider_unassigned', 'order', v_order.id::text,
    format('%s rider unassigned', v_order.order_reference),
    jsonb_build_object('order_reference', v_order.order_reference, 'previous_rider_id', v_previous),
    'ADMIN'
  );
  return v_order;
end;
$$;

-- =============================================================================
-- Rider: start and complete a delivery
-- =============================================================================
create function private.lock_order_for_rider(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if not private.is_rider() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.assigned_rider_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'NOT_ASSIGNED_TO_YOU';
  end if;
  if v_order.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'ORDER_ARCHIVED';
  end if;
  return v_order;
end;
$$;

create function public.rider_start_delivery(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  v_order := private.lock_order_for_rider(p_order_id);
  if v_order.order_status = 'PREPARING' then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_READY';
  end if;
  if v_order.order_status <> 'ASSIGNED' then
    raise exception using errcode = 'P0001', message = 'INVALID_TRANSITION',
      detail = format('Order %s is %s.', v_order.order_reference, v_order.order_status);
  end if;

  perform private.record_order_event(v_order.id, 'PICKED_UP', null, null, 'RIDER', 'Picked up from the kitchen', true);
  return private.transition_order(v_order, 'OUT_FOR_DELIVERY', 'RIDER', null, 'delivery.started');
end;
$$;

create function public.rider_mark_delivered(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  v_order := private.lock_order_for_rider(p_order_id);
  if v_order.order_status <> 'OUT_FOR_DELIVERY' then
    raise exception using errcode = 'P0001', message = 'INVALID_TRANSITION',
      detail = format('Order %s is %s.', v_order.order_reference, v_order.order_status);
  end if;
  return private.transition_order(v_order, 'DELIVERED', 'RIDER', null, 'delivery.completed');
end;
$$;

-- =============================================================================
-- Delivery fee and delivery balance
-- =============================================================================
create function private.apply_delivery_charge(
  p_order public.orders,
  p_kind text,
  p_amount integer,
  p_note text,
  p_actor_role text,
  p_record_change boolean
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_previous integer;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if p_kind = 'DELIVERY_FEE' then
    if p_order.payment_status = 'PAID' then
      -- Never rewrite a completed Paystack charge.
      raise exception using errcode = 'P0001', message = 'PAID_ORDER_FEE_LOCKED';
    end if;
    v_previous := p_order.delivery_fee_pesewas;
    update public.orders
       set delivery_fee_pesewas = p_amount,
           delivery_fee_status = 'SET',
           delivery_fee_set_by = auth.uid(),
           delivery_fee_updated_at = now(),
           delivery_fee_note = v_note
     where id = p_order.id
    returning * into v_order;

    if v_previous <> p_amount then
      -- Any checkout link issued for the old total is no longer valid.
      perform private.supersede_pending_payments(v_order.id, 'DELIVERY_FEE_CHANGED');
    end if;

    perform private.record_order_event(
      v_order.id, 'DELIVERY_FEE_UPDATED', null, null, p_actor_role,
      format('Delivery fee set to %s', private.format_cedis(p_amount)), true
    );
    perform private.notify(
      v_order.customer_id, 'DELIVERY_FEE', 'Delivery fee confirmed',
      format('%s: delivery is %s, so your total is %s.', v_order.order_reference,
        private.format_cedis(p_amount), private.format_cedis(v_order.total_pesewas)),
      v_order.id, '/track-order/' || v_order.order_reference
    );
    perform private.write_audit(
      'order.delivery_fee_changed', 'order', v_order.id::text,
      format('%s delivery fee %s → %s', v_order.order_reference, private.format_cedis(v_previous), private.format_cedis(p_amount)),
      jsonb_build_object('order_reference', v_order.order_reference, 'old', v_previous, 'new', p_amount, 'note', v_note),
      p_actor_role
    );
  elsif p_kind = 'DELIVERY_BALANCE' then
    v_previous := p_order.delivery_balance_pesewas;
    update public.orders
       set delivery_balance_pesewas = p_amount,
           delivery_balance_collected_at = case
             when p_amount = delivery_balance_pesewas then delivery_balance_collected_at
             else null end,
           delivery_fee_status = 'SET',
           delivery_fee_set_by = auth.uid(),
           delivery_fee_updated_at = now(),
           delivery_fee_note = v_note
     where id = p_order.id
    returning * into v_order;

    perform private.record_order_event(
      v_order.id, 'DELIVERY_BALANCE_UPDATED', null, null, p_actor_role,
      case when p_amount = 0 then 'No delivery balance due'
           else format('Delivery balance of %s to be collected on delivery', private.format_cedis(p_amount)) end,
      true
    );
    perform private.notify(
      v_order.customer_id, 'DELIVERY_BALANCE', 'Delivery balance updated',
      case when p_amount = 0
        then format('%s: nothing extra is due on delivery.', v_order.order_reference)
        else format('%s: a delivery balance of %s will be collected when your order arrives.',
          v_order.order_reference, private.format_cedis(p_amount)) end,
      v_order.id, '/track-order/' || v_order.order_reference
    );
    perform private.write_audit(
      'order.delivery_balance_changed', 'order', v_order.id::text,
      format('%s delivery balance %s → %s', v_order.order_reference, private.format_cedis(v_previous), private.format_cedis(p_amount)),
      jsonb_build_object('order_reference', v_order.order_reference, 'old', v_previous, 'new', p_amount, 'note', v_note),
      p_actor_role
    );
  else
    raise exception 'Unknown delivery charge kind %', p_kind;
  end if;

  if p_record_change then
    insert into public.delivery_fee_changes
      (order_id, kind, status, previous_amount_pesewas, amount_pesewas, note, created_by, created_by_role)
    values
      (v_order.id, p_kind, 'APPLIED', v_previous, p_amount, v_note, auth.uid(), p_actor_role);
  end if;

  return v_order;
end;
$$;

-- Admin (or an assigned rider, when store settings allow) sets the delivery charge.
-- Before payment it changes the delivery fee; after payment it sets a separate balance.
create function public.set_order_delivery_charge(
  p_order_id uuid,
  p_amount_pesewas integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_order public.orders;
  v_permission text;
  v_kind text;
  v_previous integer;
  v_change_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_amount_pesewas is null or p_amount_pesewas < 0 or p_amount_pesewas > 1000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_AMOUNT';
  end if;

  v_is_admin := private.is_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;
  if not v_is_admin and not (private.is_rider() and v_order.assigned_rider_id = v_uid) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if v_order.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'ORDER_ARCHIVED';
  end if;
  if v_order.order_status in ('DELIVERED', 'CANCELLED') then
    raise exception using errcode = 'P0001', message = 'ORDER_CLOSED';
  end if;

  v_kind := case when v_order.payment_status = 'PAID' then 'DELIVERY_BALANCE' else 'DELIVERY_FEE' end;
  v_previous := case when v_kind = 'DELIVERY_BALANCE'
    then v_order.delivery_balance_pesewas else v_order.delivery_fee_pesewas end;

  if not v_is_admin then
    select rider_fee_permission into v_permission from public.store_settings where id;
    if v_permission = 'NONE' then
      raise exception using errcode = '42501', message = 'RIDER_FEE_CHANGES_DISABLED';
    elsif v_permission = 'PROPOSE' then
      insert into public.delivery_fee_changes
        (order_id, kind, status, previous_amount_pesewas, amount_pesewas, note, created_by, created_by_role)
      values
        (v_order.id, v_kind, 'PROPOSED', v_previous, p_amount_pesewas, nullif(trim(coalesce(p_note, '')), ''), v_uid, 'RIDER')
      returning id into v_change_id;

      perform private.notify_admins(
        'FEE_PROPOSAL', 'Delivery fee proposal',
        format('%s: rider proposed a %s of %s.', v_order.order_reference,
          case when v_kind = 'DELIVERY_BALANCE' then 'delivery balance' else 'delivery fee' end,
          private.format_cedis(p_amount_pesewas)),
        v_order.id, '/admin/orders?order=' || v_order.id
      );
      perform private.write_audit(
        'order.delivery_fee_proposed', 'order', v_order.id::text,
        format('%s rider proposed %s', v_order.order_reference, private.format_cedis(p_amount_pesewas)),
        jsonb_build_object('order_reference', v_order.order_reference, 'kind', v_kind,
          'old', v_previous, 'proposed', p_amount_pesewas, 'change_id', v_change_id),
        'RIDER'
      );
      return jsonb_build_object('status', 'PROPOSED', 'kind', v_kind, 'change_id', v_change_id);
    end if;
  end if;

  perform private.apply_delivery_charge(
    v_order, v_kind, p_amount_pesewas, p_note, case when v_is_admin then 'ADMIN' else 'RIDER' end, true
  );
  return jsonb_build_object('status', 'APPLIED', 'kind', v_kind);
end;
$$;

create function public.admin_review_fee_proposal(p_change_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_change public.delivery_fee_changes;
  v_order public.orders;
  v_kind text;
begin
  perform private.require_admin();

  select * into v_change from public.delivery_fee_changes where id = p_change_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PROPOSAL_NOT_FOUND';
  end if;
  if v_change.status <> 'PROPOSED' then
    raise exception using errcode = 'P0001', message = 'PROPOSAL_ALREADY_REVIEWED';
  end if;

  v_order := private.lock_order_for_staff(v_change.order_id);

  if p_approve then
    if v_order.order_status in ('DELIVERED', 'CANCELLED') then
      raise exception using errcode = 'P0001', message = 'ORDER_CLOSED';
    end if;
    -- Payment may have completed since the proposal was made.
    v_kind := case when v_order.payment_status = 'PAID' then 'DELIVERY_BALANCE' else 'DELIVERY_FEE' end;
    perform private.apply_delivery_charge(v_order, v_kind, v_change.amount_pesewas, v_change.note, 'ADMIN', false);
    update public.delivery_fee_changes
       set status = 'APPROVED', kind = v_kind, reviewed_by = auth.uid(), reviewed_at = now()
     where id = v_change.id;
  else
    update public.delivery_fee_changes
       set status = 'REJECTED', reviewed_by = auth.uid(), reviewed_at = now()
     where id = v_change.id;
  end if;

  perform private.notify(
    v_change.created_by, 'FEE_PROPOSAL_REVIEWED',
    case when p_approve then 'Fee proposal approved' else 'Fee proposal declined' end,
    format('%s: %s', v_order.order_reference, private.format_cedis(v_change.amount_pesewas)),
    v_order.id, '/rider/deliveries/' || v_order.id
  );
  perform private.write_audit(
    'order.delivery_fee_proposal_reviewed', 'order', v_order.id::text,
    format('%s fee proposal %s', v_order.order_reference, case when p_approve then 'approved' else 'rejected' end),
    jsonb_build_object('order_reference', v_order.order_reference, 'change_id', v_change.id,
      'approved', p_approve, 'amount', v_change.amount_pesewas),
    'ADMIN'
  );
  return jsonb_build_object('status', case when p_approve then 'APPROVED' else 'REJECTED' end);
end;
$$;

create function public.mark_delivery_balance_collected(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_order public.orders;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  v_is_admin := private.is_admin();
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;
  if not v_is_admin and not (private.is_rider() and v_order.assigned_rider_id = v_uid) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if v_order.delivery_balance_pesewas <= 0 then
    raise exception using errcode = 'P0001', message = 'NO_BALANCE_DUE';
  end if;
  if v_order.delivery_balance_collected_at is not null then
    return v_order;
  end if;

  update public.orders set delivery_balance_collected_at = now()
   where id = v_order.id
  returning * into v_order;

  perform private.record_order_event(
    v_order.id, 'BALANCE_COLLECTED', null, null,
    case when v_is_admin then 'ADMIN' else 'RIDER' end,
    format('Delivery balance of %s collected', private.format_cedis(v_order.delivery_balance_pesewas)), true
  );
  perform private.write_audit(
    'order.balance_collected', 'order', v_order.id::text,
    format('%s balance %s collected', v_order.order_reference, private.format_cedis(v_order.delivery_balance_pesewas)),
    jsonb_build_object('order_reference', v_order.order_reference, 'amount', v_order.delivery_balance_pesewas),
    case when v_is_admin then 'ADMIN' else 'RIDER' end
  );
  return v_order;
end;
$$;

-- =============================================================================
-- Admin notes
-- =============================================================================
create function public.admin_set_order_notes(p_order_id uuid, p_notes text)
returns public.order_admin_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.order_admin_notes;
  v_reference text;
begin
  perform private.require_admin();
  select order_reference into v_reference from public.orders where id = p_order_id;
  if v_reference is null then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;
  if char_length(coalesce(p_notes, '')) > 4000 then
    raise exception using errcode = 'P0001', message = 'NOTES_TOO_LONG';
  end if;

  insert into public.order_admin_notes (order_id, notes, updated_by, updated_at)
  values (p_order_id, coalesce(p_notes, ''), auth.uid(), now())
  on conflict (order_id) do update
    set notes = excluded.notes, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  returning * into v_row;

  perform private.write_audit(
    'order.notes_updated', 'order', p_order_id::text,
    format('%s admin notes updated', v_reference),
    jsonb_build_object('order_reference', v_reference, 'length', char_length(coalesce(p_notes, ''))),
    'ADMIN'
  );
  return v_row;
end;
$$;

-- =============================================================================
-- Rider availability (always a human decision)
-- =============================================================================
create function public.set_rider_availability(
  p_availability public.rider_availability,
  p_rider_id uuid default null
)
returns public.rider_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid := coalesce(p_rider_id, auth.uid());
  v_row public.rider_profiles;
  v_old public.rider_availability;
  v_actor text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if v_target = v_uid and private.is_rider() then
    v_actor := 'RIDER';
  elsif private.is_admin() then
    v_actor := 'ADMIN';
  else
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if not private.user_has_role(v_target, 'RIDER') then
    raise exception using errcode = 'P0001', message = 'NOT_A_RIDER';
  end if;

  select availability into v_old from public.rider_profiles where user_id = v_target;

  insert into public.rider_profiles (user_id, availability, availability_updated_at)
  values (v_target, p_availability, now())
  on conflict (user_id) do update
    set availability = excluded.availability, availability_updated_at = now()
  returning * into v_row;

  if v_old is distinct from p_availability then
    perform private.write_audit(
      'rider.availability_changed', 'rider', v_target::text,
      format('Availability %s → %s', coalesce(v_old::text, 'none'), p_availability),
      jsonb_build_object('old', v_old, 'new', p_availability),
      v_actor
    );
  end if;
  return v_row;
end;
$$;

-- =============================================================================
-- Admin: role management (adding riders / admins after bootstrap)
-- =============================================================================
create function public.admin_grant_role(p_email text, p_role public.app_role)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_profile public.profiles;
begin
  perform private.require_admin();
  if p_role = 'CUSTOMER' then
    raise exception using errcode = 'P0001', message = 'ROLE_NOT_GRANTABLE';
  end if;

  select u.id into v_user_id from auth.users u where lower(u.email) = lower(trim(coalesce(p_email, '')));
  if v_user_id is null then
    raise exception using errcode = 'P0002', message = 'USER_NOT_FOUND';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (v_user_id, p_role, auth.uid())
  on conflict do nothing;

  select * into v_profile from public.profiles where id = v_user_id;
  perform private.write_audit(
    'role.granted', 'user', v_user_id::text,
    format('%s granted to %s', p_role, coalesce(v_profile.full_name, v_profile.email)),
    jsonb_build_object('role', p_role),
    'ADMIN'
  );
  return jsonb_build_object('user_id', v_user_id, 'full_name', v_profile.full_name, 'email', v_profile.email, 'role', p_role);
end;
$$;

create function public.admin_revoke_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_role = 'CUSTOMER' then
    raise exception using errcode = 'P0001', message = 'ROLE_NOT_GRANTABLE';
  end if;
  if p_role = 'ADMIN' then
    if p_user_id = auth.uid() then
      raise exception using errcode = 'P0001', message = 'CANNOT_REVOKE_OWN_ADMIN';
    end if;
    if (select count(*) from public.user_roles where role = 'ADMIN') <= 1 then
      raise exception using errcode = 'P0001', message = 'LAST_ADMIN';
    end if;
  end if;
  if p_role = 'RIDER' and exists (
    select 1 from public.orders
    where assigned_rider_id = p_user_id
      and archived_at is null
      and order_status in ('PREPARING', 'ASSIGNED', 'OUT_FOR_DELIVERY')
  ) then
    raise exception using errcode = 'P0001', message = 'RIDER_HAS_ACTIVE_DELIVERIES';
  end if;

  delete from public.user_roles where user_id = p_user_id and role = p_role;
  if found then
    perform private.write_audit(
      'role.revoked', 'user', p_user_id::text, format('%s revoked', p_role),
      jsonb_build_object('role', p_role), 'ADMIN'
    );
  end if;
end;
$$;

-- =============================================================================
-- Public order tracking (reference + checkout phone). Returns NO address,
-- coordinates, names, phone numbers or amounts.
-- =============================================================================
create function public.track_order_public(p_reference text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_reference text := upper(trim(coalesce(p_reference, '')));
  v_phone_key text := private.phone_fingerprint(p_phone);
begin
  if not private.consume_rate_limit('track:' || private.request_ip(), 30, 600) then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;
  if v_reference !~ '^SK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6,10}$' or v_phone_key !~ '^[0-9]{9}$' then
    return null;
  end if;

  select * into v_order from public.orders where order_reference = v_reference;
  if not found or private.phone_fingerprint(v_order.contact_phone) <> v_phone_key then
    return null;
  end if;

  return jsonb_build_object(
    'order_reference', v_order.order_reference,
    'order_status', v_order.order_status,
    'payment_status', v_order.payment_status,
    'item_count', v_order.item_count,
    'created_at', v_order.created_at,
    'paid_at', v_order.paid_at,
    'preparing_at', v_order.preparing_at,
    'ready_at', v_order.ready_at,
    'out_for_delivery_at', v_order.out_for_delivery_at,
    'delivered_at', v_order.delivered_at,
    'cancelled_at', v_order.cancelled_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', oi.product_name, 'variant_name', oi.variant_name, 'quantity', oi.quantity
      ) order by oi.created_at, oi.id)
      from public.order_items oi where oi.order_id = v_order.id
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event', h.event, 'to_status', h.to_status, 'created_at', h.created_at
      ) order by h.created_at, h.id)
      from public.order_status_history h
      where h.order_id = v_order.id and h.is_customer_visible
    ), '[]'::jsonb)
  );
end;
$$;

-- =============================================================================
-- Payments (SERVICE ROLE ONLY — called by the Paystack Edge Functions)
-- =============================================================================
create function public.begin_payment_attempt(p_order_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_email text;
  v_payment public.payments;
  v_recent integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.customer_id is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND');
  end if;
  if v_order.archived_at is not null then
    return jsonb_build_object('ok', false, 'error', 'ORDER_ARCHIVED');
  end if;
  if v_order.payment_status = 'PAID' then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_PAID', 'order_reference', v_order.order_reference);
  end if;
  if v_order.order_status <> 'PENDING' then
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_PAYABLE');
  end if;

  select u.email into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    return jsonb_build_object('ok', false, 'error', 'EMAIL_REQUIRED');
  end if;

  -- Reuse a fresh checkout link for the same amount instead of creating duplicates.
  select * into v_payment
  from public.payments
  where order_id = v_order.id
    and status = 'PENDING'
    and amount_pesewas = v_order.total_pesewas
    and authorization_url is not null
    and created_at > now() - interval '25 minutes'
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true, 'reused', true, 'payment_id', v_payment.id, 'reference', v_payment.reference,
      'amount_pesewas', v_payment.amount_pesewas, 'currency', v_payment.currency, 'email', v_email,
      'authorization_url', v_payment.authorization_url, 'access_code', v_payment.access_code,
      'order_reference', v_order.order_reference
    );
  end if;

  select count(*) into v_recent
  from public.payments
  where order_id = v_order.id and created_at > now() - interval '1 hour';
  if v_recent >= 8 then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;

  perform private.supersede_pending_payments(v_order.id, 'NEW_ATTEMPT');

  insert into public.payments (order_id, reference, amount_pesewas, currency, status, created_by)
  values (
    v_order.id,
    'SKP-' || substr(v_order.order_reference, 4) || '-' || private.random_code(8),
    v_order.total_pesewas,
    v_order.currency,
    'PENDING',
    p_user_id
  )
  returning * into v_payment;

  update public.orders set payment_status = 'PENDING'
   where id = v_order.id and payment_status = 'FAILED';

  return jsonb_build_object(
    'ok', true, 'reused', false, 'payment_id', v_payment.id, 'reference', v_payment.reference,
    'amount_pesewas', v_payment.amount_pesewas, 'currency', v_payment.currency, 'email', v_email,
    'order_reference', v_order.order_reference
  );
end;
$$;

create function public.attach_payment_authorization(
  p_payment_id uuid,
  p_access_code text,
  p_authorization_url text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payments
     set access_code = left(p_access_code, 200),
         authorization_url = case when p_authorization_url ~ '^https://' then left(p_authorization_url, 500) end
   where id = p_payment_id
     and status = 'PENDING';
$$;

create function public.confirm_paystack_payment(
  p_reference text,
  p_amount_pesewas integer,
  p_currency text,
  p_paid_at timestamptz,
  p_channel text,
  p_gateway_response text,
  p_transaction_id text,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_order public.orders;
begin
  select * into v_payment from public.payments where reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_FOUND');
  end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;

  -- Idempotent: webhook + browser verification may both arrive.
  if v_payment.status = 'PAID' then
    return jsonb_build_object(
      'ok', true, 'already_processed', true, 'order_id', v_order.id,
      'order_reference', v_order.order_reference, 'order_status', v_order.order_status,
      'payment_status', v_order.payment_status
    );
  end if;

  if upper(coalesce(p_currency, '')) <> v_payment.currency
     or p_amount_pesewas is distinct from v_payment.amount_pesewas then
    update public.payments
       set status = 'FAILED',
           amount_received_pesewas = p_amount_pesewas,
           failure_reason = 'AMOUNT_OR_CURRENCY_MISMATCH',
           verified_at = now(),
           gateway_response = left(p_gateway_response, 200),
           provider_transaction_id = left(p_transaction_id, 64)
     where id = v_payment.id;
    perform private.notify_admins(
      'PAYMENT_REVIEW', 'Payment needs review',
      format('%s: Paystack reported %s %s but %s was expected (ref %s).', v_order.order_reference,
        coalesce(p_currency, '?'), coalesce(p_amount_pesewas::text, '?'),
        private.format_cedis(v_payment.amount_pesewas), p_reference),
      v_order.id, '/admin/payments'
    );
    perform private.write_audit(
      'payment.mismatch', 'payment', v_payment.id::text,
      format('%s amount/currency mismatch', v_order.order_reference),
      jsonb_build_object('reference', p_reference, 'expected', v_payment.amount_pesewas,
        'received', p_amount_pesewas, 'currency', p_currency, 'source', p_source),
      'SYSTEM'
    );
    return jsonb_build_object('ok', false, 'error', 'AMOUNT_MISMATCH', 'order_reference', v_order.order_reference);
  end if;

  update public.payments
     set status = 'PAID',
         amount_received_pesewas = p_amount_pesewas,
         paid_at = coalesce(p_paid_at, now()),
         verified_at = now(),
         channel = left(p_channel, 40),
         gateway_response = left(p_gateway_response, 200),
         provider_transaction_id = left(p_transaction_id, 64),
         failure_reason = null
   where id = v_payment.id;

  update public.orders
     set amount_paid_pesewas = amount_paid_pesewas + p_amount_pesewas
   where id = v_order.id
  returning * into v_order;

  if v_order.amount_paid_pesewas >= v_order.total_pesewas then
    update public.orders
       set payment_status = 'PAID', paid_at = coalesce(paid_at, p_paid_at, now())
     where id = v_order.id
    returning * into v_order;

    if v_order.order_status = 'PENDING' then
      v_order := private.transition_order(v_order, 'PAID', 'SYSTEM', null, 'order.payment_confirmed');
      perform private.adjust_stock_for_order(v_order.id, -1);
    elsif v_order.order_status = 'CANCELLED' then
      perform private.notify_admins(
        'REFUND_REQUIRED', 'Payment received for a cancelled order',
        format('%s was cancelled before %s arrived (ref %s). Refund it from the Paystack dashboard.',
          v_order.order_reference, private.format_cedis(p_amount_pesewas), p_reference),
        v_order.id, '/admin/payments'
      );
    end if;
  else
    perform private.notify_admins(
      'PAYMENT_REVIEW', 'Partial payment received',
      format('%s: received %s of %s. The delivery fee may have changed during checkout.',
        v_order.order_reference, private.format_cedis(v_order.amount_paid_pesewas),
        private.format_cedis(v_order.total_pesewas)),
      v_order.id, '/admin/payments'
    );
  end if;

  perform private.write_audit(
    'payment.verified', 'payment', v_payment.id::text,
    format('%s paid %s via Paystack', v_order.order_reference, private.format_cedis(p_amount_pesewas)),
    jsonb_build_object('order_reference', v_order.order_reference, 'reference', p_reference,
      'amount', p_amount_pesewas, 'channel', p_channel, 'source', p_source),
    'SYSTEM'
  );

  return jsonb_build_object(
    'ok', true, 'already_processed', false, 'order_id', v_order.id,
    'order_reference', v_order.order_reference, 'order_status', v_order.order_status,
    'payment_status', v_order.payment_status
  );
end;
$$;

create function public.record_payment_failure(p_reference text, p_status text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  if p_status not in ('FAILED', 'ABANDONED') then
    raise exception 'p_status must be FAILED or ABANDONED';
  end if;
  select * into v_payment from public.payments where reference = p_reference for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_FOUND');
  end if;
  if v_payment.status <> 'PENDING' then
    return jsonb_build_object('ok', true, 'unchanged', true, 'status', v_payment.status);
  end if;

  update public.payments
     set status = p_status::public.payment_attempt_status,
         failure_reason = left(p_reason, 200),
         verified_at = now()
   where id = v_payment.id;

  update public.orders o
     set payment_status = 'FAILED'
   where o.id = v_payment.order_id
     and o.payment_status = 'PENDING'
     and not exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'PENDING');

  if p_status = 'FAILED' then
    insert into public.order_status_history (order_id, event, actor_role, note, is_customer_visible)
    values (v_payment.order_id, 'PAYMENT_FAILED', 'SYSTEM', left(p_reason, 200), true);
  end if;

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- =============================================================================
-- Dashboards for customers and riders
-- =============================================================================
create function public.account_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  return jsonb_build_object(
    'active_orders', (
      select count(*) from public.orders
      where customer_id = v_uid and archived_at is null
        and order_status not in ('DELIVERED', 'CANCELLED')
    ),
    'completed_orders', (
      select count(*) from public.orders
      where customer_id = v_uid and order_status = 'DELIVERED'
    ),
    'saved_locations', (
      select count(*) from public.saved_locations where user_id = v_uid
    )
  );
end;
$$;

create function public.rider_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Accra')::date;
begin
  if v_uid is null or not private.is_rider() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  return (
    select jsonb_build_object(
      'assigned', count(*) filter (where o.order_status in ('PREPARING', 'ASSIGNED', 'OUT_FOR_DELIVERY')),
      'ready_for_pickup', count(*) filter (where o.order_status = 'ASSIGNED'),
      'out_for_delivery', count(*) filter (where o.order_status = 'OUT_FOR_DELIVERY'),
      'completed_today', count(*) filter (
        where o.order_status = 'DELIVERED' and (o.delivered_at at time zone 'Africa/Accra')::date = v_today
      )
    )
    from public.orders o
    where o.assigned_rider_id = v_uid and o.archived_at is null
  );
end;
$$;

create function public.rider_delivery_history(p_limit integer default 20, p_offset integer default 0)
returns table (
  order_id uuid,
  order_reference text,
  customer_first_name text,
  delivery_area text,
  delivery_fee_pesewas integer,
  delivery_balance_pesewas integer,
  order_status public.order_status,
  assigned_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_rider() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  return query
    select
      o.id,
      o.order_reference,
      split_part(o.contact_name, ' ', 1),
      o.delivery_area,
      o.delivery_fee_pesewas,
      o.delivery_balance_pesewas,
      o.order_status,
      o.assigned_at,
      o.delivered_at,
      o.cancelled_at,
      count(*) over ()
    from public.orders o
    where o.assigned_rider_id = auth.uid()
      and o.archived_at is null
      and o.order_status in ('DELIVERED', 'CANCELLED')
    order by coalesce(o.delivered_at, o.cancelled_at) desc nulls last
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =============================================================================
-- Function privileges
-- =============================================================================
-- Signed-in users (each function performs its own role checks).
revoke all on function public.create_order(jsonb, jsonb, jsonb, uuid) from public, anon;
revoke all on function public.customer_cancel_order(uuid, text) from public, anon;
revoke all on function public.admin_update_order_status(uuid, public.order_status, text) from public, anon;
revoke all on function public.admin_assign_rider(uuid, uuid) from public, anon;
revoke all on function public.admin_unassign_rider(uuid) from public, anon;
revoke all on function public.rider_start_delivery(uuid) from public, anon;
revoke all on function public.rider_mark_delivered(uuid) from public, anon;
revoke all on function public.set_order_delivery_charge(uuid, integer, text) from public, anon;
revoke all on function public.admin_review_fee_proposal(uuid, boolean) from public, anon;
revoke all on function public.mark_delivery_balance_collected(uuid) from public, anon;
revoke all on function public.admin_set_order_notes(uuid, text) from public, anon;
revoke all on function public.set_rider_availability(public.rider_availability, uuid) from public, anon;
revoke all on function public.admin_grant_role(text, public.app_role) from public, anon;
revoke all on function public.admin_revoke_role(uuid, public.app_role) from public, anon;
revoke all on function public.account_summary() from public, anon;
revoke all on function public.rider_summary() from public, anon;
revoke all on function public.rider_delivery_history(integer, integer) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;

grant execute on function public.create_order(jsonb, jsonb, jsonb, uuid) to authenticated;
grant execute on function public.customer_cancel_order(uuid, text) to authenticated;
grant execute on function public.admin_update_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.admin_assign_rider(uuid, uuid) to authenticated;
grant execute on function public.admin_unassign_rider(uuid) to authenticated;
grant execute on function public.rider_start_delivery(uuid) to authenticated;
grant execute on function public.rider_mark_delivered(uuid) to authenticated;
grant execute on function public.set_order_delivery_charge(uuid, integer, text) to authenticated;
grant execute on function public.admin_review_fee_proposal(uuid, boolean) to authenticated;
grant execute on function public.mark_delivery_balance_collected(uuid) to authenticated;
grant execute on function public.admin_set_order_notes(uuid, text) to authenticated;
grant execute on function public.set_rider_availability(public.rider_availability, uuid) to authenticated;
grant execute on function public.admin_grant_role(text, public.app_role) to authenticated;
grant execute on function public.admin_revoke_role(uuid, public.app_role) to authenticated;
grant execute on function public.account_summary() to authenticated;
grant execute on function public.rider_summary() to authenticated;
grant execute on function public.rider_delivery_history(integer, integer) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Anyone (rate-limited, returns no personal data).
revoke all on function public.track_order_public(text, text) from public;
grant execute on function public.track_order_public(text, text) to anon, authenticated;

-- Service role only (Paystack Edge Functions).
revoke all on function public.begin_payment_attempt(uuid, uuid) from public, anon, authenticated;
revoke all on function public.attach_payment_authorization(uuid, text, text) from public, anon, authenticated;
revoke all on function public.confirm_paystack_payment(text, integer, text, timestamptz, text, text, text, text) from public, anon, authenticated;
revoke all on function public.record_payment_failure(text, text, text) from public, anon, authenticated;
grant execute on function public.begin_payment_attempt(uuid, uuid) to service_role;
grant execute on function public.attach_payment_authorization(uuid, text, text) to service_role;
grant execute on function public.confirm_paystack_payment(text, integer, text, timestamptz, text, text, text, text) to service_role;
grant execute on function public.record_payment_failure(text, text, text) to service_role;
