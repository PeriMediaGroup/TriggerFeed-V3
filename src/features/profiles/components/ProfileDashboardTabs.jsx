"use client";

import { useState } from "react";

export default function ProfileDashboardTabs({
  defaultTab = "posts",
  tabs = [],
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const activePanel = tabs.find((tab) => tab.key === activeTab)?.panel;

  return (
    <section className="profile-dashboard-tabs">
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
              onClick={() => setActiveTab(tab.key)}
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

      <div className="profile-dashboard-tabs__panel">
        {activePanel}
      </div>
    </section>
  );
}