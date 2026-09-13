import Image from "next/image";
import Link from "next/link";
import { Medal } from "lucide-react";

import FoundingMemberBadge from "@/features/profiles/components/FoundingMemberBadge";
import { DEFAULT_PROFILE_AVATAR_URL } from "@/features/profiles/constants/profileImages";
import { getFounding500Registry } from "@/features/profiles/data/getFounding500Registry";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PAGE_DESCRIPTION =
  "The permanent TriggerFeed Founding 500 registry, ordered by the founding numbers assigned by TriggerFeed.";

export const metadata = {
  title: "Founding 500",
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/founding-500`,
  },
  openGraph: {
    title: `Founding 500 | ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/founding-500`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Founding 500 | ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

function formatFoundingNumber(number) {
  return `#${String(number).padStart(3, "0")}`;
}

function getDisplayName(entry) {
  return (
    entry.display_name ||
    [entry.first_name, entry.last_name].filter(Boolean).join(" ") ||
    entry.username ||
    "Founding Member"
  );
}

function RegistryMember({ entry }) {
  const isActive = entry.status === "active" && entry.profile_id;
  const displayName = isActive ? getDisplayName(entry) : "Retired member";
  const username = isActive && entry.username ? `@${entry.username}` : "Number preserved";
  const avatarUrl =
    isActive && entry.avatar_cloudinary_url
      ? entry.avatar_cloudinary_url
      : DEFAULT_PROFILE_AVATAR_URL;
  const profileHref = isActive ? `/profiles/${entry.profile_id}` : null;

  return (
    <li
      className={
        isActive
          ? "founding-500__member"
          : "founding-500__member founding-500__member--retired"
      }
    >
      <div className="founding-500__number">
        {formatFoundingNumber(entry.founding_member_number)}
      </div>

      {profileHref ? (
        <Link href={profileHref} className="founding-500__avatar-link">
          <Image
            src={avatarUrl}
            alt={`${displayName} avatar`}
            width={48}
            height={48}
            className="founding-500__avatar"
          />
        </Link>
      ) : (
        <span className="founding-500__avatar-link" aria-hidden="true">
          <Image
            src={avatarUrl}
            alt=""
            width={48}
            height={48}
            className="founding-500__avatar"
          />
        </span>
      )}

      <div className="founding-500__identity">
        {profileHref ? (
          <Link href={profileHref} className="founding-500__name">
            {displayName}
          </Link>
        ) : (
          <span className="founding-500__name">{displayName}</span>
        )}
        <span className="founding-500__username">{username}</span>
      </div>

      {isActive ? (
        <FoundingMemberBadge
          number={entry.founding_member_number}
          variant="registry"
          className="founding-500__badge"
        />
      ) : (
        <span className="founding-500__retired-label">Retired</span>
      )}
    </li>
  );
}

export default async function Founding500Page() {
  const { entries, error } = await getFounding500Registry();
  const activeCount = entries.filter((entry) => entry.status === "active").length;
  const retiredCount = entries.filter((entry) => entry.status === "retired").length;
  const assignedCount = entries.length;

  return (
    <main className="public-page founding-500">
      <section className="founding-500__intro" aria-labelledby="founding-500-title">
        <div className="founding-500__intro-mark" aria-hidden="true">
          <Medal size={26} strokeWidth={1.8} />
        </div>
        <div className="founding-500__intro-copy">
          <p className="founding-500__eyebrow">TriggerFeed registry</p>
          <h1 id="founding-500-title">Founding 500</h1>
          <p>
            A permanent record of the first 500 human members assigned a
            TriggerFeed founding number. Numbers are stored by the backend and
            remain reserved once assigned.
          </p>
        </div>
      </section>

      <section className="founding-500__summary" aria-label="Registry summary">
        <div>
          <strong>{assignedCount}</strong>
          <span>Numbers assigned</span>
        </div>
        <div>
          <strong>{activeCount}</strong>
          <span>Active profiles</span>
        </div>
        <div>
          <strong>{retiredCount}</strong>
          <span>Preserved gaps</span>
        </div>
      </section>

      {error ? (
        <p className="founding-500__notice">
          The registry could not be loaded right now.
        </p>
      ) : null}

      {!error && entries.length === 0 ? (
        <p className="founding-500__notice">
          The Founding 500 registry is not populated yet.
        </p>
      ) : null}

      {entries.length > 0 ? (
        <ol className="founding-500__registry">
          {entries.map((entry) => (
            <RegistryMember
              key={entry.founding_member_number}
              entry={entry}
            />
          ))}
        </ol>
      ) : null}
    </main>
  );
}
