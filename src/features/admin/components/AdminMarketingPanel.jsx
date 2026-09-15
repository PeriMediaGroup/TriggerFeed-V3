import Link from "next/link";

import AdminPageShell from "./AdminPageShell";
import { MARKETING_DATE_RANGES } from "@/features/admin/data/getMarketingAttributionDashboard";

function formatInteger(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatPercent(numerator, denominator) {
  if (!denominator) {
    return "0%";
  }

  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function formatSlug(value, fallback = "Unknown") {
  if (!value) {
    return fallback;
  }

  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function SummaryCard({ label, value, helper }) {
  return (
    <article className="admin-overview__metric-card">
      <div>
        <p className="admin-overview__metric-label">{label}</p>
        <p className="admin-overview__metric-value">{value}</p>
        {helper ? <p className="admin-overview__metric-helper">{helper}</p> : null}
      </div>
    </article>
  );
}

function DateFilterNav({ activeRange }) {
  return (
    <nav className="admin-marketing__filters" aria-label="Marketing date range">
      {Object.entries(MARKETING_DATE_RANGES).map(([range, config]) => (
        <Link
          aria-current={activeRange === range ? "page" : undefined}
          href={range === "all" ? "/admin/marketing" : `/admin/marketing?range=${range}`}
          key={range}
        >
          {config.label}
        </Link>
      ))}
    </nav>
  );
}

function SourceCampaignTable({ rows }) {
  if (!rows.length) {
    return (
      <p className="admin-users__empty">
        No attributed marketing traffic yet. Campaign activity will appear here
        after tracked links or QR codes are used.
      </p>
    );
  }

  return (
    <div className="admin-marketing__table-wrap">
      <table className="admin-marketing__table">
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Campaign</th>
            <th scope="col">Visits</th>
            <th scope="col">Unique</th>
            <th scope="col">Signups</th>
            <th scope="col">Conversion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.source}:${row.campaign || "none"}`}>
              <td>
                <span>{formatSlug(row.source)}</span>
                <code>{row.source}</code>
              </td>
              <td>
                <span>{formatSlug(row.campaign, "No campaign")}</span>
                {row.campaign ? <code>{row.campaign}</code> : null}
              </td>
              <td>{formatInteger(row.visits)}</td>
              <td>{formatInteger(row.uniqueVisitors)}</td>
              <td>{formatInteger(row.registrations)}</td>
              <td>{formatPercent(row.registrations, row.uniqueVisitors)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeviceBreakdown({ rows }) {
  const orderedCategories = ["mobile", "desktop", "tablet", "unknown"];
  const rowsByCategory = new Map(rows.map((row) => [row.deviceCategory, row]));
  const orderedRows = orderedCategories.map(
    (category) =>
      rowsByCategory.get(category) || {
        deviceCategory: category,
        visits: 0,
        uniqueVisitors: 0,
        registrations: 0,
      },
  );

  return (
    <div className="admin-marketing__device-list">
      {orderedRows.map((row) => (
        <article className="admin-marketing__device-card" key={row.deviceCategory}>
          <h3>{formatSlug(row.deviceCategory)}</h3>
          <dl>
            <div>
              <dt>Visits</dt>
              <dd>{formatInteger(row.visits)}</dd>
            </div>
            <div>
              <dt>Unique</dt>
              <dd>{formatInteger(row.uniqueVisitors)}</dd>
            </div>
            <div>
              <dt>Signups</dt>
              <dd>{formatInteger(row.registrations)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

export default function AdminMarketingPanel({
  adminCounts = null,
  dashboard,
}) {
  const totals = dashboard?.totals || {};
  const rows = dashboard?.sourceCampaignRows || [];
  const hasTraffic = totals.visits > 0;

  return (
    <AdminPageShell
      activeSection="marketing"
      counts={adminCounts}
      eyebrow="Administration"
      title="Marketing Attribution"
      summary="Track attributed visits, signups, and campaign performance."
    >
      <section className="admin-marketing">
        <DateFilterNav activeRange={dashboard?.range || "all"} />

        {dashboard?.error ? (
          <p className="admin-users__notice">
            Could not load marketing attribution data.
          </p>
        ) : null}

        <div className="admin-overview__metrics">
          <SummaryCard
            label="Visits"
            value={formatInteger(totals.visits)}
            helper="Attributed traffic events"
          />
          <SummaryCard
            label="Unique Visitors"
            value={formatInteger(totals.uniqueVisitors)}
            helper="Anonymous visitor IDs"
          />
          <SummaryCard
            label="Registrations"
            value={formatInteger(totals.registrations)}
            helper="Converted profiles"
          />
          <SummaryCard
            label="Conversion Rate"
            value={formatPercent(totals.registrations, totals.uniqueVisitors)}
            helper="Signups / unique visitors"
          />
        </div>

        {!hasTraffic ? (
          <p className="admin-users__empty">
            No attributed marketing traffic yet. Campaign activity will appear
            here after tracked links or QR codes are used.
          </p>
        ) : null}

        <section className="admin-marketing__section" aria-labelledby="campaign-performance-heading">
          <div className="admin-overview__section-heading">
            <h2 id="campaign-performance-heading">Source & Campaign Performance</h2>
            <p>Grouped by normalized attribution source and campaign.</p>
          </div>
          <SourceCampaignTable rows={rows} />
        </section>

        <section className="admin-marketing__section" aria-labelledby="device-breakdown-heading">
          <div className="admin-overview__section-heading">
            <h2 id="device-breakdown-heading">Device Breakdown</h2>
            <p>Conservative device categories captured from web traffic.</p>
          </div>
          <DeviceBreakdown rows={dashboard?.deviceRows || []} />
        </section>
      </section>
    </AdminPageShell>
  );
}
