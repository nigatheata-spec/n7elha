/* Who won. Each mode scores on a different column, so this is the one place
   the ranking rule per mode is written down. */

export type RankableStudent = {
  id: string;
  crypto?: number | null;
  eliminated?: boolean | null;
  eliminated_at?: string | null;
  team?: string | null;
  height_reached?: number | null;
};

export type RankOptions = {
  hvzWinner?: "humans" | "zombies";
  /** Paint Fight territory share, keyed by student id. */
  paintPctById?: Map<string, number>;
};

export const rankStudents = <T extends RankableStudent>(
  students: T[],
  mode: string,
  { hvzWinner, paintPctById }: RankOptions = {},
): T[] => {
  if (mode === "dodgeball") {
    // Survivors first, then the eliminated in reverse order of elimination:
    // lasting longer places higher.
    return [...students].sort((a, b) => {
      if (!a.eliminated && b.eliminated) return -1;
      if (a.eliminated && !b.eliminated) return 1;
      if (a.eliminated_at && b.eliminated_at)
        return new Date(b.eliminated_at).getTime() - new Date(a.eliminated_at).getTime();
      return 0;
    });
  }

  if (mode === "humansvszombies") {
    const winningTeam = hvzWinner === "zombies" ? "zombie" : "human";
    return [...students].sort((a, b) => {
      if (a.team === winningTeam && b.team !== winningTeam) return -1;
      if (a.team !== winningTeam && b.team === winningTeam) return 1;
      return (b.crypto ?? 0) - (a.crypto ?? 0);
    });
  }

  if (mode === "dontlookdown") {
    return [...students].sort((a, b) => (b.height_reached ?? 0) - (a.height_reached ?? 0));
  }

  if (mode === "paintfight") {
    const pct = paintPctById ?? new Map<string, number>();
    return [...students].sort((a, b) => (pct.get(b.id) ?? 0) - (pct.get(a.id) ?? 0));
  }

  // Crypto Rush, Classic and Hot Potato all accumulate into `crypto`, and the
  // query already returns them in descending order.
  return students;
};
