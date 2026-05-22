import AppLogo from "../logo/AppLogo"
import AppNav from "../navigation/AppNav"
import CurrentUserDropdown from "../user/CurrentUserDropdown"
import CurrentUserMenu from "../user/CurrentUserMenu"

export default function AppSidebar() {
  return (
    <>
      <div className="app-sidebar">
        <AppLogo />
        <CurrentUserMenu />
        <AppNav />
      </div>
      </>
  )}