import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PostFeed from "../posts/components/PostFeed";
import { FeedList } from "../../../../app/src/features/feed/components/FeedList";
import { createAdSession } from "../../../../app/src/features/ads/adSession";

const mocks = vi.hoisted(() => ({
  states: [], refs: [], stateIndex: 0, refIndex: 0,
  getHomeFeed: vi.fn(), getFeedAds: vi.fn(), recordAdEvent: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original(),
  useState: (initial) => {
    const index = mocks.stateIndex++;
    if (!(index in mocks.states)) mocks.states[index] = typeof initial === "function" ? initial() : initial;
    return [mocks.states[index], (value) => {
      mocks.states[index] = typeof value === "function" ? value(mocks.states[index]) : value;
    }];
  },
  useRef: (initial) => {
    const index = mocks.refIndex++;
    return mocks.refs[index] ??= { current: initial };
  },
  useCallback: (callback) => callback,
  useMemo: (callback) => callback(),
  useEffect: (callback) => { callback(); },
}));
vi.mock("../../../../app/node_modules/react", async () => import("react"));
vi.mock("../../../../app/node_modules/expo-router", () => ({ useFocusEffect: vi.fn() }));
vi.mock("../../../../app/node_modules/react-native", () => ({
  ActivityIndicator: "ActivityIndicator", FlatList: "FlatList", Pressable: "Pressable",
  Text: "Text", View: "View", StyleSheet: { create: (styles) => styles },
  AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
}));
vi.mock("@/features/ads/FeedAdCard", () => ({ FeedAdCard: "NativeAd" }));
vi.mock("@/features/ads/api", () => ({ getFeedAds: mocks.getFeedAds, recordAdEvent: mocks.recordAdEvent }));
vi.mock("@/features/ads/adSession", async () => import("../../../../app/src/features/ads/adSession"));
vi.mock("@/features/feed/components/PostCard", () => ({ PostCard: "NativePost" }));
vi.mock("@/features/feed/components/FeedTabs", () => ({ FeedTabs: "FeedTabs" }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => ({ profile: {} }) }));
vi.mock("@/features/feed/api/getHomeFeed", () => ({ getHomeFeed: mocks.getHomeFeed }));
vi.mock("@/features/invites/components/InviteFriendsCard", () => ({ InviteFriendsCard: "Invite" }));
vi.mock("@/theme/tokens", () => ({ colors: {}, radius: {}, spacing: {}, typography: { size: {}, weight: {}, lineHeight: {} } }));
vi.mock("@/features/ads/FeedAds", () => ({ FeedAdSlot: "WebAdSlot" }));
vi.mock("../posts/components/PostCard", () => ({ default: "WebPost" }));
vi.mock("@/features/comments/components/CommentList", () => ({ default: "Comments" }));
vi.mock("@/features/comments/components/CommentForm", () => ({ default: "CommentForm" }));

const posts = Array.from({ length: 30 }, (_, i) => Object.freeze({ id: `post-${i}` }));
function nativeRender() {
  mocks.stateIndex = mocks.refIndex = 0;
  return FeedList({ feedType: "main", onFeedTypeChange: vi.fn() });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  mocks.states = [];
  mocks.refs = [];
});
afterEach(() => vi.unstubAllGlobals());

describe("organic feed presentation", () => {
  it("web retains organic IDs, references and order when pages are appended", () => {
    function render(data) {
      const tree = PostFeed({ posts: data, showAds: true });
      return tree.props.children.map((fragment) => ({
        key: fragment.key, post: fragment.props.children[0].props.post,
        after: fragment.props.children[1].props.after,
      }));
    }
    const first = render(posts.slice(0, 14));
    const appended = render(posts);
    expect(appended.slice(0, 14)).toEqual(first);
    expect(appended.map((row) => row.key)).toEqual(posts.map((post) => post.id));
    appended.forEach((row, index) => {
      expect(row.post).toBe(posts[index]);
      expect(row.after).toBe(index + 1);
    });
  });

  it("Android inserts ads without changing organic rows, keys or rerender placement", async () => {
    const slots = await createAdSession(() => 0.25).fill(30, async (count) =>
      Array.from({ length: count }, (_, i) => ({ ad_id: "campaign", delivery_id: `ticket-${i}` })));
    // FeedList states: slots, error, loading, organic posts, refreshing.
    mocks.states = [slots, null, false, posts.slice(0, 14), false];
    const first = nativeRender();
    mocks.states[3] = posts;
    const appended = nativeRender();
    expect(appended.props.data.slice(0, first.props.data.length)).toEqual(first.props.data);
    expect(nativeRender().props.data).toEqual(appended.props.data);
    const organic = appended.props.data.filter((row) => row.kind === "post");
    expect(organic.map(appended.props.keyExtractor)).toEqual(posts.map((post) => post.id));
    organic.forEach((row, i) => expect(row.post).toBe(posts[i]));
    expect(appended.props.data.filter((row) => row.kind === "ad").map(appended.props.keyExtractor))
      .toEqual(slots.map((slot) => slot.ad.delivery_id));
  });

  it("Android pull-to-refresh replaces the session and ignores an older feed response", async () => {
    mocks.states = [[], null, false, posts, false];
    let finishOld;
    mocks.getHomeFeed.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
      .mockResolvedValueOnce({ data: posts.slice(0, 18), error: null });
    mocks.getFeedAds.mockImplementation(async (count) => Array.from({ length: count }, (_, i) => ({
      ad_id: "campaign", delivery_id: `refreshed-${i}`,
    })));
    const firstRefresh = nativeRender().props.onRefresh();
    await Promise.resolve();
    await nativeRender().props.onRefresh();
    finishOld({ data: [{ id: "stale" }], error: null });
    await firstRefresh;
    const refreshed = nativeRender();
    expect(refreshed.props.refreshing).toBe(false);
    expect(refreshed.props.data.filter((row) => row.kind === "post").map((row) => row.id))
      .toEqual(posts.slice(0, 18).map((post) => post.id));
    expect(mocks.getFeedAds).toHaveBeenCalledTimes(1);
    expect(mocks.getFeedAds.mock.calls[0][1]).toBeNull();
    expect(refreshed.props.data.filter((row) => row.kind === "ad").length).toBeGreaterThan(0);
  });
});
