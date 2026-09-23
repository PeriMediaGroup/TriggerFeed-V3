// @vitest-environment jsdom
import React, { act, StrictMode, Suspense } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FeedAdsProvider } from "./FeedAds";
import { createAdSession } from "./adSession";
import PostFeed from "../posts/components/PostFeed";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), visitor: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/features/marketing/attribution", () => ({
  getDeviceCategory: () => "desktop", getOrCreateVisitorId: mocks.visitor,
}));
vi.mock("./adSession", async (original) => {
  const actual = await original();
  return { ...actual, createAdSession: vi.fn(actual.createAdSession) };
});
vi.mock("@/features/ads/FeedAds", async () => import("./FeedAds"));
vi.mock("../posts/components/PostCard", () => ({
  default: ({ post }) => <article data-post-id={post.id}>{post.id}</article>,
}));
vi.mock("@/features/comments/components/CommentList", () => ({ default: () => null }));
vi.mock("@/features/comments/components/CommentForm", () => ({ default: () => null }));

const posts = Array.from({ length: 40 }, (_, i) => ({ id: `post-${i + 1}` }));
let root;
let container;
let ticket;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.visitor.mockReturnValue("visitor");
  ticket = 0;
  mocks.rpc.mockImplementation(async (_, args) => ({ data: Array.from({ length: args.p_limit }, () => ({
    delivery_id: `ticket-${++ticket}`, ad_id: `campaign-${ticket % 2}`, creative_id: "creative",
    advertiser_type: "house", advertiser_name: "TriggerFeed", headline: `Ad ${ticket}`,
    body: "Test promotion", call_to_action: "View", destination_url: "https://triggerfeed.com/merch",
  })), error: null }));
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function tree(count = 24) {
  return <StrictMode><FeedAdsProvider postCount={count}>
    <PostFeed posts={posts.slice(0, count)} showAds />
  </FeedAdsProvider></StrictMode>;
}
function organicNodes() { return [...container.querySelectorAll("[data-post-id]")]; }
function adPositions() {
  return [...container.querySelectorAll(".feed-ad")].map((ad) =>
    Number(ad.previousElementSibling.dataset.postId.replace("post-", "")));
}

it("renders only organic SSR regardless of random source or clock, without starting a session", () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  const now = vi.spyOn(Date, "now").mockReturnValue(1000);
  const first = renderToString(tree());
  random.mockReturnValue(0.99);
  now.mockReturnValue(9999999999);
  expect(renderToString(tree())).toBe(first);
  container.innerHTML = first;
  expect(organicNodes()).toHaveLength(24);
  expect(adPositions()).toEqual([]);
  expect(createAdSession).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.visitor).not.toHaveBeenCalled();
  expect(random).not.toHaveBeenCalled();
});

it("hydrates without replacing organic DOM, then keeps variable 6–9 gaps stable on append and rerender", async () => {
  container.innerHTML = renderToString(tree());
  const original = organicNodes();
  const recover = vi.fn();
  const errors = vi.spyOn(console, "error");
  let draw = 0;
  const actual = await vi.importActual("./adSession");
  createAdSession.mockImplementationOnce(() => actual.createAdSession(() => [0, 0.25, 0.5, 0.75][draw++ % 4]));
  await act(async () => { root = hydrateRoot(container, tree(), { onRecoverableError: recover }); });
  expect(adPositions()).toEqual([6, 13, 21]);
  original.forEach((node, index) => expect(organicNodes()[index]).toBe(node));
  expect(createAdSession).toHaveBeenCalledTimes(1);
  const firstAds = [...container.querySelectorAll(".feed-ad")];
  await act(async () => root.render(tree(40)));
  expect(adPositions()).toEqual([6, 13, 21, 30, 36]);
  firstAds.forEach((node, index) => expect(container.querySelectorAll(".feed-ad")[index]).toBe(node));
  const requests = mocks.rpc.mock.calls.length;
  await act(async () => root.render(tree(40)));
  expect(mocks.rpc).toHaveBeenCalledTimes(requests);
  expect(createAdSession).toHaveBeenCalledTimes(1);
  expect(recover).not.toHaveBeenCalled();
  expect(errors).not.toHaveBeenCalled();
});

it("hydrates a delayed Suspense feed after its provider has already delivered ads", async () => {
  let suspended = false;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  function DelayedFeed() {
    if (suspended) throw pending;
    return <PostFeed posts={posts.slice(0, 24)} showAds />;
  }
  const element = <FeedAdsProvider postCount={24}>
    <Suspense fallback={<p>Loading</p>}><DelayedFeed /></Suspense>
  </FeedAdsProvider>;
  container.innerHTML = renderToString(element);
  const original = organicNodes();
  const recover = vi.fn();
  const errors = vi.spyOn(console, "error");
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  suspended = true;
  await act(async () => { root = hydrateRoot(container, element, { onRecoverableError: recover }); });
  expect(mocks.rpc).toHaveBeenCalled();
  expect(adPositions()).toEqual([]);
  await act(async () => { suspended = false; release(); });
  expect(adPositions()).toEqual([9, 18]);
  original.forEach((node, index) => expect(organicNodes()[index]).toBe(node));
  expect(recover).not.toHaveBeenCalled();
  expect(errors).not.toHaveBeenCalled();
});
