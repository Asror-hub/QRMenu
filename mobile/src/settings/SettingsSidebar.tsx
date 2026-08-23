import { ScrollView, TouchableOpacity } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { settingsGroupsForPlan, type SettingsHref } from "@/src/settings/nav";
import { useRestaurant } from "@/src/context/RestaurantContext";

export function SettingsSidebar() {
  const { colors, theme } = useTheme();
  const { t } = useLanguage();
  const { restaurant } = useRestaurant();
  const settingsGroups = settingsGroupsForPlan(restaurant);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isLight = theme === "light";
  const hairline = isLight ? "rgba(148, 163, 184, 0.22)" : "rgba(168, 162, 158, 0.22)";
  const panelBorder = isLight ? "rgba(148, 163, 184, 0.32)" : "rgba(168, 162, 158, 0.28)";
  const cardBg = colors.surface;

  const isActive = (href: SettingsHref) => {
    const slug = href.split("/").pop() ?? "";
    return pathname === href || pathname.endsWith(`/${slug}`) || pathname.includes(`/settings/${slug}`);
  };

  const openSection = (href: SettingsHref) => {
    if (isActive(href)) return;
    router.replace(href);
  };

  return (
    <Sidebar
      style={{
        backgroundColor: colors.bg,
        borderRightColor: hairline,
        paddingBottom: Math.max(insets.bottom, 16),
      }}
    >
      <SidebarHeader>
        <TouchableOpacity
          onPress={() => router.replace("/(app)")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityRole="button"
          accessibilityLabel={t("backToHome")}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <SidebarTitle style={{ color: colors.text }}>{t("settings")}</SidebarTitle>
      </SidebarHeader>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        {settingsGroups.map((group) => (
          <GroupBlock key={group.id}>
            <SectionHeader>
              <SectionTitle style={{ color: colors.textMuted }}>
                {t(group.titleKey)}
              </SectionTitle>
            </SectionHeader>
            <ManagePanel style={{ backgroundColor: cardBg, borderColor: panelBorder }}>
              {group.links.map((link, index) => {
                const active = isActive(link.href);
                return (
                  <ManageRow
                    key={link.id}
                    onPress={() => openSection(link.href)}
                    activeOpacity={0.72}
                    style={{
                      borderBottomWidth: index === group.links.length - 1 ? 0 : 1,
                      borderBottomColor: hairline,
                      backgroundColor: active
                        ? isLight
                          ? "rgba(255, 102, 0, 0.08)"
                          : "rgba(255, 102, 0, 0.14)"
                        : "transparent",
                    }}
                  >
                    <ManageIcon
                      style={{
                        backgroundColor: active
                          ? isLight
                            ? "rgba(255, 102, 0, 0.14)"
                            : "rgba(255, 102, 0, 0.22)"
                          : isLight
                            ? `${link.ink}18`
                            : "rgba(255,255,255,0.08)",
                      }}
                    >
                      <Ionicons
                        name={link.icon}
                        size={18}
                        color={active ? colors.sidebarOrange : isLight ? link.ink : colors.text}
                      />
                    </ManageIcon>
                    <ManageCopy>
                      <ManageLabel
                        style={{ color: active ? colors.sidebarOrange : colors.text }}
                      >
                        {t(link.titleKey)}
                      </ManageLabel>
                      <ManageHint style={{ color: colors.textMuted }}>
                        {t(link.hintKey)}
                      </ManageHint>
                    </ManageCopy>
                  </ManageRow>
                );
              })}
            </ManagePanel>
          </GroupBlock>
        ))}
      </ScrollView>
    </Sidebar>
  );
}

const Sidebar = styled.View`
  width: 340px;
  border-right-width: 1px;
`;

const SidebarHeader = styled.View`
  height: 56px;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding-horizontal: 10px;
`;

const SidebarTitle = styled.Text`
  flex: 1;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.4px;
`;

const GroupBlock = styled.View`
  gap: 10px;
`;

const SectionHeader = styled.View`
  padding-horizontal: 4px;
`;

const SectionTitle = styled.Text`
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
`;

const ManagePanel = styled.View`
  border-radius: 20px;
  border-width: 1px;
  overflow: hidden;
`;

const ManageRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  min-height: 64px;
`;

const ManageIcon = styled.View`
  width: 38px;
  height: 38px;
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
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.15px;
`;

const ManageHint = styled.Text`
  font-size: 11px;
  font-weight: 500;
  line-height: 15px;
`;
