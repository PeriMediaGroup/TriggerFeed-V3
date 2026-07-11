import AdminPageShell from "@/features/admin/components/AdminPageShell";

export default function AdminLoading() {
  return (
    <AdminPageShell
      activeSection="overview"
      eyebrow="Administration"
      title="Control Panel"
      summary="Monitor activity, manage users, and review reports."
    >
      <section className="admin-overview" aria-label="Loading admin overview">
        <div className="admin-overview__metrics">
          {["Online Now", "Active - 7 Days", "New - 7 Days", "Total Users"].map(
            (label) => (
              <article key={label} className="admin-overview__metric-card">
                <span className="admin-overview__metric-icon" />
                <div>
                  <p className="admin-overview__metric-label">{label}</p>
                  <p className="admin-overview__metric-value">--</p>
                  <p className="admin-overview__metric-helper">Loading</p>
                </div>
              </article>
            ),
          )}
        </div>
      </section>
    </AdminPageShell>
  );
}
