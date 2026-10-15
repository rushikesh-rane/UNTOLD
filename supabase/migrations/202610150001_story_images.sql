-- UNTOLD story image uploads. Apply after the initial schema migration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-images', 'story-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Story images are publicly readable" on storage.objects;
create policy "Story images are publicly readable" on storage.objects for select using (bucket_id = 'story-images');
drop policy if exists "Users upload story images to their own folder" on storage.objects;
create policy "Users upload story images to their own folder" on storage.objects for insert to authenticated with check (bucket_id = 'story-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users update their own story images" on storage.objects;
create policy "Users update their own story images" on storage.objects for update to authenticated using (bucket_id = 'story-images' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'story-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete their own story images" on storage.objects;
create policy "Users delete their own story images" on storage.objects for delete to authenticated using (bucket_id = 'story-images' and (storage.foldername(name))[1] = auth.uid()::text);
