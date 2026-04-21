
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP POLICY IF EXISTS "Students insertable publicly" ON public.game_students;
DROP POLICY IF EXISTS "Students updatable publicly" ON public.game_students;
DROP POLICY IF EXISTS "Hack events insertable publicly" ON public.hack_events;

CREATE POLICY "Students insertable in lobby" ON public.game_students FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND s.status IN ('lobby','running')));

CREATE POLICY "Students updatable in active session" ON public.game_students FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND s.status IN ('lobby','running')));

CREATE POLICY "Hack events insertable in running session" ON public.hack_events FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND s.status = 'running'));
