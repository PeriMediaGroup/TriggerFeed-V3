import AppLogo from "../logo/AppLogo";
import AppNav from "../navigation/AppNav";
import CurrentUserMenu from "../user/CurrentUserMenu";

export default function AppSidebar({ user, unreadNotifications = 0 }) {
  return (
    <div className="app-sidebar">
      <AppLogo />
      <AppNav unreadNotifications={unreadNotifications} />
      <CurrentUserMenu user={user} />
    </div>
  );
}