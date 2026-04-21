
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  language TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles insertable by owner" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles updatable by owner" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Quizzes
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  grade_level TEXT,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quizzes viewable by owner" ON public.quizzes FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Quizzes insertable by owner" ON public.quizzes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Quizzes updatable by owner" ON public.quizzes FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Quizzes deletable by owner" ON public.quizzes FOR DELETE USING (auth.uid() = created_by);
CREATE TRIGGER quizzes_updated BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  difficulty TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions viewable by quiz owner" ON public.questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.created_by = auth.uid()));
CREATE POLICY "Questions insertable by quiz owner" ON public.questions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.created_by = auth.uid()));
CREATE POLICY "Questions updatable by quiz owner" ON public.questions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.created_by = auth.uid()));
CREATE POLICY "Questions deletable by quiz owner" ON public.questions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.created_by = auth.uid()));

-- Game sessions
CREATE TABLE public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'lobby',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_question_index INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
-- Public can read by code (so students can join)
CREATE POLICY "Sessions readable publicly" ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "Sessions insertable by teacher" ON public.game_sessions FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Sessions updatable by teacher" ON public.game_sessions FOR UPDATE
  USING (auth.uid() = teacher_id);
CREATE POLICY "Sessions deletable by teacher" ON public.game_sessions FOR DELETE
  USING (auth.uid() = teacher_id);

-- Game students
CREATE TABLE public.game_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  crypto BIGINT NOT NULL DEFAULT 1000000,
  correct_answers INT NOT NULL DEFAULT 0,
  total_answers INT NOT NULL DEFAULT 0,
  hacks_made INT NOT NULL DEFAULT 0,
  hacks_received INT NOT NULL DEFAULT 0,
  password TEXT,
  is_breached BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.game_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students readable publicly" ON public.game_students FOR SELECT USING (true);
CREATE POLICY "Students insertable publicly" ON public.game_students FOR INSERT WITH CHECK (true);
CREATE POLICY "Students updatable publicly" ON public.game_students FOR UPDATE USING (true);
CREATE POLICY "Students deletable by teacher" ON public.game_students FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND s.teacher_id = auth.uid()));

-- Hack events
CREATE TABLE public.hack_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  hacker_id UUID NOT NULL REFERENCES public.game_students(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.game_students(id) ON DELETE CASCADE,
  password_attempted TEXT,
  success BOOLEAN NOT NULL,
  crypto_transferred BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hack_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hack events readable publicly" ON public.hack_events FOR SELECT USING (true);
CREATE POLICY "Hack events insertable publicly" ON public.hack_events FOR INSERT WITH CHECK (true);

-- Storage bucket for uploaded documents
INSERT INTO storage.buckets (id, name, public) VALUES ('quiz-documents', 'quiz-documents', false);
CREATE POLICY "Users can upload their own documents" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'quiz-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read their own documents" ON storage.objects FOR SELECT
  USING (bucket_id = 'quiz-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own documents" ON storage.objects FOR DELETE
  USING (bucket_id = 'quiz-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_students;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hack_events;
ALTER TABLE public.game_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.game_students REPLICA IDENTITY FULL;
ALTER TABLE public.hack_events REPLICA IDENTITY FULL;
