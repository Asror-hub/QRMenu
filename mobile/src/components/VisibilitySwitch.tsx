import { useEffect, useRef } from "react";
import { Animated, Pressable } from "react-native";
import styled from "styled-components/native";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/src/context/LanguageContext";

const TRACK_W = 40;
const TRACK_H = 26;
const THUMB = 18;
const THUMB_TRAVEL = TRACK_W - THUMB - 6;
const FRAME_H = 32;

const ON_GREEN = "#16a34a";

type ThemeColors = {
  primary: string;
  containerBorderStrong: string;
  containerBorderSubtle: string;
};

type VisibilitySwitchProps = {
  visible: boolean;
  onChange: (next: boolean) => void;
  mutedColor: string;
  isLight?: boolean;
  colors: ThemeColors;
  onLabel?: string;
  offLabel?: string;
  /** Full-width row: label left, toggle flush right */
  wide?: boolean;
  /** Settings-style row: only the toggle control (label shown by parent) */
  toggleOnly?: boolean;
};

export function VisibilitySwitch({
  visible,
  onChange,
  mutedColor,
  isLight = true,
  colors,
  onLabel,
  offLabel,
  wide = false,
  toggleOnly = false,
}: VisibilitySwitchProps) {
  const { t } = useLanguage();
  const resolvedOnLabel = onLabel ?? t("onMenu");
  const resolvedOffLabel = offLabel ?? t("hidden");
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const lockedRef = useRef(false);

  useEffect(() => {
    lockedRef.current = false;
    Animated.spring(progress, {
      toValue: visible ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 180,
      velocity: 0.5,
    }).start();
  }, [visible, progress]);

  const thumbX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, THUMB_TRAVEL],
  });

  const trackBg = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.containerBorderSubtle, "rgba(255, 102, 0, 0.85)"],
  });

  const trackBorder = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.containerBorderStrong, colors.primary],
  });

  const frameBg = isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)";
  const frameBorder = isLight ? "rgba(28, 25, 23, 0.06)" : "rgba(255,255,255,0.1)";

  const toggle = () => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    void Haptics.selectionAsync();
    onChange(!visible);
  };

  const toggleControl = (
    <TogglePress onPress={toggle} hitSlop={6} accessibilityRole="button">
      <AnimatedTrack style={{ backgroundColor: trackBg, borderColor: trackBorder }}>
        <AnimatedThumb style={{ transform: [{ translateX: thumbX }] }} />
      </AnimatedTrack>
    </TogglePress>
  );

  if (toggleOnly) {
    return (
      <ToggleOnlyWrap
        accessibilityRole="switch"
        accessibilityState={{ checked: visible }}
        accessibilityLabel={visible ? resolvedOnLabel : resolvedOffLabel}
      >
        {toggleControl}
      </ToggleOnlyWrap>
    );
  }

  return (
    <Frame
      $wide={wide}
      style={{ backgroundColor: frameBg, borderColor: frameBorder }}
      accessibilityRole="switch"
      accessibilityState={{ checked: visible }}
      accessibilityLabel={visible ? resolvedOnLabel : resolvedOffLabel}
    >
      <StatusText $wide={wide} style={{ color: visible ? ON_GREEN : mutedColor }} numberOfLines={1}>
        {visible ? resolvedOnLabel : resolvedOffLabel}
      </StatusText>

      {toggleControl}
    </Frame>
  );
}

const ToggleOnlyWrap = styled.View`
  flex-shrink: 0;
`;

const Frame = styled.View<{ $wide?: boolean }>`
  height: ${FRAME_H}px;
  flex-direction: row;
  align-items: center;
  gap: ${(p) => (p.$wide ? 8 : 6)}px;
  padding: ${(p) => (p.$wide ? "0 8px" : "0 3px 0 8px")};
  border-radius: 999px;
  border-width: 1px;
  flex-shrink: ${(p) => (p.$wide ? 0 : 1)};
  min-width: 0;
  width: ${(p) => (p.$wide ? "100%" : "auto")};
`;

const StatusText = styled.Text<{ $wide?: boolean }>`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: -0.2px;
  flex-shrink: ${(p) => (p.$wide ? 1 : 0)};
  flex: ${(p) => (p.$wide ? 1 : "none")};
  min-width: ${(p) => (p.$wide ? 0 : "auto")};
`;

const TogglePress = styled(Pressable)`
  flex-shrink: 0;
`;

const AnimatedTrack = styled(Animated.View)`
  width: ${TRACK_W}px;
  height: ${TRACK_H}px;
  border-radius: 999px;
  border-width: 1px;
  justify-content: center;
  padding-horizontal: 3px;
`;

const AnimatedThumb = styled(Animated.View)`
  width: ${THUMB}px;
  height: ${THUMB}px;
  border-radius: ${THUMB / 2}px;
  background-color: #fff;
`;
