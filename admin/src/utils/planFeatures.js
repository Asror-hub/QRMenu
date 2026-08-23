const PLAN_FEATURES = {
  ordering: ["orders", "menu", "tables", "analytics", "feedbacks", "settings", "support"],
  grow: ["orders", "menu", "tables", "analytics", "feedbacks", "settings", "support", "reservations", "website"],
  ops: [
    "orders",
    "menu",
    "tables",
    "analytics",
    "feedbacks",
    "settings",
    "support",
    "reservations",
    "website",
    "staffOrders",
    "pos",
  ],
};

export function restaurantPlanId(restaurant) {
  const id = restaurant?.plan_id;
  if (id === "grow" || id === "ops" || id === "ordering") return id;
  return "ordering";
}

export function hasPlanFeature(restaurant, feature) {
  const features = PLAN_FEATURES[restaurantPlanId(restaurant)] || PLAN_FEATURES.ordering;
  return features.includes(feature);
}
