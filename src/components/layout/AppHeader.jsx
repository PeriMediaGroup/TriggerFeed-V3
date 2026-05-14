import AppLogo from "@/components/logo/AppLogo";
import AppNav from "@/components/navigation/AppNav";
import CurrentUserMenu from "@/components/user/CurrentUserMenu";

export default function AppHeader() {
  return (
    <header className="app-header">
      <AppLogo />

      <AppNav />
      <div className="app-header__right">
        <CurrentUserMenu />
      </div>
    </header>
  );
}
