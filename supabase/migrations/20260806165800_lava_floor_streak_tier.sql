-- Lava Floor: purchasable streak upgrades (boost the streak multiplier ladder)
ALTER TABLE game_students
  ADD COLUMN IF NOT EXISTS streak_tier SMALLINT NOT NULL DEFAULT 1;
