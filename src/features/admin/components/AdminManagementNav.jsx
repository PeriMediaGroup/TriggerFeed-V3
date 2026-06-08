import Link from "next/link";

const ADMIN_MANAGEMENT_LINKS = [
  { href: "/admin/reports", label: "Reports", section: "reports" },
  { href: "/admin/users", label: "Users", section: "users" },
];

export default function AdminManagementNav({ activeSection }) {
  return (
    <nav className="admin-management-nav" aria-label="Admin sections">
      {ADMIN_MANAGEMENT_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={activeSection === link.section ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
