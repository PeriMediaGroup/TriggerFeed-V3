import AdminPageShell from "@/features/admin/components/AdminPageShell";
import NavBadge from "@/components/navigation/NavBadge";

import AbuseReportCard from "./AbuseReportCard";
import ReportCard from "./ReportCard";

const ACTIONABLE_REPORT_STATUSES = new Set([
  "open",
  "pending",
  "under_review",
  "escalated",
  "ban_recommended",
]);

export default function ReportPanel({
  reports = [],
  abuseReports = [],
  permissions,
  adminCounts = null,
}) {
  const openReports = reports.filter((report) =>
    ACTIONABLE_REPORT_STATUSES.has(report.status),
  );
  const reviewedReports = reports.filter(
    (report) => !ACTIONABLE_REPORT_STATUSES.has(report.status),
  );
  const newAbuseReports = abuseReports.filter((report) =>
    ["new", "reviewing", "pending", "under_review"].includes(report.status),
  );
  const reviewedAbuseReports = abuseReports.filter(
    (report) =>
      !["new", "reviewing", "pending", "under_review"].includes(report.status),
  );
  const canViewAbuseReports = ["admin", "ceo"].includes(permissions?.role);

  return (
    <AdminPageShell
      activeSection="reports"
      counts={adminCounts}
      eyebrow="Moderation"
      title="Post Reports"
      summary={`${openReports.length} open report${openReports.length === 1 ? "" : "s"}`}
    >
      <section className="reports-panel">

      <div className="reports-panel__tabs" aria-label="Report sections">
        <a href="#post-reports">
          Post Reports
          <NavBadge
            count={adminCounts?.reports}
            className="reports-panel__tab-badge"
          />
        </a>
        {canViewAbuseReports ? (
          <a href="#abuse-reports">
            Abuse Reports
            <NavBadge
              count={adminCounts?.abuseReports}
              className="reports-panel__tab-badge"
            />
          </a>
        ) : null}
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
    </AdminPageShell>
  );
}
