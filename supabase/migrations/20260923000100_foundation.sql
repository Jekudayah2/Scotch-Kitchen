-- =============================================================================
-- SCOTCH's Kitchen · 0100 Foundation
-- Schemas, shared helpers, profiles, normalised roles, rider profiles, audit log.
--
-- Conventions used across every migration:
--   * Money is stored as integer pesewas (GH₵1 = 100 pesewas). Never floats.
--   * Coordinates are stored as latitude / longitude columns (never [lng, lat]).
--   * All SECURITY DEFINER functions pin `search_path = ''` and schema-qualify
--     every reference, so they cannot be hijacked by objects on the path.
--   * Grants are explicit. Nothing relies on Supabase's default table grants.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
comment on schema private is
  'Internal helpers used by RLS policies and RPCs. Not exposed through the Data API.';

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('CUSTOMER', 'ADMIN', 'RIDER');
create type public.rider_availability as enum ('AVAILABLE', 'BUSY', 'OFFLINE');

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Accepts Ghanaian and international formats: "024 387 0366", "+233 24 387 0366".
create function private.is_valid_phone(p_phone text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_phone ~ '^\+?[0-9][0-9 ()-]{6,19}$'
     and char_length(regexp_replace(p_phone, '[^0-9]', '', 'g')) between 7 and 15;
$$;

-- Last nine digits identify a Ghanaian subscriber regardless of 0 / +233 prefix.
create function private.phone_fingerprint(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 9);
$$;

-- Unambiguous alphabet (no 0/O/1/I/L) for human-facing references.
create function private.random_code(p_length integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  v_out text := '';
  i integer;
begin
  if p_length < 1 or p_length > 24 then
    raise exception 'random_code length must be between 1 and 24';
  end if;
  for i in 0 .. p_length - 1 loop
    v_out := v_out || substr(v_alphabet, (get_byte(v_bytes, i) % char_length(v_alphabet)) + 1, 1);
  end loop;
  return v_out;
end;
$$;

-- Strips anything that looks like a credential before it reaches a log.
create function private.redact_secrets(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_item jsonb;
  v_result jsonb;
begin
  if p_value is null then
    return null;
  elsif jsonb_typeof(p_value) = 'object' then
    v_result := '{}'::jsonb;
    for v_key, v_item in select key, value from jsonb_each(p_value) loop
      if v_key ~* '(password|passwd|secret|token|authorization|access_code|api_?key|service_role|signature|otp)' then
        v_result := v_result || jsonb_build_object(v_key, '[REDACTED]');
      else
        v_result := v_result || jsonb_build_object(v_key, private.redact_secrets(v_item));
      end if;
    end loop;
    return v_result;
  elsif jsonb_typeof(p_value) = 'array' then
    select coalesce(jsonb_agg(private.redact_secrets(e)), '[]'::jsonb) into v_result
    from jsonb_array_elements(p_value) as e;
    return v_result;
  end if;
  return p_value;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users — never stores passwords)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) between 1 and 120),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or private.is_valid_phone(phone)),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Customer-facing profile data. One row per auth user. Passwords live only in Supabase Auth.';

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Roles: normalised so one user can hold several (e.g. ADMIN + RIDER)
-- -----------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- The primary key also serves as the index on user_roles.user_id.
  primary key (user_id, role)
);
comment on table public.user_roles is 'Role assignments. Written only by SECURITY DEFINER functions, never directly by clients.';
create index user_roles_role_idx on public.user_roles (role);

create function private.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = p_role
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('ADMIN');
$$;

create function private.is_rider()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('RIDER');
$$;

create function private.user_has_role(p_user_id uuid, p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur where ur.user_id = p_user_id and ur.role = p_role
  );
$$;

-- -----------------------------------------------------------------------------
-- Rider operational profile (availability is always set by a person, never GPS)
-- -----------------------------------------------------------------------------
create table public.rider_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  availability public.rider_availability not null default 'OFFLINE',
  availability_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger rider_profiles_touch_updated_at
  before update on public.rider_profiles
  for each row execute function private.touch_updated_at();

