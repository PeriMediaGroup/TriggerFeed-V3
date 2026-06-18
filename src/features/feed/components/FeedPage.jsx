import FeedTabs from "./FeedTabs";
import { getPosts } from "@/features/posts/data/getPosts";
import PostFeed from "@/features/posts/components/PostFeed";
import BirthdayGreeting from "@/features/milestones/components/BirthdayGreeting";
import { getCurrentProfile } from "@/features/profiles/data/getCurrentProfile";
import {
  getRankThresholdMap,
  getUserRank,
  isHigherRank,
  isMilestoneEligibleRank,
} from "@/features/ranks/data/getUserRank";
import { acknowledgeRankMilestone } from "@/features/ranks/actions/acknowledgeRankMilestone";

const VALID_FEEDS = ["main", "friends", "trending"];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isBirthdayToday(dob, todayKey) {
  if (!dob) {
    return false;
  }

  const [, month, day] = String(dob).slice(0, 10).split("-");
  const [, todayMonth, todayDay] = todayKey.split("-");

  return month === todayMonth && day === todayDay;
}

export default async function FeedPage({ feedType = "main" }) {
  const activeFeed = VALID_FEEDS.includes(feedType) ? feedType : "main";

  const {
    posts,
    commentsByPostId,
    currentUserId,
    message,
  } = await getPosts({ feedType: activeFeed });
  const { profile } =
    activeFeed === "main" && currentUserId
      ? await getCurrentProfile()
      : { profile: null };
  const [{ rank }, rankThresholdMap] =
    activeFeed === "main" && currentUserId
      ? await Promise.all([getUserRank(currentUserId), getRankThresholdMap()])
      : [{ rank: null }, new Map()];
  const todayKey = getTodayKey();
  const lastSeenRankKey = profile?.last_seen_rank_key || "new_recruit";
  const shouldShowRankMilestone =
    activeFeed === "main" &&
    rank?.rankKey &&
    isMilestoneEligibleRank(rank.rankKey, rankThresholdMap) &&
    isHigherRank(rank.rankKey, lastSeenRankKey, rankThresholdMap);

  return (
    <section className="feed-page">
      <FeedTabs activeFeed={activeFeed} />

      {activeFeed === "main" && profile?.dob ? (
        <BirthdayGreeting
          userId={currentUserId}
          dateKey={todayKey}
          isBirthdayToday={isBirthdayToday(profile.dob, todayKey)}
          firstName={profile.first_name}
          displayName={profile.display_name}
          username={profile.username}
        />
      ) : null}

      {shouldShowRankMilestone ? (
        <BirthdayGreeting
          userId={currentUserId}
          dateKey={rank.rankKey}
          isActive
          milestoneType="rank"
          rankName={rank.rankLabel}
          firstName={profile?.first_name}
          displayName={profile?.display_name}
          username={profile?.username}
          onDismissAction={acknowledgeRankMilestone.bind(null, rank.rankKey)}
        />
      ) : null}

      {message ? (
        <div className="feed-page__notice">
          <p>{message}</p>
        </div>
      ) : null}

      <PostFeed
        posts={posts}
        commentsByPostId={commentsByPostId}
        currentUserId={currentUserId}
      />
    </section>
  );
}
