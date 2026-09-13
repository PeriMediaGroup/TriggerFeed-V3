import { Medal } from "lucide-react";

export const FOUNDING_500_COPY = {
  title: "The Founding 500",
  headline: "Be one of the first 500 members of TriggerFeed.",
  body: "Early members receive a permanent Founding Member badge.",
};

export default function FoundingMemberBadge({
  number = null,
  variant = "compact",
  className = "",
}) {
  if (!number) {
    return null;
  }

  const classes = [
    "founding-member-badge",
    `founding-member-badge--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "profile") {
    return (
      <div className={classes}>
        <div className="founding-member-badge__label">
          <Medal size={16} strokeWidth={2.1} aria-hidden="true" />
          <span>Founding Member #{number}</span>
        </div>
        <span className="founding-member-badge__detail">
          Member of the original Founding 500
        </span>
      </div>
    );
  }

  return (
    <span className={classes} title={`Founding Member #${number}`}>
      <Medal size={13} strokeWidth={2.1} aria-hidden="true" />
      <span>Founding Member</span>
    </span>
  );
}
