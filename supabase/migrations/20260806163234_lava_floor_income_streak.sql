-- Lava Floor: per-player income tier (tool upgrades) and answer streak
ALTER TABLE game_students
  ADD COLUMN IF NOT EXISTS income_tier SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS streak SMALLINT NOT NULL DEFAULT 0;
