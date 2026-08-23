import { Platform, StatusBar, TouchableOpacity } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";

export default function CategoriesLayout() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const androidHeaderTop =
    Platform.OS === "android"
      ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
      : undefined;

  const BackButton = () => (
    <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="chevron-back" size={28} color={colors.text} />
    </TouchableOpacity>
  );

  return (
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
          title: t("tileMenu"),
          headerLeft: () => <BackButton />,
        }}
      />
      <Stack.Screen
        name="[categoryId]"
        options={({ route }) => ({
          title:
            (route.params as { categoryName?: string })?.categoryName ??
            t("menuItems"),
          headerLeft: () => <BackButton />,
        })}
      />
    </Stack>
  );
}
