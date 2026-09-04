-- Students can pick their avatar's color + face on the join screen instead of
-- always getting the one their name hashes to. Nullable: null means "not
-- chosen, derive from name" (every pre-existing row, and any join flow that
-- doesn't offer the picker).
alter table public.game_students
  add column avatar_color smallint,
  add column avatar_face smallint;
