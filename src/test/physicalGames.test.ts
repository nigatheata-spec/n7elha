import { describe, it, expect } from "vitest";
import { parseKitQR, parseSquareQR, SQUARE_TYPES } from "@/lib/physicalGames";

/* These parse strings a camera read off a printed board, so they are a real
   input boundary: anything that isn't a board code must come back null rather
   than becoming a lookup for a kit that doesn't exist. */

describe("parseKitQR", () => {
  it("reads a kit id out of a full URL", () => {
    expect(parseKitQR("https://nefelha.app/kit/K4471")).toBe("K4471");
  });

  it("tolerates a trailing slash, query and fragment", () => {
    expect(parseKitQR("https://nefelha.app/kit/K4471/")).toBe("K4471");
    expect(parseKitQR("https://nefelha.app/kit/K4471?utm=print")).toBe("K4471");
    expect(parseKitQR("https://nefelha.app/kit/K4471#top")).toBe("K4471");
  });

  it("accepts a bare code typed into the manual fallback", () => {
    expect(parseKitQR("K4471")).toBe("K4471");
  });

  it("trims surrounding whitespace", () => {
    expect(parseKitQR("  K4471  ")).toBe("K4471");
  });

  it("rejects a code that is too short or too long to be a kit", () => {
    expect(parseKitQR("K4")).toBeNull();
    expect(parseKitQR("K".repeat(21))).toBeNull();
  });

  it("rejects unrelated text and URLs", () => {
    expect(parseKitQR("")).toBeNull();
    expect(parseKitQR("hello world")).toBeNull();
    expect(parseKitQR("https://example.com/")).toBeNull();
  });
});

describe("parseSquareQR", () => {
  it("reads kit and square out of a full URL", () => {
    expect(parseSquareQR("https://nefelha.app/scan/K4471/3")).toEqual({ kitId: "K4471", typeCode: 3 });
  });

  it("tolerates a trailing slash, query and fragment", () => {
    expect(parseSquareQR("https://nefelha.app/scan/K4471/3/")).toEqual({ kitId: "K4471", typeCode: 3 });
    expect(parseSquareQR("https://nefelha.app/scan/K4471/3?v=2")).toEqual({ kitId: "K4471", typeCode: 3 });
  });

  it("accepts the bare kit/square form", () => {
    expect(parseSquareQR("K4471/6")).toEqual({ kitId: "K4471", typeCode: 6 });
  });

  it("accepts every square the board actually has", () => {
    for (const code of Object.keys(SQUARE_TYPES)) {
      expect(parseSquareQR(`K4471/${code}`)).toEqual({ kitId: "K4471", typeCode: Number(code) });
    }
  });

  it("rejects a square number the board does not have", () => {
    expect(parseSquareQR("K4471/0")).toBeNull();
    expect(parseSquareQR("K4471/7")).toBeNull();
    expect(parseSquareQR("https://nefelha.app/scan/K4471/9")).toBeNull();
  });

  it("rejects a kit QR handed to the square parser", () => {
    expect(parseSquareQR("https://nefelha.app/kit/K4471")).toBeNull();
  });

  it("rejects junk", () => {
    expect(parseSquareQR("")).toBeNull();
    expect(parseSquareQR("K4471")).toBeNull();
    expect(parseSquareQR("a/b/c")).toBeNull();
  });
});

describe("SQUARE_TYPES", () => {
  it("covers codes 1 through 6, which is what is printed on a board", () => {
    expect(Object.keys(SQUARE_TYPES).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("labels every square in both languages and gives it a colour", () => {
    for (const sq of Object.values(SQUARE_TYPES)) {
      expect(sq.label_ar).toBeTruthy();
      expect(sq.label_en).toBeTruthy();
      expect(sq.color).toMatch(/^#|^hsl|^rgb/);
    }
  });
});
