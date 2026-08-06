-- Humans vs Zombies: teams, per-player upgrade tiers, and a shared sabotage/infection log
ALTER TABLE game_students
  ADD COLUMN IF NOT EXISTS team TEXT CHECK (team IN ('human','zombie')),
  ADD COLUMN IF NOT EXISTS streak_drain_tier SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cash_insurance_tier SMALLINT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS hvz_actions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES game_students(id) ON DELETE CASCADE,
  student_name        TEXT NOT NULL,
  team                TEXT NOT NULL CHECK (team IN ('human','zombie')),
  action_key          TEXT NOT NULL,
  infection_delta     INTEGER NOT NULL DEFAULT 0,
  freeze_target_team  TEXT,
  freeze_ms           INTEGER,
  blur_target_team    TEXT,
  blur_ms             INTEGER,
  cost                INTEGER NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hvz_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hvz_actions_public_select" ON hvz_actions FOR SELECT USING (true);
CREATE POLICY "hvz_actions_public_insert" ON hvz_actions FOR INSERT WITH CHECK (true);

ALTER TABLE hvz_actions REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='hvz_actions';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.hvz_actions'; END IF;
END $$;
