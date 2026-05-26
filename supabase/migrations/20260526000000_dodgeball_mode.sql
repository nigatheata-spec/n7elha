-- Dodgeball game mode support

-- Add lives / elimination columns to game_students
ALTER TABLE game_students
  ADD COLUMN IF NOT EXISTS lives SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS eliminated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS eliminated_at TIMESTAMPTZ;

-- Timer-tap table: each student's tap for a given timer round
CREATE TABLE IF NOT EXISTS dodgeball_timer_taps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES game_students(id) ON DELETE CASCADE,
  timer_round_id  TEXT NOT NULL,
  elapsed_ms      INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, student_id, timer_round_id)
);

ALTER TABLE dodgeball_timer_taps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "taps_public_select" ON dodgeball_timer_taps FOR SELECT USING (true);
CREATE POLICY "taps_public_insert" ON dodgeball_timer_taps FOR INSERT WITH CHECK (true);
