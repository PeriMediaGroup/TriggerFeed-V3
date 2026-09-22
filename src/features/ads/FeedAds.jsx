"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getDeviceCategory, getOrCreateVisitorId } from "@/features/marketing/attribution";
import { adDestination, planAdSlots } from "./adHelpers";

const AdContext = createContext([]);
export function FeedAdsProvider({ postCount, children }) {
  const [ads, setAds] = useState([]);
  useEffect(() => {
    if (postCount < 6) return;
    let active = true;
    const platform = (["mobile", "tablet"].includes(getDeviceCategory(navigator.userAgent)) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) ? "web_mobile" : "web_desktop";
    createClient().rpc("get_feed_ads", {
      p_platform: platform, p_placement: "feed", p_limit: Math.min(8, Math.floor(postCount / 6)), p_visitor_id: getOrCreateVisitorId(),
    }).then(({ data, error }) => { if (active && !error) setAds(data || []); }).catch(() => {});
    return () => { active = false; };
  }, [postCount]);
  const slots = useMemo(() => planAdSlots(postCount, ads), [postCount, ads]);
  return <AdContext.Provider value={slots}>{children}</AdContext.Provider>;
}

export function FeedAdSlot({ after }) {
  const slots = useContext(AdContext);
  const slot = slots.find((entry) => entry.after === after);
  return slot ? <FeedAdCard key={slot.ad.delivery_id} ad={slot.ad} /> : null;
}

export function FeedAdCard({ ad }) {
  const element = useRef(null);
  const tracked = useRef(false);
  const [clicking, setClicking] = useState(false);
  const destination = adDestination(ad);
  useEffect(() => {
    if (!element.current || !destination || typeof IntersectionObserver === "undefined") return;
    let visible = false;
    let timer;
    const update = () => {
      clearTimeout(timer);
      if (visible && document.visibilityState === "visible" && !tracked.current) {
        timer = setTimeout(() => {
          tracked.current = true;
          createClient().rpc("record_ad_event", { p_delivery_id: ad.delivery_id, p_event: "impression" })
            .then(({ error }) => { if (error) tracked.current = false; }).catch(() => { tracked.current = false; });
        }, 1000);
      }
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && entry.intersectionRatio >= 0.5; update(); }, { threshold: [0, 0.5] });
    observer.observe(element.current);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); clearTimeout(timer); document.removeEventListener("visibilitychange", update); };
  }, [ad.delivery_id, destination]);

  async function click(event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      void createClient().rpc("record_ad_event", { p_delivery_id: ad.delivery_id, p_event: "click" }).then(() => {}).catch(() => {});
      return;
    }
    event.preventDefault();
    if (clicking || !destination) return;
    setClicking(true);
    try {
      await Promise.race([
        createClient().rpc("record_ad_event", { p_delivery_id: ad.delivery_id, p_event: "click" }),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch { /* Navigation remains available if tracking is offline. */ }
    finally { window.location.assign(destination); }
  }
  if (!destination) return null;
  return <article ref={element} className="feed-ad" aria-label="Advertisement">
    <p className="feed-ad__disclosure">{ad.advertiser_type === "house" ? "House Promotion" : "Sponsored"} · {ad.advertiser_name}</p>
    {ad.image_url ? <Image className="feed-ad__image" src={ad.image_url} alt={ad.headline} width={800} height={450} unoptimized /> : null}
    <div className="feed-ad__content"><h2>{ad.headline}</h2><p>{ad.body}</p>
      <a className="feed-ad__cta" href={destination} rel="sponsored noopener noreferrer" onClick={click} aria-disabled={clicking}>{clicking ? "Opening..." : ad.call_to_action}</a>
    </div>
  </article>;
}
