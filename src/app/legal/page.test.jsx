import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LegalPage from "./page";
import CSAE from "./components/CSAE";

const text = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("published child safety standards", () => {
  it("explicitly identifies the app, operator, prohibited conduct and reporting path", () => {
    const html = renderToStaticMarkup(<CSAE />);
    const copy = text(html);
    expect(html).toContain('id="csae"');
    for (const phrase of [
      "Child Safety Standards: Child Sexual Abuse and Exploitation (CSAE)",
      "TriggerFeed, operated by Peri Media Group, LLC, strictly prohibits Child Sexual Abuse and Exploitation (CSAE), including Child Sexual Abuse Material (CSAM).",
      "adults-only (18+)", "all activity on TriggerFeed", "Creating, sharing, requesting, distributing, or promoting CSAM",
      "Grooming or sexual solicitation of minors", "Sexual exploitation or trafficking of minors", "Sextortion involving minors",
      "Report Abuse form", "Illegal content", "remove content", "restrictions or bans", "as required by law",
    ]) expect(copy).toContain(phrase);
    expect(html).toContain('href="#abuse"');
    expect(copy).not.toMatch(/immediately banned|reviewed promptly|reported to NCMEC|24\/7|automated scanning/);
  });

  it("retains every existing legal section and the abuse form", () => {
    const html = renderToStaticMarkup(<LegalPage />);
    for (const id of ["legal-top", "terms", "privacy", "cookies", "csae", "abuse"]) {
      expect(html.match(new RegExp(`id="${id}"`, "g"))).toHaveLength(1);
      expect(html).toContain(`href="#${id}"`);
    }
    for (const phrase of ["Terms of Service", "Privacy Policy", "Cookie Policy", "We do not sell your data.", "Disabling cookies may result in limited functionality.", "Your Email", "Offending Username", "Submit Report"]) expect(text(html)).toContain(phrase);
  });

  it("keeps Legal public without route-level indexing restrictions", () => {
    const proxy = readFileSync(new URL("../../lib/supabase/proxy.js", import.meta.url), "utf8");
    expect(proxy.match(/const PUBLIC_PATHS = new Set\(\[([\s\S]*?)\]\)/)?.[1]).toContain('"/legal"');
    const layout = readFileSync(new URL("./layout.jsx", import.meta.url), "utf8");
    expect(layout).not.toMatch(/redirect\(|noindex|index:\s*false/);
  });
});
