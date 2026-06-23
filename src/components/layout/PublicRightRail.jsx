import AdSlot from "@/features/ads/components/AdSlot";

export default function PublicRightRail() {
  return (
    <div className="public-right-rail">
      <section className="app-right-rail__module">
        <AdSlot slot="right-sidebar-small" deterministic />
      </section>
    </div>
  );
}
