import AdminSectionNav from "./AdminSectionNav";

export default function AdminPageShell({
  activeSection,
  children,
  counts = null,
  eyebrow = "Administration",
  title,
  summary,
}) {
  return (
    <section className="admin-shell">
      <header className="admin-shell__header">
        <div className="admin-shell__heading">
          <p className="admin-shell__eyebrow">{eyebrow}</p>
          <h1 className="admin-shell__title">{title}</h1>
          {summary ? <p className="admin-shell__summary">{summary}</p> : null}
        </div>

        <AdminSectionNav activeSection={activeSection} counts={counts} />
      </header>

      <div className="admin-shell__body">{children}</div>
    </section>
  );
}
