import { createClient } from "@/lib/supabase/server";

export const MARKETING_DATE_RANGES = {
  all: {
    label: "All Time",
    days: null,
  },
  "7d": {
    label: "Last 7 Days",
    days: 7,
  },
  "30d": {
    label: "Last 30 Days",
    days: 30,
  },
};

function getRangeConfig(range) {
  return MARKETING_DATE_RANGES[range] || MARKETING_DATE_RANGES.all;
}

export function normalizeMarketingDateRange(range) {
  return MARKETING_DATE_RANGES[range] ? range : "all";
}

function getRangeBounds(range) {
  const config = getRangeConfig(range);

  if (!config.days) {
    return {
      startAt: null,
      endAt: null,
    };
  }

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - config.days);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeTotals(row) {
  return {
    visits: toNumber(row?.visits),
    uniqueVisitors: toNumber(row?.unique_visitors),
    registrations: toNumber(row?.registrations),
    firstVisitAt: row?.first_visit_at || null,
    lastVisitAt: row?.last_visit_at || null,
  };
}

function normalizeSummaryRow(row) {
  return {
    source: row?.source || "unknown",
    campaign: row?.campaign || "",
    visits: toNumber(row?.visits),
    uniqueVisitors: toNumber(row?.unique_visitors),
    registrations: toNumber(row?.registrations),
    firstVisitAt: row?.first_visit_at || null,
    lastVisitAt: row?.last_visit_at || null,
  };
}

function normalizeDeviceRow(row) {
  return {
    deviceCategory: row?.device_category || "unknown",
    visits: toNumber(row?.visits),
    uniqueVisitors: toNumber(row?.unique_visitors),
    registrations: toNumber(row?.registrations),
  };
}

function logDashboardError(label, error) {
  console.error(label, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}

export async function getMarketingAttributionDashboard({ range = "all" } = {}) {
  const supabase = await createClient();
  const normalizedRange = normalizeMarketingDateRange(range);
  const { startAt, endAt } = getRangeBounds(normalizedRange);
  const rpcArgs = {
    p_start_at: startAt,
    p_end_at: endAt,
  };

  const [totalsResult, summaryResult, deviceResult] = await Promise.all([
    supabase.rpc("get_marketing_attribution_totals", rpcArgs).maybeSingle(),
    supabase.rpc("get_marketing_attribution_summary", rpcArgs),
    supabase.rpc("get_marketing_device_breakdown", rpcArgs),
  ]);

  let error = null;

  if (totalsResult.error) {
    logDashboardError("GET MARKETING ATTRIBUTION TOTALS ERROR:", totalsResult.error);
    error = totalsResult.error;
  }

  if (summaryResult.error) {
    logDashboardError("GET MARKETING ATTRIBUTION SUMMARY ERROR:", summaryResult.error);
    error = error || summaryResult.error;
  }

  if (deviceResult.error) {
    logDashboardError("GET MARKETING DEVICE BREAKDOWN ERROR:", deviceResult.error);
    error = error || deviceResult.error;
  }

  return {
    error,
    range: normalizedRange,
    totals: normalizeTotals(totalsResult.data),
    sourceCampaignRows: (summaryResult.data || []).map(normalizeSummaryRow),
    deviceRows: (deviceResult.data || []).map(normalizeDeviceRow),
  };
}
