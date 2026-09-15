import FoundingMemberBadge from "@/features/profiles/components/FoundingMemberBadge";

function isFoundingBadge(badge) {
  return badge?.badge_slug === "founding-500";
}

function isLegacyFoundingBadge(label) {
  return /founding\s+member/i.test(label || "");
}

function getDisplayBadges(profile) {
  const foundingEligible = ["member", "creator"].includes(
    profile?.profile_type || "member",
  );
  const badges = Array.isArray(profile?.badges)
    ? profile.badges.filter((badge) => foundingEligible || !isFoundingBadge(badge))
    : [];

  if (profile?.profile_badge && !isLegacyFoundingBadge(profile.profile_badge)) {
    badges.push({
      badge_slug: `legacy-${profile.profile_badge}`,
      name: profile.profile_badge,
      description: null,
      variant: "legacy",
      target_url: null,
    });
  }

  return badges;
}

function GenericBadge({ badge }) {
  const content = (
    <>
      <span className="profile-badge__label">{badge.name}</span>
      {badge.description ? (
        <span className="profile-badge__detail">{badge.description}</span>
      ) : null}
    </>
  );

  const classes = [
    "profile-badge",
    badge.variant ? `profile-badge--${badge.variant}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (badge.target_url) {
    return (
      <a href={badge.target_url} className={classes}>
        {content}
      </a>
    );
  }

  return <span className={classes}>{content}</span>;
}

export default function ProfileBadgesSection({ profile }) {
  const badges = getDisplayBadges(profile);

  if (badges.length === 0) {
    return null;
  }

  return (
    <section className="profile-header__badges" aria-labelledby="profile-badges-title">
      <h2 id="profile-badges-title" className="profile-header__badges-title">
        Badges
      </h2>
      <div className="profile-header__badges-list">
        {badges.map((badge) =>
          isFoundingBadge(badge) ? (
            <FoundingMemberBadge
              key={badge.badge_slug}
              number={badge.founding_member_number}
              variant="profile"
            />
          ) : (
            <GenericBadge key={badge.badge_slug || badge.name} badge={badge} />
          ),
        )}
      </div>
    </section>
  );
}
