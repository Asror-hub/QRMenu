import { useEffect, useLayoutEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import { cardShadow } from "@/src/styles/cardShadow";
import { useSettingsHeaderActionsOptional } from "@/src/settings/SettingsHeaderActions";
import { useLanguage } from "@/src/context/LanguageContext";

export function useSettingsChrome() {
  const { colors, theme } = useTheme();
  const isLight = theme === "light";
  const silverBorder = isLight ? "rgba(148, 163, 184, 0.32)" : "rgba(168, 162, 158, 0.28)";
  const softFill = isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)";
  const softFillStrong = isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)";
  const hairline = isLight ? "rgba(148, 163, 184, 0.22)" : "rgba(168, 162, 158, 0.22)";

  return {
    colors,
    theme,
    isLight,
    silverBorder,
    softFill,
    softFillStrong,
    hairline,
    inputStyle: {
      color: colors.text,
      borderColor: silverBorder,
      backgroundColor: softFill,
    },
    sectionStyle: {
      backgroundColor: colors.surface,
      borderColor: silverBorder,
      // Android elevation reads too heavy on settings detail cards.
      ...(Platform.OS === "ios" ? cardShadow : { elevation: 0 }),
    },
    toggleStyle: {
      borderColor: silverBorder,
      backgroundColor: softFill,
    },
  };
}

export const ScreenScroll = styled.ScrollView`
  flex: 1;
`;

export const ErrorCallout = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  border-width: 1px;
  border-radius: 16px;
  padding: 12px 14px;
  margin-bottom: 14px;
`;

export const ErrorText = styled.Text`
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
`;

export const Section = styled.View`
  border-width: 1px;
  border-radius: 22px;
  padding: 16px;
  margin-bottom: 14px;
  gap: 4px;
`;

export const SectionDesc = styled.Text`
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  margin-bottom: 10px;
`;

export const Field = styled.View`
  margin-bottom: 12px;
`;

export const Label = styled.Text`
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  margin-bottom: 6px;
`;

export const Input = styled(TextInput)`
  border-width: 1px;
  border-radius: 16px;
  padding: 13px 14px;
  font-size: 15px;
  font-weight: 500;
`;

export const SaveBtn = styled.TouchableOpacity`
  align-self: stretch;
  height: 48px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
