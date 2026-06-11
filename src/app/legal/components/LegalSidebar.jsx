"use client";

import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { id: "terms", label: "Terms of Service" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "cookies", label: "Cookie Policy" },
  { id: "csae", label: "CSAE Policy" },
  { id: "abuse", label: "Report Abuse" },
];

export default function LegalSidebar() {
  const [activeId, setActiveId] = useState(NAV_ITEMS[0].id);

  useEffect(() => {
    const sections = NAV_ITEMS.map(({ id }) => document.getElementById(id)).filter(
      Boolean,
    );

    if (!sections.length) return undefined;

    function updateActiveSection() {
      let current = NAV_ITEMS[0].id;

      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 160) {
          current = section.id;
        } else {
          break;
        }
      }

      setActiveId(current);
    }

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
    };
  }, []);

  return (
    <nav className="legal-sidebar">
      <ul className="legal-sidebar__list">
        {NAV_ITEMS.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={
                activeId === id
                  ? "legal-sidebar__link legal-sidebar__link--active"
                  : "legal-sidebar__link"
              }
              aria-current={activeId === id ? "true" : undefined}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
