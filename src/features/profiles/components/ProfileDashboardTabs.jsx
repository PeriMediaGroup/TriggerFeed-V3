"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

export default function ProfileDashboardTabs({
  defaultTab = "notifications",
  tabs = [],
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const tabsRef = useRef(null);
  const lastScrolledTabRef = useRef(null);
  const tabKeys = useMemo(() => tabs.map((tab) => tab.key), [tabs]);

  const urlTab = searchParams.get("tab");
  const hasValidUrlTab = tabKeys.includes(urlTab);

  const activeTab = useMemo(() => {
    return hasValidUrlTab ? urlTab : defaultTab;
  }, [urlTab, hasValidUrlTab, defaultTab]);

  useEffect(() => {
    if (!hasValidUrlTab) {
      lastScrolledTabRef.current = null;
      return;
    }

    if (lastScrolledTabRef.current === urlTab) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      tabsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      lastScrolledTabRef.current = urlTab;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [hasValidUrlTab, urlTab]);

  function handleTabClick(tabKey) {
    const params = new URLSearchParams(searchParams.toString());

    if (tabKey === defaultTab) {
      params.delete("tab");
    } else {
      params.set("tab", tabKey);
    }

    const queryString = params.toString();

    router.push(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }

  const activePanel = tabs.find((tab) => tab.key === activeTab)?.panel;

  return (
    <section
      id="profile-tabs"
      ref={tabsRef}
      className="profile-dashboard-tabs profile-tabs-anchor"
      data-profile-tabs
    >
      <div
        className="profile-dashboard-tabs__list"
        role="tablist"
        aria-label="Profile dashboard"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              className={
                isActive
                  ? "profile-dashboard-tabs__tab profile-dashboard-tabs__tab--active"
                  : "profile-dashboard-tabs__tab"
              }
              onClick={() => handleTabClick(tab.key)}
              role="tab"
              aria-selected={isActive}
            >
              <span>{tab.label}</span>

              {tab.badge > 0 && (
                <span className="profile-dashboard-tabs__badge">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="profile-dashboard-tabs__panel">{activePanel}</div>
    </section>
  );
}
