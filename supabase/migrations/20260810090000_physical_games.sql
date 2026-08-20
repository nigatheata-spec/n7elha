-- Physical Games: printed board + QR scans, no student devices needed.
-- kit_id is a short human-typed code printed once per physical board (e.g.
-- "K4471"); it's a permanent lookup key, but everything it points to
-- (subject/status) stays editable server-side after printing.
CREATE TABLE IF NOT EXISTS public.kits (
  id          TEXT PRIMARY KEY,
  label       TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kits_public_select" ON public.kits FOR SELECT USING (true);

ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS kit_id TEXT REFERENCES public.kits(id);

-- Tracks which of the quiz's own questions a physical session has already
-- dispensed. Repeated scans of the same printed square (all Red squares on a
-- board share one QR) cycle through the quiz's question pool instead of
-- repeating; cleared per-difficulty once exhausted so play can continue
-- indefinitely (see PhysicalMonitor's dispenseQuestion for the reshuffle).
CREATE TABLE IF NOT EXISTS public.physical_used_questions (
  session_id   UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  used_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, question_id)
);
ALTER TABLE public.physical_used_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "puq_public_select" ON public.physical_used_questions FOR SELECT USING (true);
CREATE POLICY "puq_public_insert" ON public.physical_used_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "puq_public_delete" ON public.physical_used_questions FOR DELETE USING (true);
