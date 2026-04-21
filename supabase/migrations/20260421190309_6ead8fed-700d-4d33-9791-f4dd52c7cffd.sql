ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS current_question_started_at timestamptz;
ALTER TABLE public.game_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.game_students REPLICA IDENTITY FULL;
ALTER TABLE public.hack_events REPLICA IDENTITY FULL;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='game_students';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.game_students'; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='hack_events';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.hack_events'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.question_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  question_id uuid NOT NULL,
  question_index int NOT NULL,
  answer_index int NOT NULL,
  is_correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id, question_index)
);
ALTER TABLE public.question_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Responses readable publicly" ON public.question_responses;
DROP POLICY IF EXISTS "Responses insertable in running session" ON public.question_responses;
CREATE POLICY "Responses readable publicly" ON public.question_responses FOR SELECT USING (true);
CREATE POLICY "Responses insertable in running session" ON public.question_responses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND s.status = 'running')
);
ALTER TABLE public.question_responses REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='question_responses';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.question_responses'; END IF;
END $$;