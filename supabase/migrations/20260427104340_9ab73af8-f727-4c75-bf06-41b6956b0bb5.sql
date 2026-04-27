CREATE POLICY "Questions readable for active sessions"
ON public.questions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.game_sessions s
  WHERE s.quiz_id = questions.quiz_id
    AND s.status IN ('lobby','running','finished')
));