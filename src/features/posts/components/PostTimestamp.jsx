"use client";

import { useSyncExternalStore } from "react";
import { formatRelativeTime } from "@/lib/formatDate";

const subscribe = () => () => {};

export default function PostTimestamp({ value }) {
  // Post timestamps arrive as serialized ISO strings. Keep the initial date
  // identical across timezones and slow hydration; relative time starts later.
  const label = useSyncExternalStore(
    subscribe,
    () => formatRelativeTime(value),
    () => value ? String(value).slice(0, 10) : "",
  );
  return <time className="post-card__date" dateTime={value || undefined}>{label}</time>;
}
