import { useRestaurant } from "../context/RestaurantContext";
import { useLanguage } from "../context/LanguageContext";
import { hasPlanFeature } from "../utils/planFeatures";

export function PlanGate({ feature, children }) {
  const { restaurant, loading } = useRestaurant();
  const { t } = useLanguage();

  if (loading) return null;
  if (hasPlanFeature(restaurant, feature)) return children;

  return (
    <div style={{ maxWidth: 440, padding: 8 }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>{t("planLockedTitle")}</h1>
      <p style={{ margin: 0, color: "var(--text-muted, #6b7a90)" }}>{t("planLockedBody")}</p>
    </div>
  );
}
