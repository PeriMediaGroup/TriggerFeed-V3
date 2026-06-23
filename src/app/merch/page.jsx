export default function MerchPage() {
  return (
    <main className="tf-page__content public-page merch-page">
      <section className="public-page-hero" aria-labelledby="merch-title">
        <div className="public-page-hero__content">
          <p className="public-page-hero__eyebrow">
            Gear for the community
          </p>
          <h1 className="public-page-hero__title" id="merch-title">
            TriggerFeed Merch
          </h1>
          <p className="public-page-hero__body">
            Shirts, stickers, and small-batch gear for folks who want to help
            support TriggerFeed while we build.
          </p>
          <div className="public-page-hero__actions">
            <span className="public-page-hero__action public-page-hero__action--status">
              Shop coming soon
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
