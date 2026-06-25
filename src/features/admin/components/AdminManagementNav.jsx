import Link from "next/link";

import NavBadge from "@/components/navigation/NavBadge";

const ADMIN_MANAGEMENT_LINKS = [
  {
    href: "/admin/reports",
    label: "Reports",
    section: "reports",
    badge: "reports",
  },
  { href: "/admin/users", label: "Users", section: "users" },
];

export default function AdminManagementNav({ activeSection, counts = null }) {
  return (
    <nav className="admin-management-nav" aria-label="Admin sections">
      {ADMIN_MANAGEMENT_LINKS.map((link) => {
        const badgeValue = link.badge ? counts?.[link.badge] : 0;
        const formattedBadgeValue = badgeValue > 99 ? "99+" : badgeValue;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={activeSection === link.section ? "page" : undefined}
          >
            {link.label}
            <NavBadge
              count={badgeValue}
              className="admin-management-nav__badge"
              label={`${formattedBadgeValue} pending ${link.label.toLowerCase()} item${badgeValue === 1 ? "" : "s"}`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
