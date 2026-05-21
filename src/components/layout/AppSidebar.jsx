import AppLogo from "../logo/AppLogo"
import CurrentUserDropdown from "../user/CurrentUserDropdown"

export default function AppSidebar() {
  return (
    <>
      <div className="app-sidebar">
        <AppLogo />
        <CurrentUserDropdown />
      </div>
      </>
  )}