// @vitest-environment jsdom
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import WelcomePage, { metadata } from "../../app/welcome/page";
import AboutPage from "../../app/about/page";
import { getWelcomeLinks } from "./welcomeLinks";
import { parseAttributionParams } from "../marketing/attribution";

const mocks = vi.hoisted(() => ({ user: null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));
beforeEach(() => {
  vi.stubGlobal("React", React);
  mocks.user = null;
});
afterEach(() => vi.unstubAllGlobals());

it("renders the public introduction and each signup/sign-in destination on the server", async () => {
  const html = renderToString(
    await WelcomePage({ searchParams: Promise.resolve({}) }),
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.querySelectorAll("h1")).toHaveLength(1);
  expect(doc.querySelector("h1").textContent).toBe("Train. Carry.Stay Ready.");
  const expected = {
    "Join TriggerFeed": "/signup",
    "Create Your Account": "/signup",
    "Create a Creator Account": "/signup/creator",
    "Create an Organization Account": "/signup/organization",
    "Sign In": "/login",
  };
  for (const [label, path] of Object.entries(expected)) {
    const matches = [...doc.querySelectorAll("a")].filter(
      (a) => a.textContent === label,
    );
    expect(matches.length).toBeGreaterThan(0);
    matches.forEach((a) => expect(a.getAttribute("href")).toBe(path));
  }
  expect(doc.querySelectorAll(".welcome__audience")).toHaveLength(3);
  expect(doc.querySelectorAll(".welcome__preview")).toHaveLength(3);
  expect(doc.body.textContent).toContain(
    "does not automatically grant verification",
  );
});

it("keeps the page available to authenticated visitors with a feed path", async () => {
  mocks.user = { id: "viewer" };
  const doc = new DOMParser().parseFromString(
    renderToString(await WelcomePage({})),
    "text/html",
  );
  expect(doc.querySelector(".welcome")).not.toBeNull();
  expect(
    doc.querySelector(".welcome__button--primary").getAttribute("href"),
  ).toBe("/");
  expect(doc.querySelector(".welcome__button--primary").textContent).toBe(
    "Go to Your Feed",
  );
  expect(doc.querySelector("main")).toBeNull(); // Authenticated shell already owns main.
});

it("carries existing marketing and referral values into every route without needing browser storage", async () => {
  const params = {
    source: "psa",
    campaign: "business-card",
    ref: "Invite_123",
    utm_content: "qr & event",
    next: "https://untrusted.example",
  };
  const links = getWelcomeLinks(params);
  for (const href of Object.values(links)) {
    const url = new URL(href, "https://www.triggerfeed.com");
    expect(url.searchParams.get("ref")).toBe("Invite_123");
    expect(url.searchParams.get("utm_content")).toBe("qr & event");
    expect(url.searchParams.has("next")).toBe(false);
    expect(parseAttributionParams(url.searchParams)).toEqual({
      source: "psa",
      campaign: "business-card",
    });
  }
  const html = renderToString(
    await WelcomePage({ searchParams: Promise.resolve(params) }),
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const anchor of doc.querySelectorAll('a[href^="/signup"]')) {
    expect(
      new URL(
        anchor.getAttribute("href"),
        "https://www.triggerfeed.com",
      ).searchParams.get("ref"),
    ).toBe("Invite_123");
  }
});

it("preserves internal-ad markers so signup does not reclassify ads as acquisition", () => {
  const links = getWelcomeLinks({
    source: "psa",
    campaign: "uuid-campaign",
    utm_medium: "in-feed-ad",
  });
  Object.values(links).forEach((href) => {
    expect(
      parseAttributionParams(
        new URL(href, "https://www.triggerfeed.com").searchParams,
      ),
    ).toBeNull();
  });
});

it("handles repeated and missing query values without inventing acquisition values", () => {
  const links = getWelcomeLinks({
    source: ["psa", "other"],
    campaign: "",
    ref: undefined,
  });
  expect(links.creator).toBe("/signup/creator?source=psa");
  expect(getWelcomeLinks().member).toBe("/signup");
});

it("uses canonical, query-free welcome metadata and keeps About informational", () => {
  expect(metadata.title.absolute).toBe("TriggerFeed | The Firearms Community");
  expect(metadata.alternates.canonical).toBe("/welcome");
  expect(metadata.openGraph.url).toBe("https://www.triggerfeed.com/welcome");
  const text = renderToString(<AboutPage />);
  [
    "Members",
    "Creators",
    "Organizations",
    "Responsible Ownership",
    "Practical principles",
  ].forEach((value) => expect(text).toContain(value));
});
