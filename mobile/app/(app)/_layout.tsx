import { Platform, StatusBar } from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { OrdersProvider } from "@/src/context/OrdersContext";
import { FeedbackAlertsProvider } from "@/src/context/FeedbackAlertsContext";

export default function AppLayout() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const androidHeaderTop =
    Platform.OS === "android"
      ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
      : undefined;

  return (
    <OrdersProvider>
    <FeedbackAlertsProvider>
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "600", fontSize: 17 },
        headerBackButtonDisplayMode: "minimal",
        headerBackTitleVisible: false,
        ...(androidHeaderTop != null
          ? { headerStatusBarHeight: androidHeaderTop }
          : null),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="dashboard"
        options={{
          title: t("tileAnalytics"),
          headerBackTitle: t("navHome"),
        }}
      />
      <Stack.Screen
        name="orders"
        options={{
          title: "",
          headerBackTitle: t("navHome"),
        }}
      />
      <Stack.Screen
        name="history"
        options={{
          title: t("tileHistory"),
          headerBackTitle: t("navHome"),
        }}
      />
      <Stack.Screen
        name="feedbacks"
        options={{
          title: t("tileFeedbacks"),
          headerBackTitle: t("navHome"),
        }}
      />
      <Stack.Screen
        name="submit-order"
        options={{
          title: t("tileSubmitOrder"),
          headerBackTitle: t("navHome"),
        }}
      />
      <Stack.Screen
        name="pos-bridge"
        options={{
          title: t("settingsPosBridgeTitle"),
          headerBackTitle: t("navHome"),
        }}
      />
      <Stack.Screen
        name="categories"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="tables"
        options={{
          title: t("tileTables"),
          headerBackTitle: t("navHome"),
        }}
      />
      <Stack.Screen
        name="reservations"
        options={{
          title: t("tileReserve"),
          headerBackTitle: t("navHome"),
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="support"
        options={{
          title: t("supportTitle"),
          headerBackTitle: t("navHome"),
        }}
      />
    </Stack>
    </FeedbackAlertsProvider>
    </OrdersProvider>
  );
}
