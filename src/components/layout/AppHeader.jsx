import AppLogo from "@/components/logo/AppLogo";
import AppNav from "@/components/navigation/AppNav";

export default function AppHeader() {
  return (
    <header className="app-header">
      <AppLogo />

      <div className="app-header__right">
        <AppNav />
      </div>
    </header>
  );
}
