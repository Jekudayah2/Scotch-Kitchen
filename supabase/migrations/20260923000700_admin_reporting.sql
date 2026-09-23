-- =============================================================================
-- SCOTCH's Kitchen · 0700 Admin read models, metrics, analytics and archival
--
-- Views use security_invoker, so the caller's RLS applies: admins see
-- everything, anyone else sees at most their own rows. Metric functions check
-- the ADMIN role explicitly and exclude archived orders from every number.
-- =============================================================================

create view public.admin_order_list
with (security_invoker = true) as
select
  o.id,
  o.order_reference,
  o.customer_id,
  o.contact_name,
  o.contact_phone,
  c.email as customer_email,
  c.full_name as customer_account_name,
  o.subtotal_pesewas,
  o.delivery_fee_pesewas,
  o.delivery_fee_status,
  o.total_pesewas,
  o.delivery_balance_pesewas,
  o.delivery_balance_collected_at,
  o.amount_paid_pesewas,
  o.payment_status,
  o.order_status,
  o.assigned_rider_id,
  r.full_name as rider_name,
  r.phone as rider_phone,
  o.assigned_at,
  o.delivery_address,
  o.delivery_landmark,
  o.delivery_area,
  o.delivery_latitude,
  o.delivery_longitude,
  o.delivery_location_accuracy,
  o.delivery_location_source,
  o.delivery_instructions,
  o.item_count,
  o.items_summary,
  o.brand_ids,
  o.product_ids,
  o.paid_at,
  o.delivered_at,
  o.cancelled_at,
  o.created_at,
  o.updated_at,
  o.archived_at,
  o.archive_batch_id,
  lower(concat_ws(' ', o.order_reference, o.contact_name, o.contact_phone, c.email,
    c.full_name, o.items_summary, r.full_name, o.delivery_area)) as search_text
from public.orders o
left join public.profiles c on c.id = o.customer_id
left join public.profiles r on r.id = o.assigned_rider_id;

create view public.admin_customer_list
with (security_invoker = true) as
select
  p.id,
  p.full_name,
  p.email,
  p.phone,
  p.created_at,
  coalesce(s.total_orders, 0) as total_orders,
  s.last_order_at,
  coalesce(s.total_paid_pesewas, 0) as total_paid_pesewas,
  lower(concat_ws(' ', p.full_name, p.email, p.phone)) as search_text
from public.profiles p
join public.user_roles ur on ur.user_id = p.id and ur.role = 'CUSTOMER'
left join lateral (
  select
    count(*)::integer as total_orders,
    max(o.created_at) as last_order_at,
    coalesce(sum(o.amount_paid_pesewas) filter (where o.payment_status = 'PAID'), 0)::bigint as total_paid_pesewas
  from public.orders o
  where o.customer_id = p.id and o.archived_at is null
) s on true;

create view public.admin_rider_list
with (security_invoker = true) as
select
  p.id,
  p.full_name,
  p.email,
  p.phone,
  coalesce(rp.availability, 'OFFLINE'::public.rider_availability) as availability,
  rp.availability_updated_at,
  ur.created_at as rider_since,
  (
    select count(*)::integer from public.orders o
    where o.assigned_rider_id = p.id and o.archived_at is null
      and o.order_status = 'DELIVERED'
      and (o.delivered_at at time zone 'Africa/Accra')::date = (now() at time zone 'Africa/Accra')::date
  ) as delivered_today,
  (
    select count(*)::integer from public.orders o
    where o.assigned_rider_id = p.id and o.archived_at is null
      and o.order_status in ('PREPARING', 'ASSIGNED', 'OUT_FOR_DELIVERY')
  ) as active_deliveries,
  (
    select count(*)::integer from public.orders o
    where o.assigned_rider_id = p.id and o.archived_at is null and o.order_status = 'DELIVERED'
  ) as completed_deliveries,
  (
    select o.order_reference from public.orders o
    where o.assigned_rider_id = p.id and o.archived_at is null and o.order_status = 'OUT_FOR_DELIVERY'
    order by o.out_for_delivery_at desc nulls last
    limit 1
  ) as current_delivery_reference
from public.user_roles ur
join public.profiles p on p.id = ur.user_id
left join public.rider_profiles rp on rp.user_id = ur.user_id
where ur.role = 'RIDER';

