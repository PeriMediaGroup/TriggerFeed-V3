import { merchProducts } from "../data/merchProducts";
import { MerchProductCard } from "./MerchProductCard";

export function MerchProductGrid() {
  return (
    <section className="merch-section" aria-labelledby="merch-products-title">
      <div className="merch-section__header">
        <p className="merch-section__eyebrow">Available soon</p>
        <h2 className="merch-section__title" id="merch-products-title">
          Small-batch TriggerFeed gear
        </h2>
        <p className="merch-section__body">
          We are starting small with stickers and a limited shirt batch. No giant
          warehouse, no corporate merch goblin, just the stuff we actually have.
        </p>
      </div>

      <div className="merch-grid">
        {merchProducts.map((product) => (
          <MerchProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}