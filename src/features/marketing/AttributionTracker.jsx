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
    const parsed = parseAttributionParams(searchParams);

    if (!parsed?.source) {
      return;
    }

    const visitorId = getOrCreateVisitorId();
    const landingPath = `${pathname || "/"}${
      searchParams?.toString() ? `?${searchParams.toString()}` : ""
    }`;

    storeFirstTouchAttribution({
      visitorId,
      source: parsed.source,
      campaign: parsed.campaign,
      landingPath,
    });

    const supabase = createClient();

    void supabase.rpc("record_marketing_attribution_visit", {
      p_visitor_id: visitorId,
      p_source: parsed.source,
      p_campaign: parsed.campaign || null,
      p_landing_path: landingPath,
      p_referrer_host: getReferrerHost(),
      p_device_category: getDeviceCategory(navigator.userAgent),
      p_platform: "web",
    });
  }, [pathname, searchParams]);

  return null;
}
