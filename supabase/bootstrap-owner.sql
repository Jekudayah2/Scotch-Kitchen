-- =============================================================================
-- SCOTCH's Kitchen · one-time owner bootstrap
--
-- Run ONCE in the Supabase SQL Editor, after jkscotch2004@gmail.com has
-- signed up (email + password or Google). It grants ADMIN and RIDER through
-- private.bootstrap_grant_role, which only the service role / SQL editor can
-- call; the browser can never trigger it. The CUSTOMER role is kept, and each
-- grant is written to the audit log. Running it again changes nothing.
--
-- Add further admins and riders later from Admin → Settings → Team.
-- =============================================================================

select private.bootstrap_grant_role('jkscotch2004@gmail.com', 'ADMIN');
select private.bootstrap_grant_role('jkscotch2004@gmail.com', 'RIDER');
