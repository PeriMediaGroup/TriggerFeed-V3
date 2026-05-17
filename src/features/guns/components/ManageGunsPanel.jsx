// src/features/guns/components/ManageGunsPanel.jsx

import EditTopGuns from "@/features/profiles/components/EditTopGuns";

export default function ManageGunsPanel({ topGuns = [] }) {
  return (
    <section className="manage-guns-panel">
      <header className="manage-guns-panel__header">
        <h2>Top Guns</h2>
        <p>Choose up to 4 favorite guns to display on your profile.</p>
      </header>

      <EditTopGuns currentTopGuns={topGuns} />
    </section>
  );
}