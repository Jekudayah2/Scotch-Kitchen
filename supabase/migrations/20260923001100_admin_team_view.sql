-- =============================================================================
-- SCOTCH's Kitchen · 1100 Team read model for the admin Roles screen
--
-- user_roles references auth.users, so the API can't join it to profiles on
-- its own. This view does, with security_invoker so the caller's RLS applies:
-- admins see every staff role; anyone else sees at most their own rows.
-- =============================================================================

create view public.admin_team_list
with (security_invoker = true) as
select
  ur.user_id,
  ur.role,
  ur.created_at,
  ur.granted_by,
  p.full_name,
  p.email,
  p.phone
from public.user_roles ur
join public.profiles p on p.id = ur.user_id
where ur.role in ('ADMIN', 'RIDER');

revoke all on public.admin_team_list from anon, authenticated;
grant select on public.admin_team_list to authenticated;
grant select on public.admin_team_list to service_role;
