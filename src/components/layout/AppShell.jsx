// src/components/layout/AppShell.jsx

import ToastProvider from "../../components/ui/ToastProvider";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";
import AppRightRail from "./AppRightRail";
import BottomNav from "../navigation/BottomNav";

export default function AppShell({ children, user, unreadNotifications = 0 }) {
  return (
    <>
      <AppHeader user={user} unreadNotifications={unreadNotifications} />

      <div className="app-shell">
        <div className="app-shell__sidebar">
          <AppSidebar user={user} unreadNotifications={unreadNotifications} />
        </div>

        <main className="app-shell__main">{children}</main>

        <aside className="app-shell__right-rail">
          <AppRightRail user={user} />
        </aside>
        <BottomNav unreadNotifications={unreadNotifications} />
        <ToastProvider />
      </div>
    </>
  );
}
