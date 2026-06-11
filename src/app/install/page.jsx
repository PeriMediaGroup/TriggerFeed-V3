const APP_URL = "https://app.triggerfeed.com";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.perimediagroup.triggerfeed";

export default function InstallPage() {
  return (
    <main className="tf-page__content install-page">
      <header className="install-page__header">
        <p className="install-page__eyebrow">TriggerFeed V3</p>
        <h1 className="install-page__title">Install TriggerFeed</h1>
        <p className="install-page__intro">
          Choose your device below to install TriggerFeed. You can use the
          Android app, iOS web app, or the full desktop web version.
        </p>
      </header>

      <div className="install-page__grid">
        <section className="install-page__panel tf-page__content--ghost">
          <h2>Android</h2>

          <p className="install-page__label">
            Option 1: Install through Google Play
          </p>
          <a
            href={GOOGLE_PLAY_URL}
            target="_blank"
            rel="noreferrer"
            className="install-page__play-badge"
          >
            <span>Get it on</span>
            <strong>Google Play</strong>
          </a>

          <p className="install-page__label">
            Option 2: Install from the web app
          </p>
          <ol className="install-page__steps">
            <li>
              Open{" "}
              <a href={APP_URL} target="_blank" rel="noreferrer">
                app.triggerfeed.com
              </a>{" "}
              in Chrome.
            </li>
            <li>You should see an install app banner at the bottom.</li>
            <li>
              Tap <strong>Install</strong>.
            </li>
          </ol>
        </section>

        <section className="install-page__panel tf-page__content--ghost">
          <h2>iPhone (iOS)</h2>

          <p className="install-page__label">Install the web app</p>
          <ol className="install-page__steps">
            <li>
              Open{" "}
              <a href={APP_URL} target="_blank" rel="noreferrer">
                app.triggerfeed.com
              </a>{" "}
              in Safari.
            </li>
            <li>
              Tap the <strong>Share</strong> icon.
            </li>
            <li>
              Choose <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Name it <strong>TriggerFeed</strong> and tap{" "}
              <strong>Add</strong>.
            </li>
          </ol>

          <p className="install-page__soon">
            iOS App Store version coming soon.
          </p>
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

      <p className="install-page__note">
        If your phone acts up, close the app and try again.
      </p>
    </main>
  );
}
