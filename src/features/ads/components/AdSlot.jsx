import Link from "next/link";
import Image from "next/image";
import { houseAds } from "../data/houseAds";

function pickAd(slot, deterministic = false) {
  const ads = houseAds.filter((ad) => ad.slot === slot && ad.active);
  if (!ads.length) return null;

  const index = deterministic ? 0 : Math.floor(Math.random() * ads.length);
  return ads[index];
}

function AdContent({ ad, eagerImage = false }) {
  return (
    <>
      {ad.image ? (
        <Image
          className="ad-card__image"
          src={ad.image}
          alt=""
          width={220}
          height={220}
          sizes="(min-width: 78.125rem) 200px, 100vw"
          loading={eagerImage ? "eager" : undefined}
          fetchPriority={eagerImage ? "high" : undefined}
        />
      ) : null}

      <div className="ad-card__content">
        {ad.title ? <h3 className="ad-card__title">{ad.title}</h3> : null}
        {ad.body ? <p className="ad-card__body">{ad.body}</p> : null}
        <span className="ad-card__cta">{ad.cta}</span>
      </div>
    </>
  );
}

export default function AdSlot({
  slot = "right-sidebar-small",
  deterministic = false,
  eagerImage = false,
}) {
  const ad = pickAd(slot, deterministic);

  if (!ad) return null;

  const isExternal = ad.newTab || ad.href?.startsWith("http");

  return (
    <aside
      className="ad-card app-right-rail__module-inner"
      aria-label={isExternal ? "Sponsored link" : "TriggerFeed promotion"}
    >
      <h2 className="ad-card__label">
        {ad.type === "sponsor" ? "Sponsored" : "Support TriggerFeed"}
      </h2>

      {isExternal ? (
        <a
          className="ad-card__link"
          href={ad.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <AdContent ad={ad} eagerImage={eagerImage} />
        </a>
      ) : (
        <Link className="ad-card__link" href={ad.href}>
          <AdContent ad={ad} eagerImage={eagerImage} />
        </Link>
      )}
    </aside>
  );
}
