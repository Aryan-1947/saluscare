-- ===========================================================================
-- Migration: abuse prevention
--
--   1. rate_limit_hits: per-user, per-endpoint sliding-window counters used
--      by the edge functions' checkRateLimit() helper.
--   2. check_rate_limit(): SECURITY DEFINER, atomic count + conditional
--      insert in a single statement so concurrent requests cannot race.
--   3. Storage hardening for symptom-images:
--        - cap object size and allow only real image MIME types
--        - drop any permissive storage policies if present
--        - add owner-scoped policies so RLS-protected direct access,
--          if ever enabled, cannot cross users
--   4. index + cleanup of old rate limit rows.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Rate limit hits
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_hits (
  hit_id bigint generated always as identity primary key,
  auth0_user_id text not null,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_hits_window
  on public.rate_limit_hits (auth0_user_id, endpoint, created_at desc);

alter table public.rate_limit_hits enable row level security;

-- No policies: only the service role (edge functions) touches this table.

-- ---------------------------------------------------------------------------
-- 2. Atomic rate limit check
--
-- Counts this user's hits for the endpoint inside the trailing window; if
-- under the limit, records a hit and returns allowed = true. One statement,
-- so concurrent requests serialize correctly.
--
-- Returns: allowed boolean, used int (requests counted BEFORE this one; the
-- current request is the (used+1)-th in the window when allowed).
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_user_id text,
  p_endpoint text,
  p_limit int,
  p_window_seconds int
)
returns table (allowed boolean, used int)
language sql
security definer
set search_path = public
as $$
  with window_start as (
    select now() - make_interval(secs => p_window_seconds) as ws
  ),
  current_count as (
    select count(*)::int as cnt
    from public.rate_limit_hits, window_start
    where auth0_user_id = p_user_id
      and endpoint = p_endpoint
      and created_at >= window_start.ws
  ),
  decision as (
    select (cnt < p_limit) as is_allowed, cnt
    from current_count
  ),
  insert_hit as (
    -- Only record a hit when allowed; blocked requests don't extend the window.
    insert into public.rate_limit_hits (auth0_user_id, endpoint)
    select p_user_id, p_endpoint
    where (select is_allowed from decision)
    returning 1
  )
  select is_allowed as allowed, cnt as used
  from decision;
$$;

-- ---------------------------------------------------------------------------
-- 3. Storage hardening: symptom-images
-- ---------------------------------------------------------------------------

-- 3a. Bucket-level limits: only real image MIME types, max 10 MB per object
-- (frontend downscale keeps uploads at a few hundred KB; 10 MB is headroom).
-- Idempotent: updates the bucket if it exists, inserts otherwise.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'symptom-images') then
    update storage.buckets
    set public = false,
        file_size_limit = 10485760,
        allowed_mime_types = array[
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/heic',
          'image/heif'
        ]
    where id = 'symptom-images';
  else
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('symptom-images', 'symptom-images', false, 10 * 1024 * 1024, array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    ]);
  end if;
end $$;

-- 3b. Drop permissive policies if any exist.
drop policy if exists "symptom-images select all" on storage.objects;
drop policy if exists "symptom-images insert all" on storage.objects;
drop policy if exists "symptom-images public read" on storage.objects;
drop policy if exists "allow public read symptom-images" on storage.objects;
drop policy if exists "allow public upload symptom-images" on storage.objects;
drop policy if exists "symptom_images_public_access" on storage.objects;
drop policy if exists "public read access" on storage.objects;
drop policy if exists "public insert access" on storage.objects;

-- 3c. Owner-scoped policies: defense-in-depth so that direct client access,
-- if ever enabled, cannot cross users. Paths are namespaced by Auth0 user id:
--   {auth0_user_id}/{sessionId}/{uuid}.{ext}
-- storage.objects.owner is a Postgres role, not the Auth0 sub, so policies
-- key on the first path component instead.
drop policy if exists "symptom-images owner read" on storage.objects;
drop policy if exists "symptom-images owner write" on storage.objects;
create policy "symptom-images owner read"
  on storage.objects for select
  using (
    bucket_id = 'symptom-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "symptom-images owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'symptom-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 4. Keep the counters table lean: rows older than 24h are useless.
-- ---------------------------------------------------------------------------
create or replace function public.purge_old_rate_limit_hits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limit_hits where created_at < now() - interval '24 hours';
$$;
