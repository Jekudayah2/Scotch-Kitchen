-- The starting catalog (ZOBOPOP 330ml/500ml, Creamypop Vanilla/Strawberry) is
-- created by migration 20260923001000_seed_catalog.sql, so it also exists on
-- hosted projects after `supabase db push`.
--
-- Nothing else is seeded on purpose: no orders, customers, riders or payments.
-- See README → "Initial admin setup" to grant ADMIN + RIDER to the owner account.
select 1;
