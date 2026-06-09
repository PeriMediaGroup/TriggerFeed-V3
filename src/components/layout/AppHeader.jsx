import AppLogo from "@/components/logo/AppLogo";
import AppNav from "@/components/navigation/AppNav";
import MobileHeaderSearch from "@/features/search/components/MobileHeaderSearch";

export default function AppHeader() {
  return (
    <header className="app-header">
      <AppLogo />

      <div className="app-header__right">
        <MobileHeaderSearch />
        <AppNav />
      </div>
    </header>
  );
}
