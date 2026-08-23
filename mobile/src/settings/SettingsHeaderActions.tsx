import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Text, View } from "react-native";
import { usePathname } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { SETTINGS_SECTION_TITLE_KEYS } from "@/src/settings/nav";

const SettingsHeaderRightContext = createContext<ReactNode>(null);
const SettingsHeaderSetRightContext = createContext<((node: ReactNode) => void) | null>(null);

export function SettingsHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [right, setRightState] = useState<ReactNode>(null);
  const setRight = useCallback((node: ReactNode) => {
    setRightState(node);
  }, []);

  return (
    <SettingsHeaderSetRightContext.Provider value={setRight}>
      <SettingsHeaderRightContext.Provider value={right}>
        {children}
      </SettingsHeaderRightContext.Provider>
    </SettingsHeaderSetRightContext.Provider>
  );
}

export function useSettingsHeaderActionsOptional() {
  const setRight = useContext(SettingsHeaderSetRightContext);
  return useMemo(
    () => (setRight ? { setRight } : null),
    [setRight]
  );
}

export function TabletSettingsDetailHeader() {
  const { colors, theme } = useTheme();
  const { t } = useLanguage();
  const pathname = usePathname();
  const right = useContext(SettingsHeaderRightContext);
  const isLight = theme === "light";
  const hairline = isLight ? "rgba(148, 163, 184, 0.22)" : "rgba(168, 162, 158, 0.22)";

  const slug = pathname.split("/").filter(Boolean).pop() ?? "";
  const titleKey =
    SETTINGS_SECTION_TITLE_KEYS[slug as keyof typeof SETTINGS_SECTION_TITLE_KEYS];
  const title = titleKey ? t(titleKey) : t("settings");

  return (
    <View
      style={{
        height: 56,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: hairline,
      }}
    >
      <Text
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 17,
          fontWeight: "600",
          color: colors.text,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}
