-- First real Physical Games kit for printing/testing.
INSERT INTO public.kits (id, label) VALUES ('K0001', 'Kit 1') ON CONFLICT (id) DO NOTHING;
