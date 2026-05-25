import AppLogo from "@/components/logo/AppLogo";
import CurrentUserMenu from "@/components/user/CurrentUserMenu";

export default function AppHeader() {
  return (
    <header className="app-header">
      <AppLogo />

      <div className="app-header__right">
        <CurrentUserMenu />
      </div>
    </header>
  );
}