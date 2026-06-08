import AdminManagementNav from "@/features/admin/components/AdminManagementNav";

import ReportCard from "./ReportCard";

export default function ReportPanel({ reports = [], permissions }) {
  const openReports = reports.filter((report) => report.status === "open");
  const reviewedReports = reports.filter((report) => report.status !== "open");

  return (
    <section className="reports-panel">
      <header className="reports-panel__header">
        <div>
          <p className="reports-panel__eyebrow">Moderation</p>
          <h1 className="reports-panel__title">Post Reports</h1>
          <p className="reports-panel__summary">
            {openReports.length} open report{openReports.length === 1 ? "" : "s"}
          </p>
        </div>

        <AdminManagementNav activeSection="reports" />
      </header>

      <div className="reports-panel__section">
        <h2>Open Reports</h2>

        {openReports.length > 0 ? (
          <div className="reports-panel__list">
            {openReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                permissions={permissions}
              />
            ))}
          </div>
        ) : (
          <p className="reports-panel__empty">No open reports.</p>
        )}
      </div>

      <div className="reports-panel__section">
        <h2>Reviewed / Closed Reports</h2>

        {reviewedReports.length > 0 ? (
          <div className="reports-panel__list">
            {reviewedReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                permissions={permissions}
              />
            ))}
          </div>
        ) : (
          <p className="reports-panel__empty">No reviewed reports yet.</p>
        )}
      </div>
    </section>
  );
}
