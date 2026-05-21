import Link from "next/link";

const tabs = [
  {
    key: "main",
    label: "Main Feed",
    href: "/?feed=main",
  },
  {
    key: "friends",
    label: "Friends",
    href: "/?feed=friends",
  },
  {
    key: "trending",
    label: "Trending",
    href: "/?feed=trending",
  },
];

export default function FeedTabs({ activeFeed = "main" }) {
  return (
    <nav className="feed-tabs" aria-label="Feed filters">
      {tabs.map((tab) => {
        const isActive = activeFeed === tab.key;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`feed-tabs__link ${
              isActive ? "feed-tabs__link--active" : ""
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}