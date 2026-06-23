import Link from "next/link";

import { SITE_NAV_LINKS } from "../navigation/navigationLinks";

export default function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <p className="app-footer__copyright">
          &copy; 2026 TriggerFeed. All rights reserved.
        </p>

        <nav className="app-footer__nav" aria-label="Footer navigation">
          <ul className="app-footer__list">
            {SITE_NAV_LINKS.map(({ href, label, Icon }) => (
              <li key={href} className="app-footer__item">
                <Link href={href} className="app-footer__link">
                  <Icon size={15} strokeWidth={2} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
