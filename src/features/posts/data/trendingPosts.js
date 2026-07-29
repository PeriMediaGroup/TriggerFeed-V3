const TRENDING_MIN_TOTAL_VOTES = 5;

export function sortTrendingPosts(posts) {
  return [...(posts || [])]
    .filter(
      (post) =>
        post.is_deleted !== true &&
        getPostTotalVotes(post) >= TRENDING_MIN_TOTAL_VOTES,
    )
    .sort((a, b) => {
      const scoreDifference = (b.score || 0) - (a.score || 0);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const voteDifference = getPostTotalVotes(b) - getPostTotalVotes(a);

      if (voteDifference !== 0) {
        return voteDifference;
      }

      return compareCreatedAtDesc(a, b);
    });
}

export function getPostTotalVotes(post) {
  const explicitTotal = post.total_votes ?? post.vote_count;
  const summedTotal = (post.upvote_count || 0) + (post.downvote_count || 0);

  return explicitTotal || summedTotal;
}

function compareCreatedAtDesc(a, b) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}
