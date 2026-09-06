import { describe, it, expect } from "vitest";
import { readSettings } from "@/lib/sessionSettings";

/* `settings` comes back from Postgres as an untyped jsonb blob, and older
   sessions predate keys added later, so reading it must never throw. */
describe("readSettings", () => {
  it("passes an object through", () => {
    expect(readSettings({ mode: "crypto_rush", minutes: 10 })).toEqual({ mode: "crypto_rush", minutes: 10 });
  });

  it("returns an empty object for a session that has no settings yet", () => {
    expect(readSettings(null)).toEqual({});
    expect(readSettings(undefined)).toEqual({});
  });

  it("returns an empty object rather than a broken shape for non-object json", () => {
    expect(readSettings("crypto_rush")).toEqual({});
    expect(readSettings(42)).toEqual({});
    expect(readSettings(true)).toEqual({});
    expect(readSettings([1, 2, 3])).toEqual({});
  });

  it("leaves keys it does not know about alone", () => {
    const out = readSettings({ mode: "classic", somethingNew: "keep me" } as never);
    expect((out as Record<string, unknown>).somethingNew).toBe("keep me");
  });

  it("reads a missing key as undefined so callers can default it", () => {
    expect(readSettings({ mode: "classic" }).minutes).toBeUndefined();
  });
});
