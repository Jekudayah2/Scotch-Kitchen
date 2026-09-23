-- =============================================================================
-- SCOTCH's Kitchen · 1000 Starting catalog (legitimate business data only)
--
--   ZOBOPOP 330ml ............ GH₵10
--   ZOBOPOP 500ml ............ GH₵15
--   Creamypop Vanilla 200ml .. GH₵8
--   Creamypop Strawberry 200ml GH₵8
--
-- No orders, customers, riders or payments are seeded. Image URLs point at the
-- official product photography bundled in /public/images/products; admins can
-- replace them with uploads to the `product-images` bucket.
-- Fixed UUIDs keep this migration idempotent and easy to reference.
-- =============================================================================

insert into public.brands (id, slug, name, tagline, description, theme_key, sort_order)
values
  ('b1000000-0000-4000-8000-000000000001', 'zobopop', 'ZOBOPOP', 'Premium Hibiscus Drink',
   'ZOBOPOP is the SCOTCH''s Kitchen hibiscus drink (sobolo): one signature recipe of hibiscus, warm spices and fruit.',
   'zobopop', 1),
  ('b1000000-0000-4000-8000-000000000002', 'creamypop', 'Creamypop', 'Creamy. Fresh. Ghanaian.',
   'Creamypop is the SCOTCH''s Kitchen ice cream, made with real milk for a rich and creamy taste.',
   'creamypop', 2)
on conflict (id) do nothing;

insert into public.products (id, brand_id, slug, name, subtitle, description, product_type, storage_note, sort_order)
values
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'zobopop-hibiscus-drink', 'ZOBOPOP', 'Premium Hibiscus Drink',
   'Our signature sobolo. Hibiscus is blended with cloves, ginger, cinnamon and mint, then brightened with mango, lemon and pineapple. It is one recipe, and every bottle carries all of it.',
   'DRINK', 'Keep refrigerated', 1),
  ('c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002',
   'creamypop-ice-cream', 'Creamypop Ice Cream', 'Creamy. Fresh. Ghanaian.',
   'Made with real milk for a rich and creamy taste. Choose Vanilla or Strawberry, each in a 200ml tub.',
   'FROZEN_DESSERT', 'Keep frozen', 2)
on conflict (id) do nothing;

insert into public.product_ingredients (product_id, name, ingredient_group, sort_order)
values
  ('c1000000-0000-4000-8000-000000000001', 'Hibiscus', 'BASE', 1),
  ('c1000000-0000-4000-8000-000000000001', 'Cloves', 'SPICE', 1),
  ('c1000000-0000-4000-8000-000000000001', 'Ginger', 'SPICE', 2),
  ('c1000000-0000-4000-8000-000000000001', 'Cinnamon', 'SPICE', 3),
  ('c1000000-0000-4000-8000-000000000001', 'Mint', 'SPICE', 4),
  ('c1000000-0000-4000-8000-000000000001', 'Mango', 'FRUIT', 1),
  ('c1000000-0000-4000-8000-000000000001', 'Lemon', 'FRUIT', 2),
  ('c1000000-0000-4000-8000-000000000001', 'Pineapple', 'FRUIT', 3)
on conflict (product_id, name) do nothing;

insert into public.product_variants
  (id, product_id, sku, name, size_label, volume_ml, flavour, price_pesewas, sort_order)
values
  ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'ZP-330', '330ml', '330ml', 330, null, 1000, 1),
  ('d1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001',
   'ZP-500', '500ml', '500ml', 500, null, 1500, 2),
  ('d1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002',
   'CP-VAN-200', 'Vanilla', '200ml', 200, 'Vanilla', 800, 1),
  ('d1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000002',
   'CP-STR-200', 'Strawberry', '200ml', 200, 'Strawberry', 800, 2)
on conflict (id) do nothing;

insert into public.product_images (id, product_id, variant_id, url, alt_text, is_primary, sort_order)
values
  ('e1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', null,
   '/images/products/zobopop-500ml.webp', 'A bottle of ZOBOPOP premium hibiscus drink beside hibiscus flowers', true, 1),
  ('e1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002',
   '/images/products/zobopop-500ml.webp', 'A 500ml bottle of ZOBOPOP premium hibiscus drink', true, 1),
  ('e1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', null,
   '/images/products/creamypop-strawberry.jpg', 'A tub of Creamypop strawberry ice cream', true, 1),
  ('e1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000003',
   '/images/products/creamypop-vanilla.webp', 'A tub of Creamypop vanilla ice cream with vanilla pods', true, 1),
  ('e1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000004',
   '/images/products/creamypop-strawberry.jpg', 'A tub of Creamypop strawberry ice cream with fresh strawberries', true, 1)
on conflict (id) do nothing;
