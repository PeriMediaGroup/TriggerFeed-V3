"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { maintainFounding500 } from "../actions/foundingActions";

export default function FoundingMaintenance({ finalized }) {
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState(null);
  const router = useRouter();

  function run(operation) {
    const phrase = operation === "repair" ? "REPAIR FOUNDING 500" : "FINALIZE FOUNDING 500";
    const explanation = operation === "repair"
      ? "Compact all retired/released gaps in current number order. Existing numbers may change. Accounts, profile types and content are preserved. Previous ledger details will be audited."
      : "Permanently close enrollment, even if fewer than 500 are assigned. Numbers can never be reused or resequenced after this action. This cannot be undone through the admin tools.";
    if (!window.confirm(explanation)) return;
    const confirmation = window.prompt(`Type ${phrase} to confirm.`);
    if (confirmation !== phrase) return;
    const reason = window.prompt("Optional maintenance reason", "");
    if (reason === null) return;
    startTransition(async () => {
      const result = await maintainFounding500({ operation, confirmation, reason });
      if (result.ok) {
        setReport({ operation, ...result.data });
        toast.success(operation === "repair" ? "Founding registry repaired." : "Founding program finalized.");
        router.refresh();
      } else toast.error(result.message);
    });
  }
  return <details className="admin-user-card">
    <summary>CEO maintenance — repair and finalization</summary>
    <p>Repair is for gaps and retired slots, not routine removal. Finalization permanently closes enrollment.</p>
    {finalized ? <p>Finalized: repair, reuse and resequencing are disabled.</p> : <div className="admin-user-card__actions">
      <button className="admin-user-card__action" disabled={pending} onClick={() => run("repair")}>Repair Founding Sequence</button>
      <button className="admin-user-card__action admin-user-card__action--danger" disabled={pending} onClick={() => run("finalize")}>Finalize Founding 500</button>
    </div>}
    {report ? <section aria-live="polite">
      <h2>Maintenance result</h2>
      {report.operation === "repair" ? <>
        <p>Assigned: {report.assigned}. Reclaimed slots: {report.reclaimed_slots}. Renumbered members: {report.mappings.length}. Cleared deleted profiles: {report.cleared_deleted_profiles.length}.</p>
        <ul>{[...report.mappings, ...report.cleared_deleted_profiles].map((row) => <li key={row.profile_id}>{row.profile_id}: #{row.old_number} → {row.new_number ? `#${row.new_number}` : "No Founding status"}</li>)}</ul>
      </> : <p>Finalized. Numbers are now permanent historical identifiers.</p>}
    </section> : null}
  </details>;
}
