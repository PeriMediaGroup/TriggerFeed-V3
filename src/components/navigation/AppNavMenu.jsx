"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";

import {
  APP_NAV_LINKS,
  AUTH_NAV_LINKS
} from "./navigationLinks";

export default function AppNavMenu({
  isLoggedIn,
  displayName,
  role,
  unreadNotifications = 0,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  const cleanRole = typeof role === "string" ? role.trim().toLowerCase() : "";
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab");

  function closeMenu() {
    setIsOpen(false);
  }

  function userCanSeeLink(link) {
    if (link.auth === "loggedIn" && !isLoggedIn) return false;
    if (link.auth === "loggedOut" && isLoggedIn) return false;

    if (link.roles?.length) {
      return link.roles.includes(cleanRole);
    }

    return true;
  }

  function isLinkActive(link, path, targetTab) {
    if (typeof link.match === "function") {
      return link.match(pathname);
    }

    const isSamePath = pathname === path;

    return targetTab
      ? isSamePath && activeTab === targetTab
      : isSamePath && !activeTab;
  }

  function getLinkClass(link, extraClass = "") {
    const { href } = link;
    const [path, queryString] = href.split("?");
    const params = new URLSearchParams(queryString || "");
    const targetTab = params.get("tab");

    const isActive = isLinkActive(link, path, targetTab);

    return [
      "app-nav__link",
      extraClass,
      isActive ? "app-nav__link--active" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  function getBadgeValue(badge) {
    if (badge === "unreadNotifications") {
      return unreadNotifications;
    }

    return 0;
  }

  function handleSearchSubmit(event) {
    event.preventDefault();

    const query = searchInputRef.current?.value.trim() || "";

    if (!query) return;

    const params = new URLSearchParams({ q: query });

    router.push(`/search?${params.toString()}`);
    closeMenu();
  }

  function renderNavLinks(links, { onItemClick } = {}) {
    return links.filter(userCanSeeLink).map((link) => {
      const { href, label, Icon, className = "", external, badge } = link;
      const badgeValue = getBadgeValue(badge);

      const content = (
        <>
          {Icon && <Icon size={17} strokeWidth={2} aria-hidden="true" />}
          <span>{label}</span>

          {badgeValue > 0 && (
            <span className="app-nav__badge">{badgeValue}</span>
          )}
        </>
      );

      return (
        <li key={href}>
          {external ? (
            <a
              href={href}
              className={getLinkClass(link, className)}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noreferrer" : undefined}
              onClick={onItemClick}
            >
              {content}
            </a>
          ) : (
            <Link
              href={href}
              className={getLinkClass(link, className)}
              onClick={onItemClick}
            >
              {content}
            </Link>
          )}
        </li>
      );
    });
  }

  function getDesktopLinks() {
    if (!isLoggedIn) {
      return [...AUTH_NAV_LINKS];
    }

    return APP_NAV_LINKS;
  }

  function getMobileDropdownLinks() {
    if (!isLoggedIn) {
      return [...AUTH_NAV_LINKS];
    }

    const adminLinks = APP_NAV_LINKS.filter((link) => link.roles?.length);
    const logoutLink = APP_NAV_LINKS.find((link) => link.href === "/logout");

    return [
      ...adminLinks,
      ...(logoutLink ? [logoutLink] : []),
    ];
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (!menuRef.current) return;

      if (!menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="app-nav" ref={menuRef}>
      <nav className="app-nav__desktop-nav" aria-label="Main navigation">
        <ul className="app-nav__desktop-list">
          {renderNavLinks(getDesktopLinks())}
        </ul>
      </nav>

      <div className="app-nav__mobile">
        <button
          type="button"
          className="app-nav__toggle"
          onClick={() => setIsOpen((current) => !current)}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          aria-controls="app-nav-menu-dropdown"
        >
          {isOpen ? (
            <X size={22} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Menu size={22} strokeWidth={2} aria-hidden="true" />
          )}
        </button>

        {isOpen && (
          <nav
            id="app-nav-menu-dropdown"
            className="app-nav__dropdown"
            aria-label="More navigation"
          >
            <form className="app-nav__search" onSubmit={handleSearchSubmit}>
              <label
                className="app-nav__search-label"
                htmlFor="app-nav-post-search-query"
              >
                Search posts
              </label>
              <input
                ref={searchInputRef}
                id="app-nav-post-search-query"
                className="app-nav__search-input"
                type="search"
                name="q"
                placeholder="Search posts"
                autoComplete="off"
                aria-label="Search posts"
              />
              <button
                type="submit"
                className="app-nav__search-submit"
                aria-label="Submit search"
              >
                <Search size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </form>

            <ul className="app-nav__list">
              {renderNavLinks(getMobileDropdownLinks(), {
                onItemClick: closeMenu,
              })}
            </ul>
          </nav>
        )}
      </div>

      {isLoggedIn && displayName ? (
        <div className="app-nav__user-block">
          <span className="app-nav__name">
            <strong>{displayName}</strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}
