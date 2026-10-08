"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { removeFoundingStatus } from "../actions/foundingActions";

export default function RemoveFoundingButton({ userId, number, name, finalized = false }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (!Number.isInteger(number)) return null;

  function remove() {
    const reason = window.prompt("Optional reason for removing Founding status", "");
    if (reason === null) return;
    if (!window.confirm(`Remove Founding #${number} from ${name}?\n\nThis affects Founding status only. The account, profile type, and content will NOT be deleted or changed.\n\n${finalized ? "The program is finalized. This number will be retired and remain reserved; other members will not be renumbered." : "Enrollment is open. Later Founding members will be renumbered down by one. If the registry already has gaps, CEO repair is required first."}`)) return;
    startTransition(async () => {
      const result = await removeFoundingStatus({ userId, number, reason });
      if (result.ok) {
        toast.success("Founding status removed.");
        router.refresh();
      } else toast.error(result.message);
    });
  }
  return <button type="button" className="admin-user-card__action admin-user-card__action--danger" disabled={pending} onClick={remove}>
    {pending ? "Removing…" : "Remove Founding Status"}
  </button>;
}
