export default function AppLoading() {
  return (
    <main className="app-loading" aria-live="polite" aria-busy="true">
      <div className="app-loading__brand" />
      <div className="app-loading__line app-loading__line--wide" />
      <div className="app-loading__line" />
      <div className="app-loading__card" />
      <span className="app-loading__text">Loading TriggerFeed...</span>
    </main>
  );
}
