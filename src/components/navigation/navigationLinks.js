import {
  Bell,
  Crosshair,
  Download,
  Home,
  Info,
  LogIn,
  LogOut,
  Mail,
  PlusCircle,
  Scale,
  ShieldAlert,
  ShoppingBag,
  User,
  UserPlus,
} from "lucide-react";

export const APP_NAV_LINKS = [
  {
    href: "/posts/new",
    label: "Create",
    Icon: PlusCircle,
    auth: "loggedIn",
    className: "app-nav__link-create",
  },
  {
    href: "/",
    label: "Home",
    Icon: Home,
    auth: "loggedIn",
  },
  {
    href: "/profile",
    label: "My Profile",
    Icon: User,
    auth: "loggedIn",
  },
  {
    href: "/profile?tab=notifications",
    label: "Notifications",
    Icon: Bell,
    auth: "loggedIn",
    badge: "unreadNotifications",
  },
  {
    href: "/profile?tab=friends",
    label: "Manage Friends",
    Icon: UserPlus,
    auth: "loggedIn",
  },
  {
    href: "/profile?tab=guns",
    label: "Edit Top Guns",
    Icon: Crosshair,
    auth: "loggedIn",
  },
  {
    href: "/admin",
    label: "Management",
    Icon: ShieldAlert,
    auth: "loggedIn",
    roles: ["moderator", "admin", "ceo"],
    match: (pathname) =>
      pathname === "/admin" || pathname.startsWith("/admin/"),
  },
  {
    href: "/logout",
    label: "Logout",
    Icon: LogOut,
    auth: "loggedIn",
    external: true,
  },
];

export const AUTH_NAV_LINKS = [
  {
    href: "/login",
    label: "Login",
    Icon: LogIn,
    auth: "loggedOut",
  },
  {
    href: "/signup",
    label: "Signup",
    Icon: UserPlus,
    auth: "loggedOut",
  },
];

export const SITE_NAV_LINKS = [
  {
    href: "/about",
    label: "About",
    Icon: Info,
  },
  {
    href: "/install",
    label: "Install Guide",
    Icon: Download,
  },
  {
    href: "/contact",
    label: "Contact",
    Icon: Mail,
  },
  {
    href: "/merch",
    label: "Merch",
    Icon: ShoppingBag,
  },
  {
    href: "/legal",
    label: "Legal",
    Icon: Scale,
  },
];

export const LOGGED_OUT_SITE_LINKS = [
  {
    href: "https://triggerfeed.com",
    label: "TriggerFeed.com",
    Icon: Home,
    external: true,
  },
  ...SITE_NAV_LINKS,
];
