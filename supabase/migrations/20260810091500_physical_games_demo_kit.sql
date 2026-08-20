-- Demo kit for testing the Physical Games scanner flow before real kits exist.
INSERT INTO public.kits (id, label) VALUES ('DEMO1', 'Demo Kit') ON CONFLICT (id) DO NOTHING;
