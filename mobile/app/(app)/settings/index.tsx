import { useEffect, useLayoutEffect } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, Platform, StatusBar } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { DEFAULT_SETTINGS_HREF, settingsGroupsForPlan } from "@/src/settings/nav";
import { useRestaurant } from "@/src/context/RestaurantContext";

export default function SettingsHub() {
  const { colors, theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const { restaurant } = useRestaurant();
  const settingsGroups = settingsGroupsForPlan(restaurant);
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;
  const isLight = theme === "light";
  const hairline = isLight ? "rgba(148, 163, 184, 0.22)" : "rgba(168, 162, 158, 0.22)";
  const panelBorder = isLight ? "rgba(148, 163, 184, 0.32)" : "rgba(168, 162, 158, 0.28)";
  const softFillStrong = isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)";
  const themeBtnBorder = isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)";
  const cardBg = colors.surface;

  useEffect(() => {
    if (!isTablet) return;
    router.replace(DEFAULT_SETTINGS_HREF);
  }, [isTablet, router]);

  useLayoutEffect(() => {
    if (isTablet) return;
    const topInset =
      Platform.OS === "android"
        ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
        : insets.top;
    navigation.setOptions({
      header: () => (
        <View
          style={{
            paddingTop: topInset,
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: hairline,
          }}
        >
          <View style={styles.headerRow}>
            <View style={styles.sideSlot}>
              <TouchableOpacity
                onPress={() => router.back()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel={t("goBack")}
              >
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {t("settings")}
            </Text>

            <View style={[styles.sideSlot, styles.sideSlotEnd]}>
              <TouchableOpacity
                onPress={toggleTheme}
                activeOpacity={0.72}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                style={[
                  styles.themeBtn,
                  {
                    borderColor: themeBtnBorder,
                    backgroundColor: softFillStrong,
                  },
                ]}
              >
                <Ionicons
                  name={theme === "dark" ? "sunny" : "moon"}
                  size={20}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ),
    });
  }, [
    navigation,
    router,
    insets.top,
    colors.surface,
    colors.text,
    hairline,
    toggleTheme,
    theme,
    themeBtnBorder,
    softFillStrong,
    isTablet,
    t,
  ]);

  if (isTablet) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 18 }}
    >
      {settingsGroups.map((group) => (
        <GroupBlock key={group.id}>
          <SectionHeader>
            <SectionTitle style={{ color: colors.text }}>
              {t(group.titleKey)}
            </SectionTitle>
          </SectionHeader>
          <ManagePanel style={{ backgroundColor: cardBg, borderColor: panelBorder }}>
            {group.links.map((link, index) => (
              <ManageRow
                key={link.id}
                onPress={() => router.push(link.href)}
                activeOpacity={0.72}
                style={{
                  borderBottomWidth: index === group.links.length - 1 ? 0 : 1,
                  borderBottomColor: hairline,
                }}
              >
                <ManageIcon
                  style={{
                    backgroundColor: isLight ? `${link.ink}18` : "rgba(255,255,255,0.08)",
                  }}
                >
                  <Ionicons name={link.icon} size={18} color={isLight ? link.ink : colors.text} />
                </ManageIcon>
                <ManageCopy>
                  <ManageLabel style={{ color: colors.text }}>
                    {t(link.titleKey)}
                  </ManageLabel>
                  <ManageHint style={{ color: colors.textMuted }}>
                    {t(link.hintKey)}
                  </ManageHint>
                </ManageCopy>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </ManageRow>
            ))}
          </ManagePanel>
        </GroupBlock>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  sideSlot: {
    width: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  sideSlotEnd: {
    alignItems: "flex-end",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "600",
  },
  themeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

const GroupBlock = styled.View`
  gap: 12px;
`;

const SectionHeader = styled.View`
  padding-horizontal: 4px;
`;

const SectionTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const ManagePanel = styled.View`
  border-radius: 24px;
  border-width: 1px;
  overflow: hidden;
`;

const ManageRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  min-height: 72px;
`;

const ManageIcon = styled.View`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
`;

const ManageCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 2px;
`;

const ManageLabel = styled.Text`
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
`;

const ManageHint = styled.Text`
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
`;
