-- Lava Floor build shop: block purchases that grow a class-wide tower
CREATE TABLE IF NOT EXISTS lava_floor_builds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES game_students(id) ON DELETE CASCADE,
  student_name  TEXT NOT NULL,
  block_type    TEXT NOT NULL CHECK (block_type IN ('plank','brick','staircase','house')),
  height_added  INTEGER NOT NULL,
  cost          INTEGER NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lava_floor_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "builds_public_select" ON lava_floor_builds FOR SELECT USING (true);
CREATE POLICY "builds_public_insert" ON lava_floor_builds FOR INSERT WITH CHECK (true);