`;

export const SaveBtnText = styled.Text`
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.2px;
`;

type SettingsSaveButtonProps = {
  label: string;
  saving?: boolean;
  saved?: boolean;
  disabled?: boolean;
  onPress: () => void;
  onSavedConsumed?: () => void;
  variant?: "primary" | "ghost";
};

export function SettingsSaveButton({
  label,
  saving = false,
  saved = false,
  disabled = false,
  onPress,
  onSavedConsumed,
  variant = "primary",
}: SettingsSaveButtonProps) {
  const { colors, theme } = useTheme();
  const isLight = theme === "light";
  const progress = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const onSavedConsumedRef = useRef(onSavedConsumed);
  onSavedConsumedRef.current = onSavedConsumed;

  useEffect(() => {
    if (!saved) {
      progress.setValue(0);
      pop.setValue(1);
      return;
    }
    progress.setValue(0);
    pop.setValue(0.92);
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.spring(pop, {
          toValue: 1.04,
          friction: 5,
          tension: 140,
          useNativeDriver: true,
        }),
        Animated.spring(pop, {
          toValue: 1,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) onSavedConsumedRef.current?.();
      });
    }, 1400);
    return () => clearTimeout(timer);
  }, [saved, progress, pop]);

  const isGhost = variant === "ghost";
  const idleBg = isGhost
    ? isLight
      ? "rgba(28, 25, 23, 0.03)"
      : "rgba(255,255,255,0.05)"
    : colors.primary;
  const idleBorder = isGhost ? (isLight ? "rgba(28, 25, 23, 0.1)" : "rgba(255, 255, 255, 0.12)") : "transparent";
  const successBg = colors.success;

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [idleBg, successBg],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [idleBorder, successBg],
  });

  const showSaved = saved;
  const labelColor = showSaved ? "#fff" : isGhost ? colors.text : "#fff";

  return (
    <Animated.View style={{ transform: [{ scale: pop }], marginTop: 4 }}>
      <Animated.View
        style={{
          height: 48,
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor,
          borderWidth: isGhost || showSaved ? 1 : 0,
          borderColor,
          opacity: saving ? 0.7 : 1,
        }}
      >
        <SaveBtn
          onPress={onPress}
          disabled={disabled || saving || saved}
          activeOpacity={0.85}
          style={{
            marginTop: 0,
            backgroundColor: "transparent",
            height: 48,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {showSaved ? <Ionicons name="checkmark-circle" size={18} color="#fff" /> : null}
            <SaveBtnText style={{ color: labelColor }}>
              {saving ? "Saving..." : showSaved ? "Saved" : label}
            </SaveBtnText>
          </View>
        </SaveBtn>
      </Animated.View>
    </Animated.View>
  );
}

type SettingsHeaderSaveProps = {
  label?: string;
  saving?: boolean;
  saved?: boolean;
  disabled?: boolean;
  onPress: () => void;
  onSavedConsumed?: () => void;
};

function HeaderSaveChip({
  label,
  saving,
  saved,
  disabled,
  onPress,
  compact,
}: {
  label: string;
  saving: boolean;
  saved: boolean;
  disabled: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || saving || saved}
      activeOpacity={0.82}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        minWidth: 72,
        height: 34,
        paddingHorizontal: 14,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: saved ? colors.success : colors.primary,
        opacity: saving ? 0.7 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {saved ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
        <SaveBtnText style={{ color: "#fff", fontSize: 13 }}>
          {saving ? "Saving" : saved ? "Saved" : label}
        </SaveBtnText>
      </View>
    </TouchableOpacity>
  );
}

export function useSettingsHeaderSave({
  label = "Save",
  saving = false,
  saved = false,
  disabled = false,
  onPress,
  onSavedConsumed,
}: SettingsHeaderSaveProps) {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const { t } = useLanguage();
  const tabletHeader = useSettingsHeaderActionsOptional();
  const setTabletRight = tabletHeader?.setRight;
  const onPressRef = useRef(onPress);
  const onSavedConsumedRef = useRef(onSavedConsumed);
  onPressRef.current = onPress;
  onSavedConsumedRef.current = onSavedConsumed;

  const isLight = theme === "light";
  const hairline = isLight ? "rgba(148, 163, 184, 0.22)" : "rgba(168, 162, 158, 0.22)";

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => {
      onSavedConsumedRef.current?.();
    }, 1400);
    return () => clearTimeout(timer);
  }, [saved]);

  useLayoutEffect(() => {
    const handlePress = () => {
      onPressRef.current();
    };

    const chip = (
      <HeaderSaveChip
        label={label}
        saving={saving}
        saved={saved}
        disabled={disabled}
        onPress={handlePress}
        compact={!!setTabletRight}
      />
    );

    if (setTabletRight) {
      setTabletRight(chip);
      return () => {
        setTabletRight(null);
      };
    }

    // Phone: fully custom header so the Save chip is never wrapped by the
    // native UIBarButtonItem / glass capsule (the white layer behind the button).
    const topInset =
      Platform.OS === "android"
        ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
        : insets.top;

    navigation.setOptions({
      header: ({ options }: { options: { title?: string } }) => (
        <View
          style={{
            paddingTop: topInset,
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: hairline,
          }}
        >
          <View
            style={{
              height: 56,
              paddingHorizontal: 8,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View style={{ width: 72, alignItems: "flex-start", justifyContent: "center" }}>
              <TouchableOpacity
                onPress={() => router.back()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{
                  width: 40,
                  height: 40,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessibilityRole="button"
                accessibilityLabel={t("goBack")}
              >
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 17,
                fontWeight: "600",
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {options.title ?? ""}
            </Text>

            <View style={{ width: 72, alignItems: "flex-end", justifyContent: "center" }}>
              {chip}
            </View>
          </View>
        </View>
      ),
    });
  }, [
    navigation,
    router,
    setTabletRight,
    saving,
    saved,
    disabled,
    label,
    colors.surface,
    colors.text,
    hairline,
    insets.top,
    t,
  ]);
}

export const SelectBtn = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  border-width: 1px;
  border-radius: 16px;
  padding: 13px 14px;
`;

export const SelectValue = styled.Text`
  font-size: 15px;
  font-weight: 600;
`;

export const ToggleGroup = styled.View`
  border-width: 1px;
  border-radius: 18px;
  overflow: hidden;
  margin-bottom: 12px;
`;

export const ToggleRowInGroup = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 14px;
  border-bottom-width: 1px;
  border-bottom-color: transparent;
`;

export const ToggleRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 14px;
  border-radius: 18px;
  border-width: 1px;
  margin-bottom: 12px;
`;

export const ToggleLabel = styled.Text`
  flex: 1;
  padding-right: 12px;
  font-size: 15px;
  font-weight: 500;
`;

export const GhostBtn = styled.TouchableOpacity`
  height: 48px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

export const GhostBtnText = styled.Text`
  font-size: 15px;
  font-weight: 700;
`;

export const DangerOutlineBtn = styled.TouchableOpacity`
  height: 48px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

export const DangerOutlineText = styled.Text`
  font-size: 15px;
  font-weight: 700;
`;
