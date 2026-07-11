// src/components/layout/AppShell.jsx

import ToastProvider from "../../components/ui/ToastProvider";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";
import AppRightRail from "./AppRightRail";
import AppFooter from "./AppFooter";
import BottomNav from "../navigation/BottomNav";
import LoggedOutShell from "./LoggedOutShell";
import UserActivityTracker from "@/features/activity/UserActivityTracker";

export default function AppShell({ children, user, unreadNotifications = 0 }) {
  if (!user) {
    return (
      <>
        <LoggedOutShell
          footer={<AppFooter />}
          header={<AppHeader />}
        >
          {children}
        </LoggedOutShell>
        <ToastProvider />
      </>
    );
  }

  return (
    <>
      <AppHeader user={user} unreadNotifications={unreadNotifications} />

      <div className="app-shell">
        <div className="app-shell__sidebar">
          <AppSidebar user={user} unreadNotifications={unreadNotifications} />
        </div>

        <main className="app-shell__main">
          <div className="app-shell__content">{children}</div>
        </main>

        <aside className="app-shell__right-rail">
          <AppRightRail user={user} />
        </aside>
      </div>

      <AppFooter />
      <BottomNav unreadNotifications={unreadNotifications} />
      <UserActivityTracker userId={user.id} />
      <ToastProvider />
    </>
  );
}
