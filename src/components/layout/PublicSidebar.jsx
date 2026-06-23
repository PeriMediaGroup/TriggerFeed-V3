"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import AppLogo from "@/components/logo/AppLogo";
import {
  AUTH_NAV_LINKS,
  SITE_NAV_LINKS,
} from "@/components/navigation/navigationLinks";

const publicLinks = [
  { ...AUTH_NAV_LINKS[0], label: "Log In" },
  { ...AUTH_NAV_LINKS[1], label: "Create Account" },
  ...SITE_NAV_LINKS,
];

export default function PublicSidebar() {
  const pathname = usePathname();

  return (
    <div className="public-sidebar">
      <AppLogo />

      <nav className="public-nav" aria-label="Public navigation">
        <ul className="public-nav__list">
          {publicLinks.map(({ href, label, Icon }) => {
            const isActive =
              pathname === href ||
              (href === "/legal" && pathname.startsWith("/legal/"));

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    "public-nav__link",
                    isActive ? "public-nav__link--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={17} strokeWidth={2} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
