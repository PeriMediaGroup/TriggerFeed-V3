"use client";

import { usePathname } from "next/navigation";

import PublicRightRail from "./PublicRightRail";
import PublicSidebar from "./PublicSidebar";

const PUBLIC_CONTENT_PATHS = new Set([
  "/about",
  "/contact",
  "/install",
  "/legal",
  "/merch",
]);

function usesPublicContentShell(pathname) {
  return (
    PUBLIC_CONTENT_PATHS.has(pathname) || pathname.startsWith("/legal/")
  );
}

export default function LoggedOutShell({
  children,
  footer,
  header,
}) {
  const pathname = usePathname();

  if (!usesPublicContentShell(pathname)) {
    return (
      <div className="public-shell public-shell--simple">
        {header}
        <div className="public-shell__simple-content">{children}</div>
        {footer}
      </div>
    );
  }

  return (
    <div className="public-shell public-shell--content">
      {header}

      <div className="public-layout">
        <aside className="public-layout__sidebar">
          <PublicSidebar />
        </aside>

        <div className="public-layout__main">
          <div className="public-layout__content">{children}</div>
        </div>

        <aside className="public-layout__right-rail">
          <PublicRightRail />
        </aside>
      </div>

      {footer}
    </div>
  );
}
