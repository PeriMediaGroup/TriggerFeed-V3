import EditTopGuns from "@/features/guns/components/EditTopGuns";

export default function ManageGunsPanel({ topGuns = [] }) {
  return (
    <section className="manage-guns-panel">
      <header className="manage-guns-panel__header">
        <h2>Top Guns</h2>
        <p>Choose up to 4 favorite guns to display on your profile.</p>
      </header>

      <div className="manage-guns-panel__editor">
        <EditTopGuns currentTopGuns={topGuns} autosave />
      </div>
    </section>
  );
}