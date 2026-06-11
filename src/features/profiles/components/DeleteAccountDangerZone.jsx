"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteMyAccount } from "@/features/profiles/actions/deleteAccount";

export default function DeleteAccountDangerZone() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isPending, startTransition] = useTransition();

  const canConfirm = confirmText === "DELETE" && !isPending;

  function closeModal() {
    if (isPending) return;
    setIsOpen(false);
    setConfirmText("");
    setStatus({ type: "", message: "" });
  }

  function handleDelete() {
    if (!canConfirm) return;

    setStatus({ type: "", message: "" });

    startTransition(async () => {
      const result = await deleteMyAccount(confirmText);

      if (!result?.success) {
        setStatus({
          type: "error",
          message: result?.message || "Could not delete your account.",
        });
        return;
      }

      setStatus({ type: "success", message: "Account deleted. Signing out..." });
      router.replace("/account-deleted");
      router.refresh();
    });
  }

  return (
    <section className="profile-settings__panel danger-zone">
      <div className="profile-settings__panel-header">
        <div>
          <h3>Danger Zone</h3>
          <p>Delete your account from TriggerFeed.</p>
        </div>
      </div>

      <div className="danger-zone__body">
        <p>
          This soft-deletes your profile and signs you out. Posts, comments,
          media, friends, notifications, and auth records are retained for now.
        </p>

        <button
          type="button"
          className="danger-zone__button"
          onClick={() => setIsOpen(true)}
        >
          Delete Account
        </button>
      </div>

      {isOpen && (
        <div className="danger-zone__modal-backdrop" role="presentation">
          <div
            className="danger-zone__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <header className="danger-zone__modal-header">
              <h4 id="delete-account-title">Delete Account</h4>
              <button
                type="button"
                className="danger-zone__close"
                onClick={closeModal}
                disabled={isPending}
                aria-label="Close delete account confirmation"
              >
                x
              </button>
            </header>

            <p>
              Type <strong>DELETE</strong> to confirm. This removes your public
              profile details and signs you out.
            </p>

            <label className="danger-zone__confirm-field">
              <span>Confirmation</span>
              <input
                type="text"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                autoComplete="off"
                disabled={isPending}
              />
            </label>

            {status.message && (
              <p
                className={`danger-zone__status danger-zone__status--${status.type}`}
                aria-live="polite"
              >
                {status.message}
              </p>
            )}

            <div className="danger-zone__actions">
              <button
                type="button"
                className="danger-zone__secondary"
                onClick={closeModal}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-zone__button"
                onClick={handleDelete}
                disabled={!canConfirm}
              >
                {isPending ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
