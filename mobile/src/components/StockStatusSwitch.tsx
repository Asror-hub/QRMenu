import { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/src/context/LanguageContext";

const PAD = 2;
const SLOT = 28;
const THUMB_H = 22;
const SWITCH_H = PAD * 2 + THUMB_H;
const SWITCH_W = PAD * 2 + SLOT * 2;
const FRAME_H = 32;

const GREEN = "#16a34a";
const RED = "#dc2626";

type StockStatusSwitchProps = {
  soldOut: boolean;
  onChange: (next: boolean) => void;
  mutedColor: string;
  isLight?: boolean;
  /** Full-width row: label left, toggle flush right */
  wide?: boolean;
  /** Settings-style row: only the toggle control (label shown by parent) */
  toggleOnly?: boolean;
};

export function StockStatusSwitch({
  soldOut,
  onChange,
  mutedColor,
  isLight = true,
  wide = false,
  toggleOnly = false,
}: StockStatusSwitchProps) {
  const { t } = useLanguage();
  const inStockLabel = t("inStock");
  const soldOutLabel = t("soldOut");
  const stockStatusLabel = t("stockStatus");
  const progress = useRef(new Animated.Value(soldOut ? 1 : 0)).current;
  const lockedRef = useRef(false);

  useEffect(() => {
    lockedRef.current = false;
    Animated.spring(progress, {
      toValue: soldOut ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 180,
      velocity: 0.5,
    }).start();
  }, [soldOut, progress]);

  const thumbX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SLOT],
  });

  const thumbBg = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [GREEN, RED],
  });

  const checkActive = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const banActive = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const checkScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.9],
  });

  const banScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  const frameBg = isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)";
  const frameBorder = isLight ? "rgba(28, 25, 23, 0.06)" : "rgba(255,255,255,0.1)";
  const switchBg = isLight ? "rgba(28, 25, 23, 0.06)" : "rgba(0,0,0,0.25)";

  const select = (next: boolean) => {
    if (next === soldOut || lockedRef.current) return;
    lockedRef.current = true;
    void Haptics.selectionAsync();
    onChange(next);
  };

  const switchControl = (
    <SwitchTrack style={{ backgroundColor: switchBg }}>
      <SwitchInner>
        <Thumb
          style={[
            styles.thumbShadow,
            {
              transform: [{ translateX: thumbX }],
              backgroundColor: thumbBg,
            },
          ]}
        />

        <Slot
          onPress={() => select(false)}
          accessibilityRole="button"
          accessibilityLabel={inStockLabel}
          accessibilityState={{ selected: !soldOut }}
          hitSlop={4}
        >
          <Animated.View style={[styles.iconBox, { transform: [{ scale: checkScale }] }]}>
            <Animated.View style={[styles.iconLayer, { opacity: checkActive }]}>
              <Ionicons name="checkmark-sharp" size={15} color="#fff" />
            </Animated.View>
            <Animated.View style={[styles.iconLayer, { opacity: Animated.subtract(1, checkActive) }]}>
              <Ionicons name="checkmark-sharp" size={15} color={mutedColor} />
            </Animated.View>
          </Animated.View>
        </Slot>

        <Slot
          onPress={() => select(true)}
          accessibilityRole="button"
          accessibilityLabel={soldOutLabel}
          accessibilityState={{ selected: soldOut }}
          hitSlop={4}
        >
          <Animated.View style={[styles.iconBox, { transform: [{ scale: banScale }] }]}>
            <Animated.View style={[styles.iconLayer, { opacity: banActive }]}>
              <Ionicons name="ban" size={13} color="#fff" />
            </Animated.View>
            <Animated.View style={[styles.iconLayer, { opacity: Animated.subtract(1, banActive) }]}>
              <Ionicons name="ban" size={13} color={mutedColor} />
            </Animated.View>
          </Animated.View>
        </Slot>
      </SwitchInner>
    </SwitchTrack>
  );

  if (toggleOnly) {
    return (
      <ToggleOnlyWrap
        accessibilityRole="adjustable"
        accessibilityLabel={stockStatusLabel}
        accessibilityValue={{ text: soldOut ? soldOutLabel : inStockLabel }}
      >
        {switchControl}
      </ToggleOnlyWrap>
    );
  }

  return (
    <Frame
      $wide={wide}
      style={{ backgroundColor: frameBg, borderColor: frameBorder }}
      accessibilityRole="adjustable"
      accessibilityLabel={stockStatusLabel}
      accessibilityValue={{ text: soldOut ? soldOutLabel : inStockLabel }}
    >
      <StatusText $wide={wide} style={{ color: soldOut ? RED : GREEN }} numberOfLines={1}>
        {soldOut ? soldOutLabel : inStockLabel}
      </StatusText>

      {switchControl}
    </Frame>
  );
}

const styles = StyleSheet.create({
  thumbShadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  iconBox: {
    width: SLOT,
    height: THUMB_H,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});

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

const SwitchTrack = styled(View)`
  width: ${SWITCH_W}px;
  height: ${SWITCH_H}px;
  border-radius: ${SWITCH_H / 2}px;
  padding: ${PAD}px;
  flex-shrink: 0;
`;

const SwitchInner = styled.View`
  width: ${SLOT * 2}px;
  height: ${THUMB_H}px;
  flex-direction: row;
  align-items: center;
  position: relative;
`;

const Thumb = styled(Animated.View)`
  position: absolute;
  top: 0;
  left: 0;
  width: ${SLOT}px;
  height: ${THUMB_H}px;
  border-radius: ${THUMB_H / 2}px;
`;

const Slot = styled(Pressable)`
  width: ${SLOT}px;
  height: ${THUMB_H}px;
  align-items: center;
  justify-content: center;
  z-index: 1;
`;
