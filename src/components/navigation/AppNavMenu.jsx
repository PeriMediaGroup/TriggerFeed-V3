"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Crosshair,
  Home,
  LogIn,
  LogOut,
  Menu,
  PlusCircle,
  ShieldAlert,
  User,
  UserPlus,
  X,
} from "lucide-react";

export default function AppNavMenu({
  isLoggedIn,
  displayName,
  role,
  unreadNotifications = 0,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const cleanRole = typeof role === "string" ? role.trim().toLowerCase() : "";
  const isAdmin = ["admin", "ceo"].includes(cleanRole);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab");

  function closeMenu() {
    setIsOpen(false);
  }

  function getLinkClass(href, extraClass = "") {
    const [path, queryString] = href.split("?");
    const params = new URLSearchParams(queryString || "");
    const targetTab = params.get("tab");

    const isSamePath = pathname === path;

    const isActive = targetTab
      ? isSamePath && activeTab === targetTab
      : isSamePath && !activeTab;

    return [
      "app-nav__link",
      extraClass,
      isActive ? "app-nav__link--active" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  function renderMenuItems({ onItemClick } = {}) {
    if (isLoggedIn) {
      return (
        <>
          <li>
            <Link
              href="/posts/new"
              className={getLinkClass("/posts/new", "app-nav__link-create")}
              onClick={onItemClick}
            >
              <PlusCircle size={17} strokeWidth={2} aria-hidden="true" />
              <span>Create</span>
            </Link>
          </li>

          <li>
            <Link href="/" className={getLinkClass("/")} onClick={onItemClick}>
              <Home size={17} strokeWidth={2} aria-hidden="true" />
              <span>Home</span>
            </Link>
          </li>

          <li>
            <Link
              href="/profile"
              className={getLinkClass("/profile")}
              onClick={onItemClick}
            >
              <User size={17} strokeWidth={2} aria-hidden="true" />
              <span>My Profile</span>
            </Link>
          </li>

          <li>
            <Link
              href="/profile?tab=notifications"
              className={getLinkClass("/profile?tab=notifications")}
              onClick={onItemClick}
            >
              <Bell size={17} strokeWidth={2} aria-hidden="true" />
              <span>Notifications</span>

              {unreadNotifications > 0 && (
                <span className="app-nav__badge">{unreadNotifications}</span>
              )}
            </Link>
          </li>

          <li>
            <Link
              href="/profile?tab=friends"
              className={getLinkClass("/profile?tab=friends")}
              onClick={onItemClick}
            >
              <UserPlus size={17} strokeWidth={2} aria-hidden="true" />
              <span>Manage Friends</span>
            </Link>
          </li>

          <li>
            <Link
              href="/profile?tab=guns"
              className={getLinkClass("/profile?tab=guns")}
              onClick={onItemClick}
            >
              <Crosshair size={17} strokeWidth={2} aria-hidden="true" />
              <span>Edit Top Guns</span>
            </Link>
          </li>

          {isAdmin && (
            <li>
              <Link
                href="/admin/reports"
                className={getLinkClass("/admin/reports")}
                onClick={onItemClick}
              >
                <ShieldAlert size={17} strokeWidth={2} aria-hidden="true" />
                <span>Moderation</span>
              </Link>
            </li>
          )}

          <li>
            <a href="/logout" className="app-nav__link" onClick={onItemClick}>
              <LogOut size={17} strokeWidth={2} aria-hidden="true" />
              <span>Logout</span>
            </a>
          </li>
        </>
      );
    }

    return (
      <>
        <li>
          <Link
            href="/login"
            className={getLinkClass("/login")}
            onClick={onItemClick}
          >
            <LogIn size={17} strokeWidth={2} aria-hidden="true" />
            <span>Login</span>
          </Link>
        </li>

        <li>
          <Link
            href="/signup"
            className={getLinkClass("/signup")}
            onClick={onItemClick}
          >
            <UserPlus size={17} strokeWidth={2} aria-hidden="true" />
            <span>Signup</span>
          </Link>
        </li>

        <li>
          <a
            href="https://triggerfeed.com"
            className="app-nav__link"
            target="_blank"
            rel="noreferrer"
            onClick={onItemClick}
          >
            <Home size={17} strokeWidth={2} aria-hidden="true" />
            <span>TriggerFeed.com</span>
          </a>
        </li>
      </>
    );
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
        <ul className="app-nav__desktop-list">{renderMenuItems()}</ul>
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
            aria-label="Mobile navigation"
          >
            <ul className="app-nav__list">
              {renderMenuItems({ onItemClick: closeMenu })}
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
