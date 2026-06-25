export default function NavBadge({ count = 0, className = "", label = null }) {
  const numericCount = Number(count) || 0;

  if (numericCount <= 0) {
    return null;
  }

  const displayCount = numericCount > 99 ? "99+" : numericCount;

  return (
    <span
      className={["nav-badge", className].filter(Boolean).join(" ")}
      aria-label={
        label || `${displayCount} pending item${numericCount === 1 ? "" : "s"}`
      }
    >
      {displayCount}
    </span>
  );
}
