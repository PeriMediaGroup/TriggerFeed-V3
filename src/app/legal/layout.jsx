import LegalSidebar from "./components/LegalSidebar";

export default function LegalLayout({ children }) {
  return (
    <div className="tf-page__content legal-layout">
      <aside className="legal-layout__sidebar" aria-label="Legal sections">
        <LegalSidebar />
      </aside>

      <main className="legal-layout__content">{children}</main>
    </div>
  );
}
