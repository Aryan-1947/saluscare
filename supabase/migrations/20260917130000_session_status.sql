-- ===========================================================================
-- Migration: follow-up session status
--
-- Tracks whether an assessment chain still expects a follow-up. The dashboard
-- "Active Follow-ups" metric reads this instead of guessing from localStorage.
--
-- Lifecycle:
--   * A session is created with status 'open' (it awaits an update).
--   * When a follow-up arrives (session-followup), the parent is closed:
--       - 'closed_emergency'    if the follow-up triaged tier 3
--       - 'closed_followed_up'  otherwise
--     and the follow-up session starts as 'open'.
--   * Legacy rows keep NULL and are simply not counted as active.
-- ===========================================================================

alter table public.sessions
  add column if not exists status text
  check (status in ('open', 'closed_followed_up', 'closed_emergency'));

-- The dashboard's active-follow-ups query is exactly this index.
create index if not exists idx_sessions_user_status
  on public.sessions (auth0_user_id, status)
  where status is not null;
