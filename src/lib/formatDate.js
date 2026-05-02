import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

function toDate(value) {
  if (!value) return null;

  const date = typeof value === "string" ? parseISO(value) : new Date(value);

  return isValid(date) ? date : null;
}

export function formatShortDate(value) {
  const date = toDate(value);
  if (!date) return "";

  return format(date, "MMM d, yyyy");
}

export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "";

  return format(date, "MMM d, yyyy 'at' h:mm a");
}

export function formatRelativeTime(value) {
  const date = toDate(value);
  if (!date) return "";

  return `${formatDistanceToNowStrict(date)} ago`;
}

export function formatEditedDate(value) {
  const date = toDate(value);
  if (!date) return "";

  return `Edited ${format(date, "MMM d, yyyy 'at' h:mm a")}`;
}