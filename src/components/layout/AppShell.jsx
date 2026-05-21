// src/components/layout/AppShell.jsx

import AppSidebar from "./AppSidebar";
import AppRightRail from "./AppRightRail";

export default function AppShell({ children, user, unreadNotifications = 0 }) {
  return (
    <>
      <div className="app-shell">
        <div className="app-shell__sidebar">
          <AppSidebar user={user} unreadNotifications={unreadNotifications} />
        </div>
        <main className="app-shell__main">{children}</main>
        <aside className="app-shell__right-rail">
          <AppRightRail user={user} />
        </aside>
      </div>
    </>
  );
}
