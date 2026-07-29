import { describe, expect, test } from "vitest";
import { sortTrendingPosts } from "./trendingPosts";

function post(overrides) {
  return {
    id: overrides.id,
    is_deleted: false,
    score: 0,
    vote_count: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("sortTrendingPosts", () => {
  test("includes a post with 5 upvotes", () => {
    const result = sortTrendingPosts([
      post({
        id: "five-upvotes",
        upvote_count: 5,
        downvote_count: 0,
        score: 5,
      }),
    ]);

    expect(result.map((item) => item.id)).toEqual(["five-upvotes"]);
  });

  test("includes a post with 3 upvotes and 2 downvotes", () => {
    const result = sortTrendingPosts([
      post({
        id: "three-up-two-down",
        upvote_count: 3,
        downvote_count: 2,
        score: 1,
      }),
    ]);

    expect(result.map((item) => item.id)).toEqual(["three-up-two-down"]);
  });

  test("includes a post with 3 upvotes and 4 downvotes because total votes are 7", () => {
    const result = sortTrendingPosts([
      post({
        id: "negative-score-seven-total",
        upvote_count: 3,
        downvote_count: 4,
        score: -1,
      }),
    ]);

    expect(result.map((item) => item.id)).toEqual([
      "negative-score-seven-total",
    ]);
  });

  test("excludes posts with fewer than 5 total votes", () => {
    const result = sortTrendingPosts([
      post({
        id: "four-total",
        upvote_count: 3,
        downvote_count: 1,
        score: 2,
      }),
    ]);

    expect(result).toEqual([]);
  });

  test("excludes deleted posts", () => {
    const result = sortTrendingPosts([
      post({
        id: "deleted",
        is_deleted: true,
        upvote_count: 5,
        downvote_count: 0,
        score: 5,
      }),
    ]);

    expect(result).toEqual([]);
  });

  test("sorts by net score, then total votes, then created date", () => {
    const result = sortTrendingPosts([
      post({
        id: "older-same-score",
        vote_count: 8,
        score: 2,
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      post({
        id: "higher-score",
        vote_count: 5,
        score: 3,
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      post({
        id: "more-total-votes",
        vote_count: 9,
        score: 2,
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      post({
        id: "newer-same-score-and-total",
        vote_count: 8,
        score: 2,
        created_at: "2026-01-02T00:00:00.000Z",
      }),
    ]);

    expect(result.map((item) => item.id)).toEqual([
      "higher-score",
      "more-total-votes",
      "newer-same-score-and-total",
      "older-same-score",
    ]);
  });
});
