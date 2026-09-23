// @vitest-environment jsdom
import React, { act } from "react";
import { renderToString } from "react-dom/server";
import { createRoot, hydrateRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import Home from "../../../app/page";
import FeedPage from "./FeedPage";
import PostTimestamp from "../../posts/components/PostTimestamp";

const mocks = vi.hoisted(() => ({ posts: [], profile: {}, rpc: vi.fn(), getPosts: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "viewer" } } }) },
}) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/features/posts/data/getPosts", () => ({ getPosts: mocks.getPosts }));
vi.mock("@/features/profiles/data/getCurrentProfile", () => ({
  getCurrentProfile: async () => ({ profile: mocks.profile }),
}));
vi.mock("@/features/ranks/data/getUserRank", () => ({
  getUserRank: async () => ({ rank: null }), getRankThresholdMap: async () => new Map(),
  isHigherRank: () => false, isMilestoneEligibleRank: () => false,
}));
vi.mock("@/features/ranks/actions/acknowledgeRankMilestone", () => ({ acknowledgeRankMilestone: vi.fn() }));
vi.mock("@/features/posts/actions/deletePost", () => ({ deletePost: vi.fn() }));
vi.mock("@/features/polls/actions/answerPoll", () => ({ answerPoll: vi.fn() }));
vi.mock("@/features/votes/actions/togglePostVote", () => ({ togglePostVote: vi.fn() }));
vi.mock("@/features/reports/actions/reportPost", () => ({ reportPost: vi.fn() }));
vi.mock("@/features/comments/components/CommentList", () => ({ default: () => null }));
vi.mock("@/features/comments/components/CommentForm", () => ({ default: () => null }));

let container;
let root;
let errors;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.profile = { username: "viewer", dob: "1990-01-01" };
  mocks.posts = Array.from({ length: 24 }, (_, index) => ({
    id: `post-${index}`, user_id: index % 2 ? "other" : "viewer", title: `Post ${index}`,
    body: "Organic content", created_at: "2026-09-23T12:00:00.000Z", media: [],
    author: { username: `author${index}`, display_name: `Author ${index}`, founding_member_number: index % 2 ? null : 12 },
  }));
  mocks.getPosts.mockImplementation(async () => ({
    posts: mocks.posts, currentUserId: "viewer", commentsByPostId: {}, message: null,
  }));
  let ticket = 0;
  mocks.rpc.mockImplementation(async (_, args) => ({ data: Array.from({ length: args.p_limit }, () => ({
    ad_id: "campaign", delivery_id: `ticket-${++ticket}`, creative_id: "creative",
    advertiser_type: "house", advertiser_name: "TriggerFeed", headline: `Ad ${ticket}`,
    body: "Promotion", call_to_action: "View", destination_url: "https://triggerfeed.com/merch",
  })), error: null }));
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  container.remove();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Resolve only the async Server Components. All feed/card client components,
// Next links, media, polls, votes, profile markup and ad slots remain real.
async function authenticatedHome(feed = "main") {
  const page = await Home({ searchParams: Promise.resolve({ feed }) });
  expect(page.type).toBe(FeedPage);
  return FeedPage(page.props);
}

it("hydrates an authenticated / hard reload with Founding Member posts without replacing server DOM", async () => {
  const tree = await authenticatedHome();
  const html = renderToString(tree);
  container.innerHTML = html; // Browser HTML parsing is essential: it repairs nested anchors.
  const original = [...container.querySelectorAll(".post-card")];
  const recover = vi.fn();
  await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: recover }); });
  expect(recover.mock.calls.map(([error]) => error.message)).toEqual([]);
  expect(errors.mock.calls).toEqual([]);
  original.forEach((node, index) => expect(container.querySelectorAll(".post-card")[index]).toBe(node));
  expect(container.querySelector("a a")).toBeNull();
  expect(container.querySelectorAll(".post-card__founding-icon")).toHaveLength(12);
  expect(container.querySelector(".feed-tabs__link--active").textContent).toBe("Main");
  expect(container.querySelectorAll(".feed-ad").length).toBeGreaterThanOrEqual(2);
});

it("keeps initial navigation, tab selection and appended organic cards stable", async () => {
  root = createRoot(container);
  await act(async () => root.render(await authenticatedHome("friends")));
  expect(container.querySelector(".feed-tabs__link--active").textContent).toBe("Friends");
  const original = [...container.querySelectorAll(".post-card")];
  const ads = [...container.querySelectorAll(".feed-ad")];
  mocks.posts = [...mocks.posts, ...mocks.posts.map((post) => ({ ...post, id: `${post.id}-append` }))];
  await act(async () => root.render(await authenticatedHome("friends")));
  expect(container.querySelectorAll(".post-card")).toHaveLength(48);
  original.forEach((node, index) => expect(container.querySelectorAll(".post-card")[index]).toBe(node));
  ads.forEach((node, index) => expect(container.querySelectorAll(".feed-ad")[index]).toBe(node));
  expect(errors.mock.calls).toEqual([]);
});

it("hydrates stored browser preferences and mobile ad delivery only after the organic server render", async () => {
  const today = new Date().toISOString().slice(0, 10);
  mocks.profile.dob = `1990-${today.slice(5)}`;
  localStorage.setItem("triggerfeed.marketingVisitorId", "10000000-1000-4000-8000-100000000000");
  localStorage.setItem(`triggerfeed:milestone-dismissed:viewer:birthday:${today}`, "true");
  sessionStorage.setItem("feed", "trending");
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)");
  const tree = await authenticatedHome("main");
  container.innerHTML = renderToString(tree);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(container.querySelectorAll(".feed-ad")).toHaveLength(0);
  const original = [...container.querySelectorAll(".post-card")];
  const recover = vi.fn();
  await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: recover }); });
  expect(container.querySelector(".feed-tabs__link--active").textContent).toBe("Main");
  expect(container.querySelector(".birthday-greeting")).toBeNull();
  expect(mocks.rpc).toHaveBeenCalledWith("get_feed_ads", expect.objectContaining({ p_platform: "web_mobile" }));
  expect(recover).not.toHaveBeenCalled();
  expect(errors.mock.calls).toEqual([]);
  original.forEach((node, index) => expect(container.querySelectorAll(".post-card")[index]).toBe(node));
});

it("hydrates post timestamps across clock changes without suppressing a mismatch", async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-23T12:01:00Z"));
  const tree = <PostTimestamp value="2026-09-23T12:00:00.000Z" />;
  container.innerHTML = renderToString(tree);
  const time = container.querySelector("time");
  expect(time.textContent).toBe("2026-09-23");
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-23T12:03:00Z"));
  const recover = vi.fn();
  await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: recover }); });
  expect(container.querySelector("time")).toBe(time);
  expect(time.textContent).toBe("3 minutes ago");
  expect(recover).not.toHaveBeenCalled();
  expect(errors.mock.calls).toEqual([]);
});
