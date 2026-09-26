import { describe, it, expect } from "vitest";
import { buildMap, distanceField, spawnFor, solidAt, roomsFor, zeroCount, FLOOR, SECRET, TILE } from "@/lib/humansVsZombies";

describe("humans vs zombies building", () => {
  const sizes = [1, 8, 14, 20, 30, 40].map(roomsFor);
  it.each(sizes)("zombies reach every room but the safe room, and never get in (%i x %i)", (rw, rh) => {
    for (const seed of ["a", "b", "c", "session-123", "x9"]) {
      const m = buildMap(seed, rw, rh);
      expect(m.rooms).toHaveLength(rw * rh);
      const d = distanceField(m, m.rooms[0].cx, m.rooms[0].cy);
      m.rooms.forEach((r, i) => {
        const reached = d[r.cy * m.cols + r.cx] >= 0;
        expect(reached).toBe(i !== m.safe);
      });
      let floor = 0, reached = 0;
      m.tiles.forEach((t, i) => {
        if (t !== FLOOR || m.roomOf[i] === m.safe) return;
        floor++; if (d[i] >= 0) reached++;
      });
      expect(reached).toBe(floor);
    }
  });

  it("gives every safe room hatches and exits for humans", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const m = buildMap(seed, 4, 4);
      expect(m.safe).toBeGreaterThan(0);
      expect(m.tiles.some(t => t === SECRET)).toBe(true);
      expect(m.safeExits.length).toBeGreaterThan(0);
      for (const e of m.safeExits) expect(solidAt(m, e.x, e.y)).toBe(false);
    }
  });

  it("furnishes the rooms", () => {
    const m = buildMap("props", 4, 4);
    expect(m.props.length).toBeGreaterThan(m.rooms.length * 4);
  });

  it("is the same building on every phone", () => {
    expect(Array.from(buildMap("s", 4, 3).tiles)).toEqual(Array.from(buildMap("s", 4, 3).tiles));
  });

  it("never spawns anyone inside a wall", () => {
    const m = buildMap("spawn", 4, 4);
    for (let i = 0; i < 200; i++) for (const team of ["human", "zombie"] as const) {
      const p = spawnFor(m, team);
      expect(solidAt(m, p.x, p.y)).toBe(false);
      if (team === "zombie") expect(m.roomOf[Math.floor(p.y / TILE) * m.cols + Math.floor(p.x / TILE)]).toBe(0);
    }
  });

  it("always leaves a human and, with company, a zombie", () => {
    for (let n = 2; n < 40; n++) {
      expect(zeroCount(n)).toBeGreaterThanOrEqual(1);
      expect(zeroCount(n)).toBeLessThan(n);
    }
  });
});
