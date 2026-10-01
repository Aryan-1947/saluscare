-- ===========================================================================
-- Migration: storage key sanitization for Auth0 subject ids
--
-- Auth0 subs contain '|' (e.g. google-oauth2|10966...), which is an invalid
-- Supabase Storage object key character. Edge functions now sanitize the
-- user id to lowercase alphanumerics/dashes before building storage paths:
--   {sanitized_user}/{sessionId}/{uuid}.{ext}
--
-- This migration:
--   1. Replaces the old owner-scoped policies (keyed on the RAW sub) with
--      policies keyed on the SANITIZED sub, matching the new paths.
--   2. Backfills: moves any existing objects stored under raw-sub prefixes
--      to the sanitized scheme so old uploads stay accessible.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Policies: match the sanitized path scheme
--    sanitize = lowercase, non [a-z0-9_-] runs -> '-', trimmed dashes.
--    Implemented in SQL to mirror storageKeys.storageSafeId().
-- ---------------------------------------------------------------------------
create or replace function public.sanitize_storage_user(raw text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(lower(coalesce(raw, '')), '[^a-z0-9_-]+', '-', 'g'),
        '^-+|-$', '', 'g'
      ),
      ''
    ),
    'unknown-user'
  );
$$;

drop policy if exists "symptom-images owner read" on storage.objects;
drop policy if exists "symptom-images owner write" on storage.objects;

create policy "symptom-images owner read"
  on storage.objects for select
  using (
    bucket_id = 'symptom-images'
    and (storage.foldername(name))[1] = public.sanitize_storage_user(auth.uid()::text)
  );

create policy "symptom-images owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'symptom-images'
    and (storage.foldername(name))[1] = public.sanitize_storage_user(auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- 2. Backfill: rename objects uploaded under raw (pipe-containing) prefixes.
--    Idempotent: only touches names whose first folder still contains
--    characters outside the sanitized alphabet.
-- ---------------------------------------------------------------------------
do $$
declare
  obj record;
  old_prefix text;
  new_prefix text;
begin
  for obj in
    select name
    from storage.objects
    where bucket_id = 'symptom-images'
      and (storage.foldername(name))[1] ~ '[^a-z0-9_-]'
  loop
    old_prefix := (storage.foldername(obj.name))[1];
    new_prefix := public.sanitize_storage_user(old_prefix);
    if new_prefix <> old_prefix then
      update storage.objects
      set name = new_prefix || substring(obj.name from length(old_prefix) + 1)
      where bucket_id = 'symptom-images' and name = obj.name;
    end if;
  end loop;
end $$;
