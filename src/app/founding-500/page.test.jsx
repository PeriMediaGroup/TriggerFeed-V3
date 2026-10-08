import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Founding500Page from "./page";

const mocks = vi.hoisted(() => ({ registry: vi.fn() }));
vi.mock("@/features/profiles/data/getFounding500Registry", () => ({ getFounding500Registry: mocks.registry }));
vi.mock("@/features/profiles/constants/profileImages", () => ({ DEFAULT_PROFILE_AVATAR_URL: "/avatar.png" }));
vi.mock("@/lib/site", () => ({ SITE_NAME: "TriggerFeed", SITE_URL: "https://triggerfeed.test" }));
vi.mock("next/image", () => ({ default: "img" }));
vi.mock("next/link", () => ({ default: "a" }));
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

it.each([false, true])("shows provisional versus permanent public wording (finalized=%s)", async (finalized) => {
  mocks.registry.mockResolvedValue({ entries: [{ status: "retired", founding_member_number: 2 }], error: null, state: { finalized_at: finalized ? "2026-10-05" : null } });
  const html = renderToStaticMarkup(await Founding500Page());
  expect(html).toContain(finalized ? "Finalized: Founding numbers are permanent" : "Open enrollment: Founding positions are provisional");
  expect(html).toContain(finalized ? "Number permanently reserved" : "Position may be reclaimed");
});
