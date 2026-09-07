-- Paint Fight becomes a territory-capture game (paper.io style).
--
-- The append-only stroke log gains an OP. Until now every row meant the same
-- thing — "these cells are mine now" — which cannot express a player dying and
-- losing everything they held. Without a wipe op a dead player's territory
-- would stay on every other screen for the rest of the match, and the log would
-- no longer replay to the true board.
--
-- Existing rows are all claims, which is exactly what the default says, so this
-- is safe to apply to a session that is mid-flight.
ALTER TABLE paint_fight_strokes
  ADD COLUMN IF NOT EXISTS op TEXT NOT NULL DEFAULT 'claim';

DO $$ BEGIN
  ALTER TABLE paint_fight_strokes ADD CONSTRAINT pf_strokes_op_check CHECK (op IN ('claim','wipe'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Kills are worth keeping on the results page: in a capture game, cutting
-- somebody off is the other half of the score.
ALTER TABLE game_students
  ADD COLUMN IF NOT EXISTS fight_kills SMALLINT NOT NULL DEFAULT 0;

-- Power-ups were removed from this mode a while back and the table has been
-- dead weight since. Nothing reads or writes it any more.
DROP TABLE IF EXISTS paint_fight_powerups;
