-- ───────────────────────────────────────────────────────────────────────────
-- Homework mode
--
-- Homework needs no new columns: a session is identified by settings->>'mode'
-- = 'homework', and a student's result lives in the correct_answers /
-- total_answers columns game_students already has.
--
-- What it DOES need is an exemption from the stale-session reaper. That job
-- force-finishes anything left 'running' for 30 minutes, which is right for a
-- live classroom game nobody closed — and fatal for homework, whose whole
-- point is to stay open for days. Without this, every homework link would go
-- dead half an hour after it was created.
--
-- A homework session ends when the teacher closes it, or when the client sees
-- its settings.dueAt has passed.
-- ───────────────────────────────────────────────────────────────────────────

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
      AND COALESCE(settings->>'mode', '') <> 'homework'
      AND COALESCE(started_at, created_at) < now() - interval '30 minutes'
    RETURNING id
  )
  SELECT count(*) INTO ended_count FROM stale;

  RETURN ended_count;
END;
$$;
