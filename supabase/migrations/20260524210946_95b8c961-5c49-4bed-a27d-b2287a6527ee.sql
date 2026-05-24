
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public) VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Question images publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'question-images');

CREATE POLICY "Authenticated can upload question images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'question-images');

CREATE POLICY "Authenticated can update own question images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'question-images');

CREATE POLICY "Authenticated can delete own question images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'question-images');
