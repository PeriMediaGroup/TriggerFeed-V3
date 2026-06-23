const statusLabels = {
  in_stock: "In stock",
  limited: "Limited quantity",
  sold_out: "Sold out",
  coming_soon: "Coming soon",
};

export function MerchProductCard({ product }) {
  const hasOptions = product.options?.length > 0;

  return (
    <article className="merch-card">
      <div className="merch-card__media" aria-hidden="true">
        <span className="merch-card__placeholder">
          {product.type === "shirt" ? "TF Shirt" : "TF Stickers"}
        </span>
      </div>

      <div className="merch-card__content">
        <div className="merch-card__topline">
          <h3 className="merch-card__title">{product.name}</h3>
          <span className={`merch-card__status merch-card__status--${product.status}`}>
            {statusLabels[product.status] ?? product.status}
          </span>
        </div>

        <p className="merch-card__price">{product.price}</p>

        <p className="merch-card__description">{product.description}</p>

        {product.inventoryNote ? (
          <p className="merch-card__note">{product.inventoryNote}</p>
        ) : null}

        {hasOptions ? (
          <div className="merch-card__options" aria-label={`${product.name} sizes`}>
            {product.options.map((option) => {
              const isSoldOut = option.quantity <= 0;

              return (
                <span
                  className={`merch-card__option ${
                    isSoldOut ? "merch-card__option--sold-out" : ""
                  }`}
                  key={option.label}
                  title={
                    isSoldOut
                      ? `${option.label} sold out`
                      : `${option.label} available`
                  }
                >
                  {option.label}
                </span>
              );
            })}
          </div>
        ) : null}

        {product.ctaHref ? (
          <a className="merch-card__button" href={product.ctaHref}>
            {product.ctaLabel}
          </a>
        ) : (
          <span className="merch-card__button merch-card__button--disabled">
            {product.ctaLabel}
          </span>
        )}
      </div>
    </article>
  );
}