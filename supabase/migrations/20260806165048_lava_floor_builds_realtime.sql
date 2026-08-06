-- Without this the build feed / tower height only update on a manual refresh
ALTER TABLE public.lava_floor_builds REPLICA IDENTITY FULL;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='lava_floor_builds';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.lava_floor_builds';
  END IF;
END $$;
