"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, PlusCircle, User, Users } from "lucide-react";

function isActivePath(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav({ unreadNotifications = 0 }) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/",
      label: "Home",
      icon: Home,
      match: (pathname) => pathname === "/",
    },
    {
      href: "/profile?tab=friends",
      label: "Friends",
      icon: Users,
      match: (pathname) => pathname === "/profile/friends",
    },
    {
      href: "/posts/new",
      label: "Create",
      icon: PlusCircle,
      isPrimary: true,
      match: (pathname) => pathname === "/posts/new",
    },
    {
      href: "/profile?tab=notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadNotifications,
      match: (pathname) => pathname === "/profile/notifications",
    },
    {
      href: "/profile",
      label: "Profile",
      icon: User,
      match: (pathname) => pathname === "/profile",
    },
  ];

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      <ul className="bottom-nav__list">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.match
            ? item.match(pathname)
            : pathname === item.href;

          return (
            <li key={item.href} className="bottom-nav__item">
              <Link
                href={item.href}
                className={[
                  "bottom-nav__link",
                  isActive ? "bottom-nav__link--active" : "",
                  item.isPrimary ? "bottom-nav__link--primary" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="bottom-nav__icon-wrap">
                  <Icon size={22} strokeWidth={2} aria-hidden="true" />

                  {item.badge > 0 && (
                    <span className="bottom-nav__badge">{item.badge}</span>
                  )}
                </span>

                <span className="bottom-nav__label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
