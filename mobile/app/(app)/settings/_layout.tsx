import { useEffect } from "react";
import { Platform, StatusBar, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Slot, Stack, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import { SettingsSidebar } from "@/src/settings/SettingsSidebar";
import {
  SettingsHeaderActionsProvider,
  TabletSettingsDetailHeader,
} from "@/src/settings/SettingsHeaderActions";
import { DEFAULT_SETTINGS_HREF, SETTINGS_SECTION_TITLE_KEYS } from "@/src/settings/nav";
import { useLanguage } from "@/src/context/LanguageContext";

export default function SettingsLayout() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;
  const androidHeaderTop =
    Platform.OS === "android"
      ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
      : undefined;

  useEffect(() => {
    if (!isTablet) return;
    const atSettingsRoot =
      pathname === "/settings" ||
      pathname === "/(app)/settings" ||
      /\/settings\/?$/.test(pathname);
    if (atSettingsRoot) {
      router.replace(DEFAULT_SETTINGS_HREF);
    }
  }, [isTablet, pathname, router]);

  const BackButton = () => (
    <TouchableOpacity
      onPress={() => router.back()}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="chevron-back" size={28} color={colors.text} />
    </TouchableOpacity>
  );

  if (!isTablet) {
    return (
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "600", fontSize: 17 },
          headerBackButtonDisplayMode: "minimal",
          headerBackTitleVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          ...(androidHeaderTop != null
            ? { headerStatusBarHeight: androidHeaderTop }
            : null),
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: t("settings"),
            headerLeft: () => <BackButton />,
          }}
        />
        {(
          Object.keys(SETTINGS_SECTION_TITLE_KEYS) as Array<
            keyof typeof SETTINGS_SECTION_TITLE_KEYS
          >
        ).map((name) => (
          <Stack.Screen
            key={name}
            name={name}
            options={{
              title: t(SETTINGS_SECTION_TITLE_KEYS[name]),
              headerLeft: () => <BackButton />,
              headerBackVisible: false,
            }}
          />
        ))}
      </Stack>
    );
  }

  return (
    <SettingsHeaderActionsProvider>
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          backgroundColor: colors.bg,
          paddingTop: insets.top,
        }}
      >
        <SettingsSidebar />
        <View style={{ flex: 1, minWidth: 0, backgroundColor: colors.bg }}>
          <TabletSettingsDetailHeader />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Slot />
          </View>
        </View>
      </View>
    </SettingsHeaderActionsProvider>
  );
}
