import { Platform, Pressable, StatusBar, Text, View } from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useAuth } from "@/src/context/AuthContext";
import { OrdersProvider } from "@/src/context/OrdersContext";
import { FeedbackAlertsProvider } from "@/src/context/FeedbackAlertsContext";

export default function AppLayout() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { restaurant, loading } = useRestaurant();
  const { signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const androidHeaderTop =
    Platform.OS === "android"
      ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
      : undefined;
  const showInactiveLock =
    !loading && restaurant?.is_active === false && !pathname?.includes("support");

  return (
    <OrdersProvider>
    <FeedbackAlertsProvider>
    <View style={{ flex: 1 }}>
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
    {showInactiveLock ? (
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          paddingTop: insets.top + 32,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
          backgroundColor: colors.bg,
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700", marginBottom: 10 }}>
          {t("venueInactiveTitle")}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 16, lineHeight: 22, marginBottom: 20 }}>
          {t("venueInactiveBody")}
        </Text>
        <Pressable
          onPress={() => router.push("/support")}
          style={{
            alignSelf: "flex-start",
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
            marginBottom: 10,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>{t("supportTitle")}</Text>
        </Pressable>
        <Pressable onPress={() => void signOut()} style={{ alignSelf: "flex-start", paddingVertical: 10 }}>
          <Text style={{ color: colors.text, fontWeight: "600" }}>{t("settingsAccountSignOut")}</Text>
        </Pressable>
      </View>
    ) : null}
    </View>
    </FeedbackAlertsProvider>
    </OrdersProvider>
  );
}
