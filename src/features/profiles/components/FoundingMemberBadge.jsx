import Link from "next/link";
import { Medal } from "lucide-react";

export const FOUNDING_500_COPY = {
  title: "The Founding 500",
  headline: "Be one of the first 500 members of TriggerFeed.",
  body: "Early members receive a permanent Founding Member badge.",
};

export default function FoundingMemberBadge({
  number = null,
  variant = "compact",
  linked = true,
  className = "",
}) {
  if (!number) {
    return null;
  }

  const label = `Founding Member #${number}`;
  const classes = [
    "founding-member-badge",
    `founding-member-badge--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "profile") {
    const profileContent = (
      <>
        <div className="founding-member-badge__label">
          <Medal size={16} strokeWidth={2.1} aria-hidden="true" />
          <span>{label}</span>
        </div>
        <span className="founding-member-badge__detail">
          Member of the original Founding 500
        </span>
      </>
    );

    if (!linked) {
      return (
        <div className={classes} title={label}>
          {profileContent}
        </div>
      );
    }

    return (
      <Link
        href="/founding-500"
        className={classes}
        aria-label={`View the TriggerFeed Founding 500 registry for ${label}`}
        title="View the TriggerFeed Founding 500"
      >
        {profileContent}
      </Link>
    );
  }

  const compactContent = (
    <>
      <Medal size={13} strokeWidth={2.1} aria-hidden="true" />
      <span>Founding Member</span>
    </>
  );

  if (!linked) {
    return (
      <span className={classes} title={label}>
        {compactContent}
      </span>
    );
  }

  return (
    <Link
      href="/founding-500"
      className={classes}
      aria-label={`View the TriggerFeed Founding 500 registry for ${label}`}
      title="View the TriggerFeed Founding 500"
    >
      {compactContent}
    </Link>
  );
}
