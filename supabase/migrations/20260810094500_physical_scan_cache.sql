-- Caches the last question dispensed per (session, square type) for a short
-- window, so refreshing/rescanning the same square doesn't let a team reroll
-- for an easier question — see dispensePhysicalQuestion in physicalGames.ts.
CREATE TABLE IF NOT EXISTS public.physical_last_scan (
  session_id   UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  type_code    SMALLINT NOT NULL,
  question_id  UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  dispensed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, type_code)
);
ALTER TABLE public.physical_last_scan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pls_public_select" ON public.physical_last_scan FOR SELECT USING (true);
CREATE POLICY "pls_public_insert" ON public.physical_last_scan FOR INSERT WITH CHECK (true);
CREATE POLICY "pls_public_update" ON public.physical_last_scan FOR UPDATE USING (true);
