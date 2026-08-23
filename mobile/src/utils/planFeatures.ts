export type PlanFeature =
  | "orders"
  | "menu"
  | "tables"
  | "analytics"
  | "feedbacks"
  | "settings"
  | "support"
  | "reservations"
  | "website"
  | "staffOrders"
  | "pos";

const PLAN_FEATURES: Record<string, PlanFeature[]> = {
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

export function restaurantPlanId(restaurant?: { plan_id?: string | null } | null) {
  const id = restaurant?.plan_id;
  if (id === "grow" || id === "ops" || id === "ordering") return id;
  return "ordering";
}

export function hasPlanFeature(
  restaurant: { plan_id?: string | null } | null | undefined,
  feature: PlanFeature
) {
  const features = PLAN_FEATURES[restaurantPlanId(restaurant)] ?? PLAN_FEATURES.ordering;
  return features.includes(feature);
}
