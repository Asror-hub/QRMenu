/**
 * Pricing plans — contact-to-buy (no online checkout).
 * Amounts are in UZS (so'm). Copy comes from i18n keys.
 */
export const PLANS = [
  {
    id: "ordering",
    monthly: 99_000,
    yearly: 79_000,
    variant: "",
    popular: false,
    includesKey: null,
    features: [
      { key: "plan.ordering.feat1", included: true },
      { key: "plan.ordering.feat2", included: true },
      { key: "plan.ordering.feat3", included: true },
      { key: "plan.ordering.feat4", included: true },
      { key: "plan.ordering.feat5", included: true },
      { key: "plan.ordering.feat6", included: true },
      { key: "plan.ordering.no1", included: false },
      { key: "plan.ordering.no2", included: false },
    ],
  },
  {
    id: "grow",
    monthly: 199_000,
    yearly: 159_000,
    variant: "pricing__card--featured",
    popular: true,
    includesKey: "pricing.includesGrow",
    features: [
      { key: "plan.grow.feat1", included: true },
      { key: "plan.grow.feat2", included: true },
      { key: "plan.grow.feat3", included: true },
      { key: "plan.grow.feat4", included: true },
      { key: "plan.grow.feat5", included: true },
      { key: "plan.grow.no1", included: false },
      { key: "plan.grow.no2", included: false },
    ],
  },
  {
    id: "ops",
    monthly: 249_000,
    yearly: 199_000,
    variant: "pricing__card--pro",
    popular: false,
    includesKey: "pricing.includesOps",
    features: [
      { key: "plan.ops.feat1", included: true },
      { key: "plan.ops.feat2", included: true },
      { key: "plan.ops.feat3", included: true },
      { key: "plan.ops.feat4", included: true },
      { key: "plan.ops.feat5", included: true },
      { key: "plan.ops.feat6", included: true },
    ],
  },
];

export function getPlan(planId) {
  return PLANS.find((p) => p.id === planId) || null;
}

export function getPlanName(planId, t) {
  return t(`plan.${planId}.name`);
}
