-- Don't Look Down: 2D parkour platformer mode.
-- Reuses the generic progression columns already on game_students
-- (crypto, streak, income_tier, streak_drain_tier, cash_insurance_tier)
-- and adds the platformer-specific upgrades + climb progress.
--
-- Live player positions are NOT stored here: they are sent over a Supabase
-- broadcast channel at ~15Hz. Persisting them would mean hundreds of writes
-- per second per session. Only durable progress lands in the table.
ALTER TABLE game_students
  ADD COLUMN IF NOT EXISTS energy_tier      SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS battery_tier     SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS double_jump      BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS checkpoint_index SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS height_reached   INTEGER  NOT NULL DEFAULT 0;
