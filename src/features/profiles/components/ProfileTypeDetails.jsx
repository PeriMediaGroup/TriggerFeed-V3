import { BadgeCheck, ExternalLink, Mail, MapPin, Phone } from "lucide-react";

const PROFILE_TYPE_LABELS = {
  creator: "Creator",
  organization: "Organization",
  system: "System",
};

export function hasVerifiedBadge(profile) {
  return (profile?.badges || []).some((badge) => badge?.badge_slug === "verified");
}

function getSafeExternalHref(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function getSafeSocialLinks(links) {
  if (!Array.isArray(links)) {
    return [];
  }

  return links
    .map((link) => {
      if (!link || typeof link !== "object") {
        return null;
      }

      const href = getSafeExternalHref(link.url);

      if (!href) {
        return null;
      }

      return {
        href,
        label: typeof link.label === "string" && link.label.trim()
          ? link.label.trim()
          : new URL(href).hostname.replace(/^www\./, ""),
      };
    })
    .filter(Boolean);
}

export function VerifiedIdentityBadge() {
  return (
    <span
      className="profile-header__verified"
      title="TriggerFeed has confirmed this account represents the stated person, creator, or organization."
    >
      <BadgeCheck size={14} strokeWidth={2.4} aria-hidden="true" />
      Verified
    </span>
  );
}

export default function ProfileTypeDetails({ profile }) {
  const profileType = profile?.profile_type || "member";

  if (!["creator", "organization"].includes(profileType)) {
    return null;
  }

  const metadata = profile?.profile_metadata || profile || {};
  const websiteHref = getSafeExternalHref(metadata.website_url);
  const primaryHref = getSafeExternalHref(metadata.primary_link_url);
  const socialLinks = getSafeSocialLinks(metadata.social_links);
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
        {primaryHref ? (
          <a href={primaryHref} target="_blank" rel="noreferrer">
            <ExternalLink size={15} aria-hidden="true" />
            {metadata.primary_link_label || "Featured link"}
          </a>
        ) : null}
        {websiteHref ? (
          <a href={websiteHref} target="_blank" rel="noreferrer">
            <ExternalLink size={15} aria-hidden="true" />
            Website
          </a>
        ) : null}
        {metadata.public_location ? (
          <span>
            <MapPin size={15} aria-hidden="true" />
            {metadata.public_location}
          </span>
        ) : null}
        {metadata.public_contact_email ? (
          <a href={`mailto:${metadata.public_contact_email}`}>
            <Mail size={15} aria-hidden="true" />
            {metadata.public_contact_email}
          </a>
        ) : null}
        {metadata.public_contact_phone ? (
          <a href={`tel:${metadata.public_contact_phone}`}>
            <Phone size={15} aria-hidden="true" />
            {metadata.public_contact_phone}
          </a>
        ) : null}
        {socialLinks.map((link) => (
          <a href={link.href} key={link.href} target="_blank" rel="noreferrer">
            <ExternalLink size={15} aria-hidden="true" />
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
