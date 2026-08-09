-- Paint Fight: unique per-player hue + append-only paint log + power-up spawns
ALTER TABLE game_students
  ADD COLUMN IF NOT EXISTS fight_hue SMALLINT;

-- One row per client-side flush (~150-200ms) carrying a batch of newly-claimed
-- cell indices — not one row per cell — same append-only replay pattern as
-- lava_floor_builds / hvz_actions, sized for ~20 concurrently-painting phones.
CREATE TABLE IF NOT EXISTS paint_fight_strokes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES game_students(id) ON DELETE CASCADE,
  hue           SMALLINT NOT NULL,
  cell_indices  INTEGER[] NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE paint_fight_strokes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pf_strokes_public_select" ON paint_fight_strokes FOR SELECT USING (true);
CREATE POLICY "pf_strokes_public_insert" ON paint_fight_strokes FOR INSERT WITH CHECK (true);
ALTER TABLE public.paint_fight_strokes REPLICA IDENTITY FULL;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='paint_fight_strokes';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.paint_fight_strokes';
  END IF;
END $$;

-- Power-up spawns. Teacher monitor is the sole spawner. Claim is a guarded
-- conditional UPDATE (WHERE claimed_by IS NULL) so simultaneous pickups can't
-- double-claim the same power-up.
CREATE TABLE IF NOT EXISTS paint_fight_powerups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('speed','roller','splash')),
  cell_index   INTEGER NOT NULL,
  claimed_by   UUID REFERENCES game_students(id),
  claimed_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE paint_fight_powerups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pf_powerups_public_select" ON paint_fight_powerups FOR SELECT USING (true);
CREATE POLICY "pf_powerups_public_insert" ON paint_fight_powerups FOR INSERT WITH CHECK (true);
CREATE POLICY "pf_powerups_public_update" ON paint_fight_powerups FOR UPDATE USING (true);
ALTER TABLE public.paint_fight_powerups REPLICA IDENTITY FULL;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='paint_fight_powerups';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.paint_fight_powerups';
  END IF;
END $$;
