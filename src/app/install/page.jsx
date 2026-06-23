import Image from "next/image";

const APP_URL = "https://www.triggerfeed.com";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.perimediagroup.triggerfeed";
const GOOGLE_PLAY_TILE = "/images/google-play.svg";
const IOS_TILE = "/images/ios-soon.png";

export default function InstallPage() {
  return (
    <main className="tf-page__content public-page install-page">
      <section className="public-page-hero" aria-labelledby="install-title">
        <div className="public-page-hero__content">
          <p className="public-page-hero__eyebrow">
            Train. Carry. Stay ready.
          </p>
          <h1 className="public-page-hero__title" id="install-title">
            Install TriggerFeed
          </h1>
          <p className="public-page-hero__body">
            Choose your device below to install TriggerFeed. You can use the
            Android app, iOS web app, or the full desktop web version.
          </p>
        </div>
      </section>

      <div className="install-page__grid">
        <section className="install-page__panel tf-page__content--ghost">
          <h2>Android</h2>

          <p className="install-page__label">Get TriggerFeed on Android.</p>
          <a
            href={GOOGLE_PLAY_URL}
            target="_blank"
            rel="noreferrer"
            className=""
          >
            <Image
              src={GOOGLE_PLAY_TILE}
              alt="Google Play Store"
              className=""
              width={180}
              height={54}
              sizes="180px"
            />
          </a>
        </section>

        <section className="install-page__panel tf-page__content--ghost">
          <h2>iPhone & iPad (iOS)</h2>
          <Image
            src={IOS_TILE}
            alt="TriggerFeed for iOS coming soon"
            className=""
            width={180}
            height={54}
            sizes="180px"
          />
          <p className="install-page__soon">iOS App Store version someday.</p>
        </section>
      </div>

      <section className="install-page__desktop tf-page__content--ghost">
        <h2>Desktop</h2>
        <p>You can access TriggerFeed on any computer by visiting:</p>
        <a
          href={APP_URL}
          target="_blank"
          rel="noreferrer"
          className="install-page__app-link"
        >
          {APP_URL}
        </a>
        <p>
          Full functionality: posting, notifications, profile editing, and more.
        </p>
      </section>
    </main>
  );
}
