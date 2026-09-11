import { describe, expect, test } from "vitest";
import { getPostPath, isUuid } from "./postUrls";

describe("post URL helpers", () => {
  test("uses slug before UUID for post paths", () => {
    expect(getPostPath({ id: "post-id", slug: "best-optic-for-glock-19" })).toBe(
      "/posts/best-optic-for-glock-19",
    );
  });

  test("falls back to UUID when slug is missing", () => {
    expect(getPostPath({ id: "e14e2fd5-96ba-4bef-8426-f9988685c3f6" })).toBe(
      "/posts/e14e2fd5-96ba-4bef-8426-f9988685c3f6",
    );
  });

  test("detects UUID route parameters", () => {
    expect(isUuid("e14e2fd5-96ba-4bef-8426-f9988685c3f6")).toBe(true);
    expect(isUuid("best-optic-for-glock-19")).toBe(false);
  });
});
