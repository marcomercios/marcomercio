-- Run this once in the Supabase SQL Editor to enable product descriptions and photo uploads.
-- Use the same admin user UUID configured in supabase-setup.sql.
-- If you changed that UUID in the setup script, use the same value in the policies below.

alter table public.products
  add column if not exists description text not null default '',
  add column if not exists images text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Admin can upload product images" on storage.objects;
create policy "Admin can upload product images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and auth.uid() = 'c7b0b38b-ce3a-4b0c-8cc1-bfd33eb612ef'::uuid
  );

drop policy if exists "Admin can delete product images" on storage.objects;
create policy "Admin can delete product images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and auth.uid() = 'c7b0b38b-ce3a-4b0c-8cc1-bfd33eb612ef'::uuid
  );
