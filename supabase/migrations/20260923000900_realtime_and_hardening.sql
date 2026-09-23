-- =============================================================================
-- SCOTCH's Kitchen · 0900 Realtime publication and privilege hardening
-- =============================================================================

-- Realtime delivers postgres_changes only for published tables, and only rows
-- the subscriber can SELECT under RLS. Kept deliberately small.
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['orders', 'notifications', 'order_status_history'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

-- Internal helpers are callable only by their SECURITY DEFINER owners...
revoke execute on all functions in schema private from public, anon, authenticated;

-- ...except the ones evaluated inside RLS policies and CHECK constraints,
-- which run with the privileges of the API role making the request.
grant execute on function private.has_role(public.app_role) to anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.is_rider() to anon, authenticated, service_role;
grant execute on function private.brand_is_public(uuid) to anon, authenticated, service_role;
grant execute on function private.product_is_public(uuid) to anon, authenticated, service_role;
grant execute on function private.is_valid_phone(text) to anon, authenticated, service_role;

-- Bootstrap stays available to the service role / SQL editor only.
grant execute on function private.bootstrap_grant_role(text, public.app_role) to service_role;
