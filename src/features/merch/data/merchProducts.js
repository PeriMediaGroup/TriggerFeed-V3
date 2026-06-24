export const merchProducts = [
    {
        id: "classic-tf-stickers",
        name: "Classic TF Stickers",
        type: "stickers",
        price: "$2.49",
        shippingNote: "$1 shipping at checkout.",
        status: "in_stock",
        image: {
            src: "/images/merch/classic-tf-stickers.jpg",
            alt: "Classic TriggerFeed stickers 3 pack",
        },
        description:
            "Set of 3, classic TriggerFeed stickers for your safe, range bag, toolbox, cooler, laptop, or wherever.",
        inventoryNote: "Small batch available.",
        options: [],
        ctaLabel: "Buy Now",
        ctaHref: "https://buy.stripe.com/5kQ14o2x84T97GW4Cq4sE07",
    },
    {
        id: "tf-shirt",
        name: "OG TF Shirt",
        type: "shirt",
        price: "$24.99",
        shippingNote: "$5.99 USPS shipping at checkout.",
        status: "limited",
        image: {
            src: "/images/merch/classic-tf-shirt.jpg",
            alt: "Classic TriggerFeed shirt",
        },
        description:
            "The original TriggerFeed shirt. Limited quantities and sizes from the first small batch.",
        inventoryNote: "Limited sizes available. Inventory will be updated manually.",
        options: [
            { label: "S", quantity: 0, ctaHref: null },
            { label: "M", quantity: 0, ctaHref: null },
            { label: "L", quantity: 4, ctaHref: "https://buy.stripe.com/aFa14o1t4dpF5yOgl84sE0b" },
            { label: "XL", quantity: 4, ctaHref: "https://buy.stripe.com/fZubJ21t41GX8L08SG4sE0a" },
            { label: "2XL", quantity: 1, ctaHref: "https://buy.stripe.com/dRm3cw8VwetJ1iy6Ky4sE09" },
            { label: "3XL", quantity: 2, ctaHref: "https://buy.stripe.com/14AeVe0p00CTaT85Gu4sE08" },
        ],
        ctaLabel: null,
        ctaHref: null,
    },
];