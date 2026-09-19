-- ===========================================================================
-- Migration: user data isolation + image URL durability
--
-- Problem 1 (critical): sessions / chat_turns / session_history rows had no
--   owner, so any authenticated user could read another user's health data by
--   knowing (or guessing) a session id.
-- Problem 2: session-image stored only a 1-hour signed URL, so every image in
--   chat history went broken after an hour.
--
-- This migration:
--   1. Adds auth0_user_id columns (nullable - legacy rows stay visible to
--      their owner once backfilled; NULL rows are treated as legacy data).
--   2. Backfills chat_turns / session_history ownership from sessions.
--   3. Adds indexes for the user-scoped queries the edge functions now run.
--   4. Adds chat_turns.image_path so URLs can be re-signed on read.
--   5. Locks the tables down with RLS as defense-in-depth behind the service
--      role (edge functions use the service role and scope every query by
--      auth0_user_id themselves).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Ownership columns
-- ---------------------------------------------------------------------------
alter table public.sessions
  add column if not exists auth0_user_id text;

alter table public.chat_turns
  add column if not exists auth0_user_id text;

-- session_history chains sessions together; ownership is derived, but storing
-- it keeps every table independently scoped and index-friendly.
alter table public.session_history
  add column if not exists auth0_user_id text;

-- Durable image storage path (urls are re-signed on read). Must exist before
-- the partial index on it is created below.
alter table public.chat_turns
  add column if not exists image_path text;

-- ---------------------------------------------------------------------------
-- 2. Backfill ownership from sessions (runs once, no-op if re-run)
-- ---------------------------------------------------------------------------
update public.chat_turns t
set auth0_user_id = s.auth0_user_id
from public.sessions s
where t.group_id = s.id
  and t.auth0_user_id is null
  and s.auth0_user_id is not null;

-- Legacy chat_turns whose group_id never made it into sessions: attach to the
-- legacy session rows via session_history (chain sessions share the root's
-- group_id only for chat; each chain session has its own row in sessions).
update public.chat_turns t
set auth0_user_id = h.auth0_user_id
from public.session_history h
where t.group_id = h.session_id
  and t.auth0_user_id is null
  and h.auth0_user_id is not null;

update public.session_history h
set auth0_user_id = s.auth0_user_id
from public.sessions s
where h.session_id = s.id
  and h.auth0_user_id is null
  and s.auth0_user_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Indexes for user-scoped queries
-- ---------------------------------------------------------------------------
create index if not exists idx_sessions_auth0_user
  on public.sessions (auth0_user_id, created_at desc);

create index if not exists idx_chat_turns_user_group
  on public.chat_turns (auth0_user_id, group_id, created_at);

create index if not exists idx_session_history_user
  on public.session_history (auth0_user_id, session_id);

create index if not exists idx_chat_turns_image_path
  on public.chat_turns (image_path)
  where image_path is not null;

-- ---------------------------------------------------------------------------
-- 4. RLS: defense-in-depth. Edge functions use the service role (bypasses
-- RLS) and enforce scoping in code; RLS guarantees that even a future client
-- side access path cannot leak cross-user rows. No anon/authenticated policies
-- are created, so direct client access is fully denied.
-- ---------------------------------------------------------------------------
alter table public.sessions enable row level security;
alter table public.chat_turns enable row level security;
alter table public.session_history enable row level security;

-- If RLS was previously enabled with permissive policies, drop them so no
-- client-side path can read rows directly.
drop policy if exists "sessions_select_own" on public.sessions;
drop policy if exists "sessions_insert_own" on public.sessions;
drop policy if exists "chat_turns_select_own" on public.chat_turns;
drop policy if exists "chat_turns_insert_own" on public.chat_turns;
drop policy if exists "session_history_select_own" on public.session_history;
