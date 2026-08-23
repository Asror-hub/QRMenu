import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { hasPlanFeature, type PlanFeature } from "@/src/utils/planFeatures";

export function PlanGate({
  feature,
  children,
}: {
  feature: PlanFeature;
  children: ReactNode;
}) {
  const { restaurant, loading } = useRestaurant();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  if (loading) return null;
  if (hasPlanFeature(restaurant, feature)) return children;

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 8 }}>
        {t("planLockedTitle")}
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textMuted }}>
        {t("planLockedBody")}
      </Text>
      <TouchableOpacity
        onPress={() => router.replace("/(app)")}
        style={{ marginTop: 20, alignSelf: "flex-start" }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.sidebarOrange }}>
          {t("backToHome")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
