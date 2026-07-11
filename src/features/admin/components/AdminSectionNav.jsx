import Link from "next/link";

import NavBadge from "@/components/navigation/NavBadge";

const ADMIN_SECTION_LINKS = [
  { href: "/admin", label: "Overview", section: "overview" },
  {
    href: "/admin/reports",
    label: "Reports",
    section: "reports",
    badge: "reports",
  },
  { href: "/admin/users", label: "Users", section: "users" },
];

export default function AdminSectionNav({ activeSection, counts = null }) {
  return (
    <nav className="admin-section-nav" aria-label="Admin sections">
      {ADMIN_SECTION_LINKS.map((link) => {
        const badgeValue = link.badge ? counts?.[link.badge] : 0;
        const formattedBadgeValue = badgeValue > 99 ? "99+" : badgeValue;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={activeSection === link.section ? "page" : undefined}
          >
            {link.label}
            {link.badge ? (
              <NavBadge
                count={badgeValue}
                className="admin-section-nav__badge"
                label={`${formattedBadgeValue} pending ${link.label.toLowerCase()} item${badgeValue === 1 ? "" : "s"}`}
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
