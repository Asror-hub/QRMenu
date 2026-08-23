import { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";

export type ToastTone = "success" | "muted" | "neutral";

export type ToastPayload = {
  id: number;
  message: string;
  tone?: ToastTone;
};

type StatusToastProps = {
  toast: ToastPayload | null;
  onHide: () => void;
  durationMs?: number;
};

const TONE = {
  success: {
    accent: "#22c55e",
    icon: "checkmark-circle" as const,
  },
  muted: {
    accent: "#fb923c",
    icon: "information-circle" as const,
  },
  neutral: {
    accent: "#ff6600",
    icon: "checkmark-circle" as const,
  },
};

export function StatusToast({
  toast,
  onHide,
  durationMs = 2800,
}: StatusToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  const toastId = toast?.id ?? null;
  const toneStyle = TONE[toast?.tone ?? "neutral"] ?? TONE.neutral;

  useEffect(() => {
    if (toastId == null) {
      opacity.setValue(0);
      translateY.setValue(18);
      scale.setValue(0.94);
      return;
    }

    let cancelled = false;
    opacity.setValue(0);
    translateY.setValue(18);
    scale.setValue(0.94);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 10,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.96,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished || cancelled) return;
        onHideRef.current();
      });
    }, durationMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [toastId, durationMs, opacity, translateY, scale]);

  if (!toast) return null;

  return (
    <ToastWrap pointerEvents="none">
      <ToastCard
        style={[
          styles.shadow,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <IconBadge style={{ backgroundColor: toneStyle.accent }}>
          <Ionicons name={toneStyle.icon} size={18} color="#fff" />
        </IconBadge>
        <ToastText numberOfLines={2}>{toast.message}</ToastText>
      </ToastCard>
    </ToastWrap>
  );
}

const styles = StyleSheet.create({
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
});

const ToastWrap = styled.View`
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 28px;
  align-items: center;
  z-index: 100;
`;

const ToastCard = styled(Animated.View)`
  max-width: 100%;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 14px 18px 14px 14px;
  border-radius: 18px;
  background-color: #1c1917;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.12);
`;

const IconBadge = styled.View`
  width: 32px;
  height: 32px;
  border-radius: 16px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const ToastText = styled.Text`
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.2px;
  line-height: 19px;
  color: #fafaf9;
`;
