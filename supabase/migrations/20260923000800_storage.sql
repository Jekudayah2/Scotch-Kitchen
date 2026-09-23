-- =============================================================================
-- SCOTCH's Kitchen · 0800 Storage buckets and policies
--
--   product-images : public read, admin write (official product photography)
--   brand-assets   : public read, admin write (logos, brand imagery)
--   avatars        : public read, each user writes only inside "<their uid>/"
--
-- SVG is intentionally not allowed anywhere (it can carry script).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('brand-assets', 'brand-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "catalog media: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('product-images', 'brand-assets'));

create policy "catalog media: admins upload"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('product-images', 'brand-assets') and (select private.is_admin()));

create policy "catalog media: admins update"
  on storage.objects for update to authenticated
  using (bucket_id in ('product-images', 'brand-assets') and (select private.is_admin()))
  with check (bucket_id in ('product-images', 'brand-assets') and (select private.is_admin()));

create policy "catalog media: admins delete"
  on storage.objects for delete to authenticated
  using (bucket_id in ('product-images', 'brand-assets') and (select private.is_admin()));

create policy "avatars: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy "avatars: owner uploads into own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: owner updates own files"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: owner deletes own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
