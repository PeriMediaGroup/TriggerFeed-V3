import Abuse from "./components/Abuse";
import Cookies from "./components/Cookies";
import CSAE from "./components/CSAE";
import LegalSidebar from "./components/LegalSidebar";
import Privacy from "./components/Privacy";
import Terms from "./components/Terms";

export default function LegalPage() {
  return (
    <main className="tf-page__content public-page legal-page">
      <section id="legal-top" className="public-page-hero" aria-labelledby="legal-title">
        <div className="public-page-hero__content">
          <p className="public-page-hero__eyebrow">
            The boring-but-important stuff
          </p>
          <h1 className="public-page-hero__title" id="legal-title">
            Legal
          </h1>
          <p className="public-page-hero__body">
            Terms, privacy, cookies, safety policies, and abuse reporting for
            TriggerFeed.
          </p>
          <div className="public-page-hero__actions">
            <a className="public-page-hero__action" href="#abuse">
              Report Abuse
            </a>
          </div>
        </div>
      </section>

      <div className="legal-layout">
        <aside className="legal-layout__sidebar" aria-label="Legal sections">
          <LegalSidebar />
        </aside>

        <div className="legal-page__sections">
          <Terms />
          <Privacy />
          <Cookies />
          <CSAE />
          <Abuse />
        </div>
      </div>
    </main>
  );
}
