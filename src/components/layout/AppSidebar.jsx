import AppLogo from "../logo/AppLogo"
import AppNav from "../navigation/AppNav"
import CurrentUserMenu from "../user/CurrentUserMenu"

export default function AppSidebar() {
  return (
    <>
      <div className="app-sidebar">
        <AppLogo />
        <AppNav />
        <CurrentUserMenu />
      </div>
      </>
  )}