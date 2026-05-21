"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Crosshair,
  Home,
  LogIn,
  LogOut,
  Menu,
  ShieldAlert,
  User,
  UserPlus,
  X,
} from "lucide-react";

export default function CurrentUserDropdown({
  isLoggedIn,
  displayName,
  role,
  unreadNotifications = 0,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const cleanRole = typeof role === "string" ? role.trim().toLowerCase() : "";

  const isAdmin = ["admin", "ceo"].includes(cleanRole);

  function closeMenu() {
    setIsOpen(false);
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
    <div className="current-user-menu-wrap" ref={menuRef}>
      {isLoggedIn && displayName ? (
        <span className="current-user-menu__name">
          <strong>{displayName}</strong>
        </span>
      ) : null}

      <div className="current-user-menu">
        <button
          type="button"
          className="current-user-menu__toggle"
          onClick={() => setIsOpen((current) => !current)}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          aria-controls="current-user-menu-dropdown"
        >
          {isOpen ? (
            <X size={22} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Menu size={22} strokeWidth={2} aria-hidden="true" />
          )}
        </button>

        {isOpen && (
          <nav
            id="current-user-menu-dropdown"
            className="current-user-menu__dropdown"
            aria-label="User menu"
          >
            <ul className="current-user-menu__list">
              {isLoggedIn ? (
                <>
                  <li>
                    <Link
                      href="/"
                      className="current-user-menu__link"
                      onClick={closeMenu}
                    >
                      <Home size={17} strokeWidth={2} aria-hidden="true" />
                      <span>Home</span>
                    </Link>
                  </li>
                  {isAdmin && (
                    <li>
                      <Link
                        href="/admin/reports"
                        className="current-user-menu__link"
                        onClick={closeMenu}
                      >
                        <ShieldAlert
                          size={17}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        <span>Moderation</span>
                      </Link>
                    </li>
                  )}

                  <li>
                    <Link
                      href="/profile"
                      className="current-user-menu__link"
                      onClick={closeMenu}
                    >
                      <User size={17} strokeWidth={2} aria-hidden="true" />
                      <span>My Profile</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      href="/profile?tab=notifications"
                      className="current-user-menu__link"
                      onClick={closeMenu}
                    >
                      <Bell size={17} strokeWidth={2} aria-hidden="true" />
                      <span>Notifications</span>

                      {unreadNotifications > 0 && (
                        <span className="current-user-menu__badge">
                          {unreadNotifications}
                        </span>
                      )}
                    </Link>
                  </li>

                  <li>
                    <Link
                      href="/profile?tab=friends"
                      className="current-user-menu__link"
                      onClick={closeMenu}
                    >
                      <UserPlus size={17} strokeWidth={2} aria-hidden="true" />
                      <span>Manage Friends</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      href="/profile?tab=guns"
                      className="current-user-menu__link"
                      onClick={closeMenu}
                    >
                      <Crosshair size={17} strokeWidth={2} aria-hidden="true" />
                      <span>Edit Top Guns</span>
                    </Link>
                  </li>

                  <li>
                    <a
                      href="/logout"
                      className="current-user-menu__link"
                      onClick={closeMenu}
                    >
                      <LogOut size={17} strokeWidth={2} aria-hidden="true" />
                      <span>Logout</span>
                    </a>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      href="/login"
                      className="current-user-menu__link"
                      onClick={closeMenu}
                    >
                      <LogIn size={17} strokeWidth={2} aria-hidden="true" />
                      <span>Log in</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      href="/signup"
                      className="current-user-menu__link"
                      onClick={closeMenu}
                    >
                      <UserPlus size={17} strokeWidth={2} aria-hidden="true" />
                      <span>Sign up</span>
                    </Link>
                  </li>

                  <li>
                    <a
                      href="https://triggerfeed.com"
                      className="current-user-menu__link"
                      target="_blank"
                      rel="noreferrer"
                      onClick={closeMenu}
                    >
                      <Home size={17} strokeWidth={2} aria-hidden="true" />
                      <span>TriggerFeed.com</span>
                    </a>
                  </li>
                </>
              )}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
