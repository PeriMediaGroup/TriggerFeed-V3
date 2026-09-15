"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  getDeviceCategory,
  getOrCreateVisitorId,
  parseAttributionParams,
  storeFirstTouchAttribution,
} from "@/features/marketing/attribution";

function logAttributionWarning(message, details = {}) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.warn(`[marketing-attribution] ${message}`, details);
}

function getReferrerHost() {
  if (!document.referrer) {
    return "";
  }

  try {
    const referrer = new URL(document.referrer);

    if (referrer.origin === window.location.origin) {
      return "";
    }

    return referrer.host;
  } catch {
    return "";
  }
}

export default function AttributionTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const currentSearchParams =
      currentUrl.searchParams?.toString() ? currentUrl.searchParams : searchParams;
    const parsed = parseAttributionParams(currentSearchParams);

    if (!parsed?.source) {
      return;
    }

    const visitorId = getOrCreateVisitorId();
    const queryString =
      currentSearchParams?.toString?.() || currentUrl.searchParams.toString();
    const landingPath = `${pathname || currentUrl.pathname || "/"}${
      queryString ? `?${queryString}` : ""
    }`;

    storeFirstTouchAttribution({
      visitorId,
      source: parsed.source,
      campaign: parsed.campaign,
      landingPath,
    });

    const supabase = createClient();

    void (async () => {
      const { error } = await supabase.rpc("record_marketing_attribution_visit", {
        p_visitor_id: visitorId,
        p_source: parsed.source,
        p_campaign: parsed.campaign || null,
        p_landing_path: landingPath,
        p_referrer_host: getReferrerHost(),
        p_device_category: getDeviceCategory(navigator.userAgent),
        p_platform: "web",
      });

      if (error) {
        logAttributionWarning("record_marketing_attribution_visit failed", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          landingPath,
          source: parsed.source,
          campaign: parsed.campaign || null,
        });
      }
    })();
  }, [pathname, searchParams]);

  return null;
}
