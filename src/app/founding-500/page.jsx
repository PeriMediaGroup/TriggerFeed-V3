import Image from "next/image";
import Link from "next/link";
import { Medal } from "lucide-react";

import { DEFAULT_PROFILE_AVATAR_URL } from "@/features/profiles/constants/profileImages";
import { getFounding500Registry } from "@/features/profiles/data/getFounding500Registry";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PAGE_DESCRIPTION =
  "The TriggerFeed Founding 500 registry, ordered by current founding number. Positions are provisional until finalization.";

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
  return String(number).padStart(3, "0");
}

function getDisplayName(entry) {
  return (
    entry.display_name ||
    [entry.first_name, entry.last_name].filter(Boolean).join(" ") ||
    entry.username ||
    "Founding Member"
  );
}

function RegistryMember({ entry, finalized }) {
  const isActive = entry.status === "active" && entry.profile_id;
  const displayName = isActive ? getDisplayName(entry) : "Retired member";
  const username =
    isActive && entry.username ? `@${entry.username}` : finalized ? "Number permanently reserved" : "Position may be reclaimed";
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
      <div
        className="founding-500__number"
        aria-label={`Founding member number ${entry.founding_member_number}`}
      >
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

        {!isActive ? (
          <span className="founding-500__retired-label">Retired</span>
        ) : null}
      </div>
    </li>
  );
}

export default async function Founding500Page() {
  const { entries, error, state } = await getFounding500Registry();

  return (
    <main className="public-page founding-500">
      <section
        className="founding-500__intro"
        aria-labelledby="founding-500-title"
      >
        <div className="founding-500__intro-mark" aria-hidden="true">
          <Medal size={26} strokeWidth={1.8} />
        </div>

        <div className="founding-500__intro-copy">
          <p className="founding-500__eyebrow">TriggerFeed registry</p>
          <h1 id="founding-500-title">Founding 500</h1>
          <p>
            {!state ? "Founding positions may be reclaimed during open enrollment. After finalization, numbers become permanent and retired numbers remain reserved." : state.finalized_at
              ? "Finalized: Founding numbers are permanent historical identifiers. Retired numbers remain reserved."
              : "Open enrollment: Founding positions are provisional and may be administratively reclaimed or resequenced. Numbers become permanent only when the program is finalized."}
          </p>
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
              finalized={Boolean(state?.finalized_at)}
            />
          ))}
        </ol>
      ) : null}
    </main>
  );
}
