-- ───────────────────────────────────────────────────────────────────────────
-- Auto-end stale game sessions (server-side safety net)
--
-- Any session that has been "running" longer than 30 minutes is force-finished.
-- This runs at the database level via pg_cron, so it protects the server even
-- when no teacher browser tab is open to trigger the client-side auto-end.
-- ───────────────────────────────────────────────────────────────────────────

-- 1. Enable pg_cron (Supabase ships this; safe to run if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 2. Hard cap, in minutes. Change in one place if the limit ever moves.
--    Falls back to created_at when started_at is null (session stuck mid-launch).
CREATE OR REPLACE FUNCTION public.auto_end_stale_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ended_count integer;
BEGIN
  WITH stale AS (
    UPDATE public.game_sessions
    SET status   = 'finished',
        ended_at = now()
    WHERE status = 'running'
      AND COALESCE(started_at, created_at) < now() - interval '30 minutes'
    RETURNING id
  )
  SELECT count(*) INTO ended_count FROM stale;

  RETURN ended_count;
END;
$$;

-- 3. Schedule it every minute. Unschedule first so re-running this migration
--    doesn't create duplicate jobs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-end-stale-sessions') THEN
    PERFORM cron.unschedule('auto-end-stale-sessions');
  END IF;
END $$;

SELECT cron.schedule(
  'auto-end-stale-sessions',
  '* * * * *',                        -- every minute
  $$SELECT public.auto_end_stale_sessions();$$
);
