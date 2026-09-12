import { describe, expect, test } from "vitest";

import {
  getRichPostVisibleTextLength,
  normalizePostBodyForStorage,
  plainTextToRichPostHtml,
  richPostHtmlToPlainText,
  sanitizeRichPostHtml,
} from "./richText";

describe("rich post text helpers", () => {
  test("preserves the supported formatting allowlist", () => {
    const result = sanitizeRichPostHtml(
      '<p>Check <strong>bold</strong> and <em>italic</em></p><ul><li>One</li></ul><ol><li>Two</li></ol>',
    );

    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
    expect(result).toContain("<ul><li>One</li></ul>");
    expect(result).toContain("<ol><li>Two</li></ol>");
  });

  test("strips scripts, event handlers, styles, and unsafe link protocols", () => {
    const result = sanitizeRichPostHtml(
      '<p style="color:red" onclick="alert(1)">Hi<script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="https://example.com" onclick="alert(1)">good</a></p>',
    );

    expect(result).not.toContain("script");
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("style=");
    expect(result).not.toContain("javascript:");
    expect(result).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">good</a>',
    );
  });

  test("converts old plain-text posts to sanitized paragraph HTML", () => {
    expect(plainTextToRichPostHtml("Line one\nLine two")).toBe(
      "<p>Line one<br>Line two</p>",
    );
    expect(normalizePostBodyForStorage("Plain post")).toBe("<p>Plain post</p>");
  });

  test("extracts clean visible text for metadata and limits", () => {
    const html = '<p>Check <strong>Palmetto State Armory</strong></p>';

    expect(richPostHtmlToPlainText(html)).toBe(
      "Check Palmetto State Armory",
    );
    expect(getRichPostVisibleTextLength(html)).toBe(27);
  });
});
