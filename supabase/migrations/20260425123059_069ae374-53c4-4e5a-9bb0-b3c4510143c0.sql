ALTER TABLE public.game_students ALTER COLUMN crypto SET DEFAULT 0;
UPDATE public.game_students SET crypto = 0 WHERE crypto = 1000000;