create function private.ensure_rider_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'RIDER' then
    insert into public.rider_profiles (user_id)
    values (new.user_id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger user_roles_ensure_rider_profile
  after insert on public.user_roles
  for each row execute function private.ensure_rider_profile();

create function private.offline_revoked_rider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'RIDER' then
    update public.rider_profiles
       set availability = 'OFFLINE', availability_updated_at = now()
     where user_id = old.user_id;
  end if;
  return old;
end;
$$;

create trigger user_roles_offline_revoked_rider
  after delete on public.user_roles
  for each row execute function private.offline_revoked_rider();

-- -----------------------------------------------------------------------------
-- Audit log (append-only)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_role text not null check (actor_role in ('ADMIN', 'RIDER', 'CUSTOMER', 'SYSTEM')),
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type text not null check (char_length(target_type) between 1 and 60),
  target_id text,
  summary text check (summary is null or char_length(summary) <= 500),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.audit_logs is
  'Append-only record of operational and administrative actions. Metadata is passed through private.redact_secrets().';

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_action_idx on public.audit_logs (action);

create function private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The only permitted update is the FK cascade that nulls actor_id when a user is deleted.
  if tg_op = 'UPDATE'
     and new.actor_id is null
     and old.actor_id is not null
     and (new.id, new.actor_role, new.action, new.target_type, new.target_id, new.summary, new.metadata, new.created_at)
         is not distinct from
         (old.id, old.actor_role, old.action, old.target_type, old.target_id, old.summary, old.metadata, old.created_at)
  then
    return new;
  end if;
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_mutation();

create function private.prevent_audit_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function private.prevent_audit_truncate();

create function private.current_actor_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then 'SYSTEM'
    when private.has_role('ADMIN') then 'ADMIN'
    when private.has_role('RIDER') then 'RIDER'
    else 'CUSTOMER'
  end;
$$;

create function private.write_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_summary text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_role text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, summary, metadata)
  values (
    auth.uid(),
    coalesce(p_actor_role, private.current_actor_role()),
    p_action,
    p_target_type,
    p_target_id,
    left(p_summary, 500),
    private.redact_secrets(coalesce(p_metadata, '{}'::jsonb))
  );
end;
$$;

-- Generic row-diff audit trigger. tg_argv[0] is the target type (e.g. 'product').
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_target_id text;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_target_id := v_new ->> 'id';
    v_action := tg_argv[0] || '.created';
    v_changes := v_new - 'created_at' - 'updated_at';
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_target_id := v_new ->> 'id';
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key not in ('updated_at', 'created_at')
         and (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_changes := v_changes || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key)
        );
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return new;
    end if;
    v_action := tg_argv[0] || '.updated';
  else
    v_old := to_jsonb(old);
    v_target_id := v_old ->> 'id';
    v_action := tg_argv[0] || '.deleted';
    v_changes := v_old - 'created_at' - 'updated_at';
  end if;

  perform private.write_audit(
    v_action,
    tg_argv[0],
    v_target_id,
    null,
    jsonb_build_object('changes', v_changes)
  );
  return coalesce(new, old);
end;
$$;

-- -----------------------------------------------------------------------------
-- New auth users → profile + CUSTOMER role
-- -----------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := nullif(trim(coalesce(v_meta ->> 'full_name', v_meta ->> 'name', '')), '');
  v_phone text := nullif(trim(coalesce(v_meta ->> 'phone', '')), '');
  v_avatar text := nullif(trim(coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture', '')), '');
begin
  -- Metadata is user-controlled: sanitise instead of failing the sign-up.
  if v_phone is not null and not private.is_valid_phone(v_phone) then
    v_phone := null;
  end if;
  if v_avatar is not null and (char_length(v_avatar) > 1024 or v_avatar !~ '^https://') then
    v_avatar := null;
  end if;

  insert into public.profiles (id, full_name, email, phone, avatar_url)
  values (new.id, left(v_name, 120), new.email, v_phone, v_avatar)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'CUSTOMER')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Bootstrap: grant a role by email. Callable only from the SQL editor / service
-- role — see README "Initial admin setup". Never exposed to browsers.
-- -----------------------------------------------------------------------------
create function private.bootstrap_grant_role(p_email text, p_role public.app_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email));

  if v_user_id is null then
    raise exception 'No Supabase Auth user has the email %. They must sign up first.', p_email;
  end if;

  insert into public.user_roles (user_id, role)
  values (v_user_id, p_role)
  on conflict do nothing;

  perform private.write_audit(
    'role.granted', 'user', v_user_id::text,
    format('%s granted via bootstrap', p_role),
    jsonb_build_object('role', p_role, 'via', 'bootstrap'),
    'SYSTEM'
  );

  return format('%s now has role %s', p_email, p_role);
end;
$$;

revoke all on function private.bootstrap_grant_role(text, public.app_role) from public, anon, authenticated;
grant execute on function private.bootstrap_grant_role(text, public.app_role) to service_role;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.rider_profiles enable row level security;
alter table public.audit_logs enable row level security;

-- profiles
create policy "profiles: owner can read"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: admins can read all"
  on public.profiles for select to authenticated
  using ((select private.is_admin()));

create policy "profiles: owner can update"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- user_roles: read-only for clients; writes go through admin RPCs
create policy "user_roles: owner can read"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "user_roles: admins can read all"
  on public.user_roles for select to authenticated
  using ((select private.is_admin()));

-- rider_profiles: read-only for clients; availability changes go through an RPC
create policy "rider_profiles: owner can read"
  on public.rider_profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "rider_profiles: admins can read all"
  on public.rider_profiles for select to authenticated
  using ((select private.is_admin()));

-- audit_logs: admins read; nobody writes directly
create policy "audit_logs: admins can read"
  on public.audit_logs for select to authenticated
  using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Grants (explicit — column-level for profile updates)
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.user_roles, public.rider_profiles, public.audit_logs from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.rider_profiles to authenticated;
grant select on public.audit_logs to authenticated;

grant all on public.profiles, public.user_roles, public.rider_profiles, public.audit_logs to service_role;
