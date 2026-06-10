export default function UserRankCard({ rank }) {
  if (!rank) {
    return null;
  }

  const hasNextRank = Boolean(rank.nextRankKey);

  return (
    <section className="user-rank-card" aria-labelledby="user-rank-title">
      <div className="user-rank-card__header">
        <p className="user-rank-card__eyebrow">Current Rank</p>
        <h2 id="user-rank-title" className="user-rank-card__title">
          {rank.rankLabel}
        </h2>
      </div>

      <div className="user-rank-card__stats">
        <div className="user-rank-card__stat">
          <strong>{rank.postCount}</strong>
          <span>Posts</span>
        </div>

        {hasNextRank ? (
          <div className="user-rank-card__stat">
            <strong>{rank.postsUntilNextRank}</strong>
            <span>to {rank.nextRankLabel}</span>
          </div>
        ) : (
          <div className="user-rank-card__stat">
            <strong>Max</strong>
            <span>rank reached</span>
          </div>
        )}
      </div>
    </section>
  );
}
