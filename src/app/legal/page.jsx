import Abuse from "./components/Abuse";
import Cookies from "./components/Cookies";
import CSAE from "./components/CSAE";
import Privacy from "./components/Privacy";
import Terms from "./components/Terms";

export default function LegalPage() {
  return (
    <div className="legal-page">
      <header className="legal-page__header">
        <p className="legal-page__eyebrow">Legal</p>
        <h1>Legal Information</h1>
        <p>
          This section provides the documents that govern your use of
          TriggerFeed. This copy is operational policy text and still needs
          final legal review before production.
        </p>
      </header>

      <div className="legal-page__sections">
        <Terms />
        <Privacy />
        <Cookies />
        <CSAE />
        <Abuse />
      </div>
    </div>
  );
}
