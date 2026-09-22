import { normalizeProfileLinks } from "@/features/profiles/lib/profileLinks";
import { BadgeCheck, ExternalLink, Mail, MapPin, Phone } from "lucide-react";

const PROFILE_TYPE_LABELS = {
  creator: "Creator",
  organization: "Organization",
  system: "System",
};

export function hasVerifiedBadge(profile) {
  return (profile?.badges || []).some((badge) => badge?.badge_slug === `verified-${profile?.profile_type}`);
}

export function VerifiedIdentityBadge({ profileType }) {
  return (
    <span
      className="profile-header__verified"
      title="TriggerFeed has confirmed this account represents the stated person, creator, or organization."
    >
      <BadgeCheck size={14} strokeWidth={2.4} aria-hidden="true" />
      {profileType === "organization" ? "Verified Organization" : "Verified Creator"}
    </span>
  );
}

export default function ProfileTypeDetails({ profile }) {
  const profileType = profile?.profile_type || "member";

  if (!["creator", "organization"].includes(profileType)) {
    return null;
  }

  const metadata = profile?.profile_metadata || profile || {};
  const socialLinks = normalizeProfileLinks(metadata);
  const category = [metadata.category, metadata.subtype].filter(Boolean).join(" · ");
  const label = PROFILE_TYPE_LABELS[profileType];

  return (
    <section
      className="profile-header__type-details"
      aria-label={`${label} profile details`}
    >
      <div className="profile-header__type-summary">
        <span className="profile-header__type-label">{label}</span>
        {category ? (
          <span className="profile-header__type-category">{category}</span>
        ) : null}
      </div>

      <div className="profile-header__type-links">
        {metadata.public_location ? (
          <span>
            <MapPin size={15} aria-hidden="true" />
            {metadata.public_location}
          </span>
        ) : null}
        {/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(metadata.public_contact_email || "") ? (
          <a href={`mailto:${metadata.public_contact_email}`}>
            <Mail size={15} aria-hidden="true" />
            {metadata.public_contact_email}
          </a>
        ) : null}
        {/^\+?[0-9 ()-]{3,40}$/.test(metadata.public_contact_phone || "") ? (
          <a href={`tel:${metadata.public_contact_phone}`}>
            <Phone size={15} aria-hidden="true" />
            {metadata.public_contact_phone}
          </a>
        ) : null}
        {socialLinks.map((link) => (
          <a href={link.href} key={link.href} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} aria-hidden="true" />
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