create view public.admin_payment_list
with (security_invoker = true) as
select
  pay.id,
  pay.reference,
  pay.provider,
  pay.status,
  pay.amount_pesewas,
  pay.amount_received_pesewas,
  pay.currency,
  pay.channel,
  pay.gateway_response,
  pay.failure_reason,
  pay.paid_at,
  pay.verified_at,
  pay.created_at,
  o.id as order_id,
  o.order_reference,
  o.subtotal_pesewas,
  o.delivery_fee_pesewas,
  o.delivery_balance_pesewas,
  o.order_status,
  o.archived_at as order_archived_at,
  o.contact_name as customer_name,
  c.email as customer_email,
  lower(concat_ws(' ', pay.reference, o.order_reference, o.contact_name, c.email)) as search_text
from public.payments pay
join public.orders o on o.id = pay.order_id
left join public.profiles c on c.id = o.customer_id;

create view public.admin_audit_log
with (security_invoker = true) as
select
  a.id,
  a.actor_id,
  a.actor_role,
  a.action,
  a.target_type,
  a.target_id,
  a.summary,
  a.metadata,
  a.created_at,
  p.full_name as actor_name,
  p.email as actor_email
from public.audit_logs a
left join public.profiles p on p.id = a.actor_id;

revoke all on public.admin_order_list, public.admin_customer_list, public.admin_rider_list,
  public.admin_payment_list, public.admin_audit_log from anon, authenticated;
grant select on public.admin_order_list, public.admin_customer_list, public.admin_rider_list,
  public.admin_payment_list, public.admin_audit_log to authenticated;
grant select on public.admin_order_list, public.admin_customer_list, public.admin_rider_list,
  public.admin_payment_list, public.admin_audit_log to service_role;

