import type { Json } from "@/integrations/supabase/types";

/* `game_sessions.settings` is a jsonb blob, so the generated Supabase type is
   `Json` and every read off it is untyped. This is the one place that shape is
   written down: shared keys first, then the per-mode keys each mode's own
   monitor/game pair writes. */
export type SessionSettings = {
  mode?: string;
  minutes?: number;
  maxStudents?: number;
  timePerQ?: number | null;
  lang?: string;
  dueAt?: string | null;

  /* Crypto Rush */
  cryptoCap?: number;

  /* Hot Potato */
  bombHolderId?: string | null;
  bombExplodesAt?: string | null;
  explosionCount?: number;
  maxExplosions?: number;
  lastExplosionAt?: string | null;
  lastExplosionVictimId?: string | null;

  /* Lava Floor: who shares a tower (the lava itself lives in lava_state).
     lavaLevel/lavaRate/lavaSnapshotAt are the old version's, kept for old rows. */
  lfMode?: "class" | "teams" | "solo";
  lfTeams?: number;
  lavaLevel?: number;
  lavaRate?: number;
  lavaSnapshotAt?: string | null;

  /* Humans vs Zombies */
  /** Room grid [across, down], fixed at Start from the roster. */
  hvzRooms?: [number, number];
  winner?: string | null;

  /* Paint Fight */
  arenaCols?: number;
  arenaRows?: number;
};

export const readSettings = (settings: Json | null | undefined): SessionSettings =>
  settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as SessionSettings)
    : {};
