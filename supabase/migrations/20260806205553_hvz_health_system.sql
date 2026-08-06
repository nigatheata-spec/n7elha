-- Humans vs Zombies: replace the infection tug-of-war with per-team health,
-- heal/max-health purchases, and team-wide buffs (cash multiplier, streak lock)
ALTER TABLE hvz_actions
  ADD COLUMN IF NOT EXISTS health_delta     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_health_delta INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buff_type        TEXT CHECK (buff_type IN ('cash_mult','streak_lock')),
  ADD COLUMN IF NOT EXISTS buff_team        TEXT CHECK (buff_team IN ('human','zombie')),
  ADD COLUMN IF NOT EXISTS buff_ms          INTEGER;