-- -----------------------------------------------------------------------------
-- Overview metrics (today = Africa/Accra calendar day)
-- -----------------------------------------------------------------------------
create function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Accra')::date;
begin
  perform private.require_admin();
  return (
    select jsonb_build_object(
      'orders_today', count(*) filter (where (o.created_at at time zone 'Africa/Accra')::date = v_today),
      'revenue_today_pesewas', coalesce(sum(o.amount_paid_pesewas) filter (
        where o.payment_status = 'PAID' and o.order_status <> 'CANCELLED'
          and (o.paid_at at time zone 'Africa/Accra')::date = v_today
      ), 0),
      'pending', count(*) filter (where o.order_status = 'PENDING'),
      'paid', count(*) filter (where o.order_status = 'PAID'),
      'preparing', count(*) filter (where o.order_status = 'PREPARING'),
      'ready', count(*) filter (where o.order_status = 'READY'),
      'assigned', count(*) filter (where o.order_status = 'ASSIGNED'),
      'out_for_delivery', count(*) filter (where o.order_status = 'OUT_FOR_DELIVERY'),
      'delivered_today', count(*) filter (
        where o.order_status = 'DELIVERED' and (o.delivered_at at time zone 'Africa/Accra')::date = v_today
      ),
      'pending_fee_proposals', (
        select count(*) from public.delivery_fee_changes f
        join public.orders fo on fo.id = f.order_id
        where f.status = 'PROPOSED' and fo.archived_at is null
      ),
      'generated_at', now()
    )
    from public.orders o
    where o.archived_at is null
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Analytics over [p_from, p_to). Revenue = verified payments on non-cancelled,
-- non-archived orders. Nothing is estimated or extrapolated.
-- -----------------------------------------------------------------------------
create function public.admin_analytics(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_admin();
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception using errcode = 'P0001', message = 'INVALID_DATE_RANGE';
  end if;
  if p_to - p_from > interval '400 days' then
    raise exception using errcode = 'P0001', message = 'DATE_RANGE_TOO_LONG';
  end if;

  with scoped as (
    select o.*
    from public.orders o
    where o.archived_at is null
      and o.created_at >= p_from
      and o.created_at < p_to
  ),
  paid as (
    select * from scoped where payment_status = 'PAID' and order_status <> 'CANCELLED'
  ),
  paid_items as (
    select oi.*
    from public.order_items oi
    join paid on paid.id = oi.order_id
  ),
  days as (
    select generate_series(
      (p_from at time zone 'Africa/Accra')::date,
      ((p_to - interval '1 microsecond') at time zone 'Africa/Accra')::date,
      interval '1 day'
    )::date as day
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'totals', (
      select jsonb_build_object(
        'orders', (select count(*) from scoped),
        'paid_orders', (select count(*) from paid),
        'revenue_pesewas', (select coalesce(sum(amount_paid_pesewas), 0) from paid),
        'average_order_value_pesewas', (
          select case when count(*) = 0 then null else round(avg(amount_paid_pesewas))::bigint end from paid
        ),
        'delivery_fees_pesewas', (select coalesce(sum(delivery_fee_pesewas), 0) from paid),
        'delivery_balances_pesewas', (select coalesce(sum(delivery_balance_pesewas), 0) from paid),
        'completed_deliveries', (select count(*) from scoped where order_status = 'DELIVERED'),
        'cancelled_orders', (select count(*) from scoped where order_status = 'CANCELLED'),
        'units_sold', (select coalesce(sum(quantity), 0) from paid_items)
      )
    ),
    'brands', coalesce((
      select jsonb_agg(row_to_json(b) order by b.revenue_pesewas desc)
      from (
        select brand_id, brand_name, sum(quantity)::bigint as units, sum(line_total_pesewas)::bigint as revenue_pesewas
        from paid_items
        group by brand_id, brand_name
      ) b
    ), '[]'::jsonb),
    'product_mix', coalesce((
      select jsonb_agg(row_to_json(pm) order by pm.units desc, pm.product_name, pm.variant_name)
      from (
        select brand_name, product_name, variant_name, sum(quantity)::bigint as units,
               sum(line_total_pesewas)::bigint as revenue_pesewas
        from paid_items
        group by brand_name, product_name, variant_name
      ) pm
    ), '[]'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'orders', coalesce(s.orders, 0),
        'paid_orders', coalesce(s.paid_orders, 0),
        'revenue_pesewas', coalesce(s.revenue, 0)
      ) order by d.day)
      from days d
      left join (
        select (created_at at time zone 'Africa/Accra')::date as day,
               count(*) as orders,
               count(*) filter (where payment_status = 'PAID' and order_status <> 'CANCELLED') as paid_orders,
               coalesce(sum(amount_paid_pesewas) filter (where payment_status = 'PAID' and order_status <> 'CANCELLED'), 0) as revenue
        from scoped
        group by 1
      ) s on s.day = d.day
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Safe archival ("Reset Demo / Existing Orders"). Nothing is deleted.
-- -----------------------------------------------------------------------------
create function public.admin_archive_preview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return (
    select jsonb_build_object(
      'total', count(*),
      'in_progress', count(*) filter (where o.order_status in ('PAID', 'PREPARING', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY')),
      'awaiting_payment', count(*) filter (where o.order_status = 'PENDING'),
      'delivered', count(*) filter (where o.order_status = 'DELIVERED'),
      'cancelled', count(*) filter (where o.order_status = 'CANCELLED'),
      'paid', count(*) filter (where o.payment_status = 'PAID')
    )
    from public.orders o
    where o.archived_at is null
  );
end;
$$;

create function public.admin_archive_orders(p_confirmation text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.archive_batches;
  v_count integer;
begin
  perform private.require_admin();
  -- The exact phrase is checked server-side too, not just in the UI.
  if p_confirmation is distinct from 'RESET ORDERS' then
    raise exception using errcode = 'P0001', message = 'CONFIRMATION_MISMATCH';
  end if;

  insert into public.archive_batches (reason, created_by)
  values (nullif(trim(coalesce(p_reason, '')), ''), auth.uid())
  returning * into v_batch;

  with archived as (
    update public.orders
       set archived_at = now(), archive_batch_id = v_batch.id
     where archived_at is null
    returning id
  ), events as (
    insert into public.order_status_history (order_id, event, actor_id, actor_role, note, is_customer_visible)
    select a.id, 'ARCHIVED', auth.uid(), 'ADMIN', 'Archived by admin reset', false
    from archived a
    returning 1
  )
  select count(*) into v_count from events;

  update public.archive_batches set order_count = v_count where id = v_batch.id
  returning * into v_batch;

  perform private.write_audit(
    'orders.archived', 'archive_batch', v_batch.id::text,
    format('%s orders archived', v_count),
    jsonb_build_object('order_count', v_count, 'reason', v_batch.reason),
    'ADMIN'
  );

  return jsonb_build_object('batch_id', v_batch.id, 'order_count', v_count, 'created_at', v_batch.created_at);
end;
$$;

revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_analytics(timestamptz, timestamptz) from public, anon;
revoke all on function public.admin_archive_preview() from public, anon;
revoke all on function public.admin_archive_orders(text, text) from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_analytics(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_archive_preview() to authenticated;
grant execute on function public.admin_archive_orders(text, text) to authenticated;
