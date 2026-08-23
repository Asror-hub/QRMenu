const PLAN_FEATURES = {
  ordering: ["menu", "orders"],
  grow: ["menu", "orders", "website", "reservations"],
  ops: ["menu", "orders", "website", "reservations"],
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
