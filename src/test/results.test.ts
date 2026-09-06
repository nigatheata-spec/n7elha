import { describe, it, expect } from "vitest";
import { rankStudents, type RankableStudent } from "@/lib/results";

const s = (id: string, extra: Partial<RankableStudent> = {}): RankableStudent => ({ id, ...extra });

describe("rankStudents — dodgeball", () => {
  it("puts survivors above the eliminated", () => {
    const out = rankStudents(
      [s("dead", { eliminated: true, eliminated_at: "2026-01-01T00:01:00Z" }), s("alive", { eliminated: false })],
      "dodgeball",
    );
    expect(out.map(x => x.id)).toEqual(["alive", "dead"]);
  });

  it("ranks the eliminated by who lasted longest", () => {
    const out = rankStudents(
      [
        s("first_out", { eliminated: true, eliminated_at: "2026-01-01T00:01:00Z" }),
        s("last_out", { eliminated: true, eliminated_at: "2026-01-01T00:09:00Z" }),
        s("mid_out", { eliminated: true, eliminated_at: "2026-01-01T00:05:00Z" }),
      ],
      "dodgeball",
    );
    expect(out.map(x => x.id)).toEqual(["last_out", "mid_out", "first_out"]);
  });

  it("keeps every player when several survive", () => {
    const out = rankStudents([s("a"), s("b"), s("c")], "dodgeball");
    expect(out).toHaveLength(3);
  });

  it("does not mutate the input array", () => {
    const input = [s("dead", { eliminated: true }), s("alive")];
    const copy = [...input];
    rankStudents(input, "dodgeball");
    expect(input).toEqual(copy);
  });
});

describe("rankStudents — humans vs zombies", () => {
  const roster = [
    s("z_rich", { team: "zombie", crypto: 900 }),
    s("h_poor", { team: "human", crypto: 100 }),
    s("h_rich", { team: "human", crypto: 500 }),
  ];

  it("puts the whole winning team above the losers, regardless of cash", () => {
    const out = rankStudents(roster, "humansvszombies", { hvzWinner: "humans" });
    expect(out.map(x => x.id)).toEqual(["h_rich", "h_poor", "z_rich"]);
  });

  it("flips when the zombies win", () => {
    const out = rankStudents(roster, "humansvszombies", { hvzWinner: "zombies" });
    expect(out[0].id).toBe("z_rich");
  });

  it("treats a missing winner as a human win", () => {
    const out = rankStudents(roster, "humansvszombies");
    expect(out[0].team).toBe("human");
  });
});

describe("rankStudents — don't look down", () => {
  it("ranks by height climbed, not cash", () => {
    const out = rankStudents(
      [s("low", { height_reached: 20, crypto: 9999 }), s("high", { height_reached: 400, crypto: 0 })],
      "dontlookdown",
    );
    expect(out.map(x => x.id)).toEqual(["high", "low"]);
  });

  it("treats a player who never climbed as zero rather than dropping them", () => {
    const out = rankStudents([s("never"), s("climbed", { height_reached: 5 })], "dontlookdown");
    expect(out.map(x => x.id)).toEqual(["climbed", "never"]);
  });
});

describe("rankStudents — paint fight", () => {
  it("ranks by territory share", () => {
    const pct = new Map([["a", 12], ["b", 47]]);
    const out = rankStudents([s("a"), s("b")], "paintfight", { paintPctById: pct });
    expect(out.map(x => x.id)).toEqual(["b", "a"]);
  });

  it("survives a missing coverage map instead of throwing", () => {
    const out = rankStudents([s("a"), s("b")], "paintfight");
    expect(out).toHaveLength(2);
  });
});

describe("rankStudents — points modes", () => {
  it.each(["crypto_rush", "classic", "hotpotato", "lavafloor"])(
    "leaves %s in the order the query returned",
    mode => {
      const input = [s("a", { crypto: 300 }), s("b", { crypto: 200 })];
      expect(rankStudents(input, mode).map(x => x.id)).toEqual(["a", "b"]);
    },
  );
});
