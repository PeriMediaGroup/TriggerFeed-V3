import { describe, expect, test } from "vitest";
import { isAtLeastMinimumAge, isValidDobString } from "./ageGate";

describe("age gate helpers", () => {
  test("accepts valid adult DOB", () => {
    expect(
      isAtLeastMinimumAge("2000-06-11", new Date("2026-06-11T12:00:00")),
    ).toBe(true);
  });

  test("blocks users before their eighteenth birthday", () => {
    expect(
      isAtLeastMinimumAge("2008-06-12", new Date("2026-06-11T12:00:00")),
    ).toBe(false);
  });

  test("rejects malformed DOB strings", () => {
    expect(isValidDobString("not-a-date")).toBe(false);
    expect(isAtLeastMinimumAge("", new Date("2026-06-11T12:00:00"))).toBe(
      false,
    );
  });
});
