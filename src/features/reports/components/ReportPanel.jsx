import AdminManagementNav from "@/features/admin/components/AdminManagementNav";

import AbuseReportCard from "./AbuseReportCard";
import ReportCard from "./ReportCard";

export default function ReportPanel({
  reports = [],
  abuseReports = [],
  permissions,
}) {
  const openReports = reports.filter((report) => report.status === "open");
  const reviewedReports = reports.filter((report) => report.status !== "open");
  const newAbuseReports = abuseReports.filter((report) =>
    ["new", "reviewing"].includes(report.status),
  );
  const reviewedAbuseReports = abuseReports.filter(
    (report) => !["new", "reviewing"].includes(report.status),
  );
  const canViewAbuseReports = ["admin", "ceo"].includes(permissions?.role);

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

      <div className="reports-panel__tabs" aria-label="Report sections">
        <a href="#post-reports">Post Reports</a>
        {canViewAbuseReports ? <a href="#abuse-reports">Abuse Reports</a> : null}
      </div>

      <div className="reports-panel__section">
        <h2 id="post-reports">Open Post Reports</h2>

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
        <h2>Reviewed / Closed Post Reports</h2>

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

      {canViewAbuseReports ? (
        <>
          <div className="reports-panel__section">
            <h2 id="abuse-reports">New Abuse Reports</h2>

            {newAbuseReports.length > 0 ? (
              <div className="reports-panel__list">
                {newAbuseReports.map((report) => (
                  <AbuseReportCard key={report.id} report={report} />
                ))}
              </div>
            ) : (
              <p className="reports-panel__empty">No new abuse reports.</p>
            )}
          </div>

          <div className="reports-panel__section">
            <h2>Reviewed Abuse Reports</h2>

            {reviewedAbuseReports.length > 0 ? (
              <div className="reports-panel__list">
                {reviewedAbuseReports.map((report) => (
                  <AbuseReportCard key={report.id} report={report} />
                ))}
              </div>
            ) : (
              <p className="reports-panel__empty">
                No reviewed abuse reports yet.
              </p>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
