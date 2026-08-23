import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useOrders } from "@/src/context/OrdersContext";
import { useFeedbackAlerts } from "@/src/context/FeedbackAlertsContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/services/supabase";
import {
  isRestaurantOpenNow,
  type RestaurantHourRow,
} from "@/src/utils/restaurantHours";
import { hasPlanFeature, type PlanFeature } from "@/src/utils/planFeatures";

const OPERATE_FEATURE: Partial<Record<string, PlanFeature>> = {
  "submit-order": "staffOrders",
  reservations: "reservations",
};

function TabletGlassFill({ isLight }: { isLight: boolean }) {
  return (
    <>
      <BlurView
        pointerEvents="none"
        intensity={isLight ? 58 : 42}
        tint={isLight ? "light" : "dark"}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFillObject}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: isLight
              ? "rgba(255, 255, 255, 0.38)"
              : "rgba(41, 37, 36, 0.42)",
          },
        ]}
      />
      {Platform.OS === "ios" ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: isLight
                ? "rgba(255, 255, 255, 0.7)"
                : "rgba(255, 255, 255, 0.08)",
            },
          ]}
        />
      ) : null}
    </>
  );
}

type NavIconName =
  | "restaurant"
  | "stats-chart"
  | "grid"
  | "calendar"
  | "print"
  | "cart"
  | "settings"
  | "help-circle"
  | "time"
  | "star"
  | "arrow-forward"
  | "ellipse";

type LinkItem = {
  id: string;
  labelKey: string;
  hintKey: string;
  route: string;
  icon: NavIconName;
  ink: string;
};

const OPERATE_ITEMS: LinkItem[] = [
  {
    id: "submit-order",
    labelKey: "tileSubmitOrder",
    hintKey: "tileSubmitOrderHint",
    route: "/(app)/submit-order",
    icon: "cart",
    ink: "#ff6600",
  },
  {
    id: "categories",
    labelKey: "tileMenu",
    hintKey: "tileMenuHint",
    route: "/(app)/categories",
    icon: "restaurant",
    ink: "#ff6600",
  },
  {
    id: "tables",
    labelKey: "tileTables",
    hintKey: "tileTablesHint",
    route: "/(app)/tables",
    icon: "grid",
    ink: "#0284c7",
  },
  {
    id: "reservations",
    labelKey: "tileReserve",
    hintKey: "tileReserveHint",
    route: "/(app)/reservations",
    icon: "calendar",
    ink: "#16a34a",
  },
];

const MANAGE_ITEMS: LinkItem[] = [
  {
    id: "dashboard",
    labelKey: "tileAnalytics",
    hintKey: "tileAnalyticsHint",
    route: "/(app)/dashboard",
    icon: "stats-chart",
    ink: "#ff6600",
  },
  {
    id: "history",
    labelKey: "tileHistory",
    hintKey: "tileHistoryHint",
    route: "/(app)/history",
    icon: "time",
    ink: "#0f766e",
  },
  {
    id: "feedbacks",
    labelKey: "tileFeedbacks",
    hintKey: "tileFeedbacksHint",
    route: "/(app)/feedbacks",
    icon: "star",
    ink: "#f59e0b",
  },
  {
    id: "settings",
    labelKey: "tileSettings",
    hintKey: "tileSettingsHint",
    route: "/(app)/settings",
    icon: "settings",
    ink: "#57534e",
  },
  {
    id: "support",
    labelKey: "tileSupport",
    hintKey: "tileSupportHint",
    route: "/(app)/support",
    icon: "help-circle",
    ink: "#0284c7",
  },
];

function getGreeting(t: (key: string) => string) {
  const hour = new Date().getHours();
  if (hour < 12) return t("greetingMorning");
  if (hour < 18) return t("greetingAfternoon");
  return t("greetingEvening");
}

function getMonogram(name?: string | null) {
  const cleaned = (name ?? "").trim();
  if (!cleaned) return "RR";
  return cleaned.slice(0, 2).toUpperCase();
}

const STAGE_BUTTON_HEIGHT = 148;
const STAR_FEEDBACK = "#f59e0b";

export default function HomeScreen() {
  const router = useRouter();
  const { restaurant } = useRestaurant();
  const { pendingOrdersCount, soundEnabled, toggleSound } = useOrders();
  const { incomingCount: incomingFeedbackCount } = useFeedbackAlerts();
  const { colors, theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= 900;
  const hasPending = pendingOrdersCount > 0;
  const hasIncomingFeedback = incomingFeedbackCount > 0;
  const pad = isTablet ? 24 : 16;
  const isLight = theme === "light";
  const operateItems = useMemo(
    () =>
      OPERATE_ITEMS.filter((item) => {
        const feature = OPERATE_FEATURE[item.id];
        return !feature || hasPlanFeature(restaurant, feature);
      }),
    [restaurant]
  );
  const greeting = useMemo(() => getGreeting(t), [t]);
  const monogram = useMemo(
    () => getMonogram(restaurant?.name),
    [restaurant?.name]
  );
  const pulse = useRef(new Animated.Value(0)).current;
  const nudge = useRef(new Animated.Value(0)).current;
  const feedbackPulse = useRef(new Animated.Value(0)).current;
  const [hours, setHours] = useState<RestaurantHourRow[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadHours = async () => {
      if (!restaurant?.id) {
        setHours([]);
        return;
      }
      const { data } = await supabase
        .from("restaurant_hours")
        .select("day_of_week, open_time, close_time, closed")
        .eq("restaurant_id", restaurant.id);
      if (!cancelled) setHours((data as RestaurantHourRow[]) ?? []);
    };
    loadHours();
    return () => {
      cancelled = true;
    };
  }, [restaurant?.id]);

  const isOpen = useMemo(
    () => isRestaurantOpenNow(hours, now),
    [hours, now]
  );
  const shiftLabel = hasPending
    ? t("needsAttention")
    : isOpen
      ? t("onShift")
      : t("statusClosed");

  useEffect(() => {
    if (!hasPending) {
      pulse.stopAnimation();
      nudge.stopAnimation();
      pulse.setValue(0);
      nudge.setValue(0);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const nudgeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(nudge, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(nudge, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    nudgeLoop.start();
    return () => {
      pulseLoop.stop();
      nudgeLoop.stop();
    };
  }, [hasPending, pulse, nudge]);

  useEffect(() => {
    if (!hasIncomingFeedback) {
      feedbackPulse.stopAnimation();
      feedbackPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(feedbackPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(feedbackPulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [hasIncomingFeedback, feedbackPulse]);

  const handlePress = (route: string) => {
    if (route === "/(app)/settings" && isTablet) {
      router.push("/(app)/settings/profile" as any);
      return;
    }
    router.push(route as any);
  };

  const pageBg = isLight ? (isTablet ? "#ffffff" : "#f5f3f0") : colors.bg;
  const cardBg = isLight ? "#ffffff" : colors.surface;
  const hairline = isLight ? "rgba(28, 25, 23, 0.08)" : colors.containerBorder;
  const silverBorder = isLight ? "rgba(148, 163, 184, 0.45)" : "rgba(168, 162, 158, 0.32)";
  const glassCardStyle = {
    backgroundColor: "transparent" as const,
    borderColor: silverBorder,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    overflow: "hidden" as const,
  };

  const pulseStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 0],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.45],
        }),
      },
    ],
  };

  const pulseFillStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.22, 0],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.22],
        }),
      },
    ],
  };

  const nudgeStyle = {
    transform: [
      {
        translateY: nudge.interpolate({
          inputRange: [0, 1],
          outputRange: [0, hasPending ? -3 : 0],
        }),
      },
      {
        scale: nudge.interpolate({
          inputRange: [0, 1],
          outputRange: [1, hasPending ? 1.012 : 1],
        }),
      },
    ],
  };

  if (isTablet) {
    const tabletPad = Math.max(pad, 28);
    const gridGap = 14;
    const gridCols = 4;
    const shellMax = 1180;
    const shellWidth = Math.min(width - tabletPad * 2, shellMax);
    const cellWidth = (shellWidth - gridGap * (gridCols - 1)) / gridCols;
    const cellHeight = Math.max(148, Math.min(176, cellWidth * 0.92));
    const featuredWidth = cellWidth * 2 + gridGap;
    const operateTiles = operateItems.map((item) => item);
    const tablesIdx = operateTiles.findIndex((item) => item.id === "tables");
    const reserveIdx = operateTiles.findIndex((item) => item.id === "reservations");
    if (tablesIdx >= 0 && reserveIdx >= 0) {
      const temp = operateTiles[tablesIdx];
      operateTiles[tablesIdx] = operateTiles[reserveIdx];
      operateTiles[reserveIdx] = temp;
    }
    const navTiles = [...operateTiles, ...MANAGE_ITEMS];

    return (
      <Container style={{ backgroundColor: pageBg }}>
        <StatusBar style={isLight ? "dark" : "light"} />
        <TabletAtmosphere pointerEvents="none">
          <AtmOrb
            style={{
              top: -120,
              right: -80,
              width: 340,
              height: 340,
              backgroundColor: isLight
                ? "rgba(255, 102, 0, 0.1)"
                : "rgba(255, 102, 0, 0.14)",
            }}
          />
          <AtmOrb
            style={{
              top: 180,
              left: -140,
              width: 420,
              height: 420,
              backgroundColor: isLight
                ? "rgba(148, 163, 184, 0.22)"
                : "rgba(148, 163, 184, 0.12)",
            }}
          />
          <AtmOrb
            style={{
              bottom: 40,
              right: 60,
              width: 280,
              height: 280,
              backgroundColor: isLight
                ? "rgba(255, 102, 0, 0.06)"
                : "rgba(255, 102, 0, 0.1)",
            }}
          />
        </TabletAtmosphere>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 20,
            paddingBottom: Math.max(insets.bottom, 32) + 24,
            paddingHorizontal: tabletPad,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          bounces
        >
          <TabletShell style={{ width: shellWidth, flexGrow: 1 }}>
            <TabletBrand>
              <TabletBrandName style={{ color: colors.text }} numberOfLines={2}>
                {restaurant?.name ?? t("yourRestaurant")}
              </TabletBrandName>

              <TabletHeaderActions>
                <TabletIconBtn
                  onPress={toggleTheme}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel={
                    theme === "dark" ? t("switchToLight") : t("switchToDark")
                  }
                  style={glassCardStyle}
                >
                  <TabletGlassFill isLight={isLight} />
                  <View style={{ zIndex: 1 }}>
                    <Ionicons
                      name={theme === "dark" ? "sunny" : "moon"}
                      size={20}
                      color={colors.text}
                    />
                  </View>
                </TabletIconBtn>
                <TabletIconBtn
                  onPress={() => {
                    void toggleSound();
                  }}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel={
                    soundEnabled ? t("soundOff") : t("soundOn")
                  }
                  style={{
                    ...glassCardStyle,
                    borderColor: soundEnabled
                      ? isLight
                        ? "rgba(255, 102, 0, 0.35)"
                        : "rgba(255, 102, 0, 0.45)"
                      : silverBorder,
                  }}
                >
                  <TabletGlassFill isLight={isLight} />
                  <View style={{ zIndex: 1 }}>
                    <Ionicons
                      name={soundEnabled ? "volume-high" : "volume-mute"}
                      size={20}
                      color={soundEnabled ? colors.sidebarOrange : colors.textMuted}
                    />
                  </View>
                </TabletIconBtn>
              </TabletHeaderActions>
            </TabletBrand>

            <TabletGrid style={{ gap: gridGap }}>
              <Animated.View style={[{ width: featuredWidth, height: cellHeight }, nudgeStyle]}>
                <TabletOrdersCard
                  onPress={() => handlePress("/(app)/orders")}
                  activeOpacity={0.92}
                  style={glassCardStyle}
                >
                  <TabletGlassFill isLight={isLight} />
                  <TabletOrdersCopy style={{ zIndex: 1 }}>
                    <TabletOrdersMeta>
                      <TabletOrdersIcon
                        style={{
                          backgroundColor: isLight
                            ? "rgba(255, 102, 0, 0.12)"
                            : "rgba(255, 102, 0, 0.18)",
                        }}
                      >
                        <Ionicons
                          name="receipt"
                          size={18}
                          color={colors.sidebarOrange}
                        />
                      </TabletOrdersIcon>
                      <TabletOrdersLabel style={{ color: colors.textMuted }}>
                        {t("ordersLabel")}
                      </TabletOrdersLabel>
                    </TabletOrdersMeta>
                    <TabletOrdersTitle style={{ color: colors.text }} numberOfLines={2}>
                      {hasPending ? t("newTicketsWaiting") : t("allCaughtUp")}
                    </TabletOrdersTitle>
                    <TabletOrdersSub style={{ color: colors.textMuted }} numberOfLines={2}>
                      {hasPending
                        ? t("tapToOpenBoard")
                        : t("boardQuiet")}
                    </TabletOrdersSub>
                  </TabletOrdersCopy>

                  <TabletOrdersAside style={{ zIndex: 1 }}>
                    <TabletCountWrap>
                      {hasPending && (
                        <>
                          <CountPing
                            pointerEvents="none"
                            style={{
                              ...pulseStyle,
                              borderColor: colors.sidebarOrange,
                            }}
                          />
                          <CountPingFill
                            pointerEvents="none"
                            style={{
                              ...pulseFillStyle,
                              backgroundColor: "rgba(255, 102, 0, 0.2)",
                            }}
                          />
                        </>
                      )}
                      <TabletCountBadge
                        style={{
                          backgroundColor: isLight
                            ? "rgba(255, 255, 255, 0.55)"
                            : "rgba(41, 37, 36, 0.55)",
                          borderColor: hasPending
                            ? colors.sidebarOrange
                            : "rgba(255, 102, 0, 0.28)",
                          elevation: 0,
                          shadowOpacity: 0,
                          shadowRadius: 0,
                          shadowOffset: { width: 0, height: 0 },
                        }}
                      >
                        <TabletCountValue style={{ color: colors.sidebarOrange }}>
                          {pendingOrdersCount}
                        </TabletCountValue>
                        <TabletCountMeta
                          style={{
                            color: hasPending
                              ? colors.sidebarOrange
                              : "rgba(255, 102, 0, 0.75)",
                          }}
                        >
                          {t("newBadge")}
                        </TabletCountMeta>
                      </TabletCountBadge>
                    </TabletCountWrap>
                    <TabletOrdersCta style={{ backgroundColor: colors.sidebarOrange }}>
                      <TabletOrdersCtaText>{t("openCta")}</TabletOrdersCtaText>
                      <Ionicons name="arrow-forward" size={14} color="#ffffff" />
                    </TabletOrdersCta>
                  </TabletOrdersAside>
                </TabletOrdersCard>
              </Animated.View>

              {navTiles.map((item) => {
                const solidIcon = operateItems.some((op) => op.id === item.id);
                const alert = item.id === "feedbacks" && hasIncomingFeedback;
                const tileOpacity = alert
                  ? feedbackPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.78],
                    })
                  : 1;
                return (
                  <Animated.View
                    key={item.id}
                    style={{
                      width: cellWidth,
                      height: cellHeight,
                      opacity: tileOpacity,
                    }}
                  >
                  <TabletTile
                    onPress={() => handlePress(item.route)}
                    activeOpacity={0.78}
                    style={{
                      flex: 1,
                      ...glassCardStyle,
                      borderColor: alert ? "rgba(245, 158, 11, 0.55)" : glassCardStyle.borderColor,
                    }}
                  >
                    <TabletGlassFill isLight={isLight} />
                    <TabletTileIcon
                      style={{
                        zIndex: 1,
                        backgroundColor: solidIcon
                          ? item.ink
                          : isLight
                            ? `${item.ink}18`
                            : "rgba(255,255,255,0.08)",
                      }}
                    >
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={solidIcon ? "#ffffff" : item.ink}
                      />
                    </TabletTileIcon>
                    <TabletTileCopy style={{ zIndex: 1 }}>
                      <TabletTileLabel style={{ color: colors.text }} numberOfLines={1}>
                        {t(item.labelKey)}
                        {alert ? ` · ${incomingFeedbackCount}` : ""}
                      </TabletTileLabel>
                      <TabletTileHint style={{ color: colors.textMuted }} numberOfLines={2}>
                        {alert ? t("feedbackIncomingHint") : t(item.hintKey)}
                      </TabletTileHint>
                    </TabletTileCopy>
                  </TabletTile>
                  </Animated.View>
                );
              })}
            </TabletGrid>

            <TabletFooter style={{ borderTopColor: silverBorder }}>
              <TabletFooterKicker style={{ color: colors.textMuted }}>
                {greeting}
                {"  ·  "}
                {isOpen ? t("openNow") : t("homeClosed")}
                {hasPending ? `  ·  ${pendingOrdersCount} ${t("newBadge")}` : ""}
              </TabletFooterKicker>
              <TabletFooterTitle style={{ color: colors.text }}>
                {hasPending
                  ? t("ticketsWaitingBoard")
                  : t("everythingHere")}
              </TabletFooterTitle>
              <TabletFooterBody style={{ color: colors.textMuted }}>
                {hasPending
                  ? t("openOrdersHint")
                  : t("tilesHint")}
              </TabletFooterBody>
            </TabletFooter>
          </TabletShell>
        </ScrollView>
      </Container>
    );
  }

  return (
    <Container style={{ backgroundColor: pageBg }}>
      <StatusBar style={isLight ? "dark" : "light"} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: Math.max(insets.bottom, 24) + 16,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        bounces
      >
        <Body>
          <Billboard style={{ minHeight: 132 + insets.top }}>
            <BillboardMark
              pointerEvents="none"
              style={{
                color: isLight ? "rgba(28,25,23,0.07)" : "rgba(255,255,255,0.07)",
                top: Math.max(insets.top * 0.15, 4) + 18,
                right: -6,
              }}
            >
              {monogram}
            </BillboardMark>
            <BillboardCopy
              style={{
                paddingTop: insets.top + 10,
                paddingHorizontal: pad,
              }}
            >
              <BillboardKicker style={{ color: colors.sidebarOrange }}>
                {shiftLabel}
              </BillboardKicker>
              <BillboardGreeting style={{ color: colors.textMuted }}>
                {greeting}
              </BillboardGreeting>
              <BillboardName style={{ color: colors.text }} numberOfLines={3}>
                {restaurant?.name ?? t("yourRestaurant")}
              </BillboardName>
              <BillboardRule style={{ backgroundColor: colors.sidebarOrange }} />
            </BillboardCopy>
          </Billboard>

          <Content style={{ paddingHorizontal: pad }}>
            <Animated.View style={nudgeStyle}>
              <StageButton
                onPress={() => handlePress("/(app)/orders")}
                activeOpacity={0.92}
                style={{
                  backgroundColor: cardBg,
                  borderColor: silverBorder,
                  minHeight: STAGE_BUTTON_HEIGHT,
                  elevation: 0,
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  shadowOffset: { width: 0, height: 0 },
                }}
              >
                <StageCardInner>
                  <StageCardCopy>
                    <StageCardBrandRow>
                      <StageCardIcon
                        style={{
                          backgroundColor: isLight
                            ? "rgba(255, 102, 0, 0.1)"
                            : "rgba(255, 102, 0, 0.16)",
                        }}
                      >
                        <Ionicons
                          name="receipt"
                          size={16}
                          color={colors.sidebarOrange}
                        />
                      </StageCardIcon>
                      <StageCardLabel style={{ color: colors.textMuted }}>
                        {t("ordersLabel")}
                      </StageCardLabel>
                    </StageCardBrandRow>
                    <StageCardTitle style={{ color: colors.text }}>
                      {hasPending ? t("newTicketsWaiting") : t("allCaughtUp")}
                    </StageCardTitle>
                    <StageCardSub style={{ color: colors.textMuted }}>
                      {hasPending ? t("incomingTicketsReady") : t("boardQuietShort")}
                    </StageCardSub>
                  </StageCardCopy>

                  <StageCountWrap>
                    {hasPending && (
                      <>
                        <CountPing
                          pointerEvents="none"
                          style={{
                            ...pulseStyle,
                            borderColor: colors.sidebarOrange,
                          }}
                        />
                        <CountPingFill
                          pointerEvents="none"
                          style={{
                            ...pulseFillStyle,
                            backgroundColor: "rgba(255, 102, 0, 0.2)",
                          }}
                        />
                      </>
                    )}
                    <StageCountBadge
                      style={{
                        backgroundColor: "transparent",
                        borderWidth: 1.5,
                        borderColor: hasPending
                          ? colors.sidebarOrange
                          : "rgba(255, 102, 0, 0.28)",
                        elevation: 0,
                        shadowOpacity: 0,
                        shadowRadius: 0,
                        shadowOffset: { width: 0, height: 0 },
                      }}
                    >
                      <StageCountValue style={{ color: colors.sidebarOrange }}>
                        {pendingOrdersCount}
                      </StageCountValue>
                      <StageCountMeta
                        style={{
                          color: hasPending
                            ? colors.sidebarOrange
                            : "rgba(255, 102, 0, 0.75)",
                        }}
                      >
                        {t("newBadge")}
                      </StageCountMeta>
                    </StageCountBadge>
                  </StageCountWrap>
                </StageCardInner>

                <StageCardBottom>
                  <StageCardCta style={{ backgroundColor: colors.sidebarOrange }}>
                    <StageCardAction style={{ color: "#ffffff" }}>
                      {t("openCta")}
                    </StageCardAction>
                    <StageCardCtaIcon
                      style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
                    >
                      <Ionicons name="arrow-forward" size={14} color="#ffffff" />
                    </StageCardCtaIcon>
                  </StageCardCta>
                </StageCardBottom>
              </StageButton>
            </Animated.View>

            <OperateSection>
              <SectionHeader>
                <SectionTitle style={{ color: colors.text }}>{t("sectionOperate")}</SectionTitle>
              </SectionHeader>
              <OperatePanel style={{ backgroundColor: cardBg, borderColor: hairline }}>
                {operateItems.map((item, index) => (
                  <OperateRow
                    key={item.id}
                    onPress={() => handlePress(item.route)}
                    activeOpacity={0.72}
                    style={{
                      borderBottomWidth: index === operateItems.length - 1 ? 0 : 1,
                      borderBottomColor: hairline,
                    }}
                  >
                    <OperateIcon style={{ backgroundColor: item.ink }}>
                      <Ionicons name={item.icon} size={18} color="#ffffff" />
                    </OperateIcon>
                    <OperateCopy>
                      <OperateLabel style={{ color: colors.text }} numberOfLines={1}>
                        {t(item.labelKey)}
                      </OperateLabel>
                      <OperateHint style={{ color: colors.textMuted }} numberOfLines={2}>
                        {t(item.hintKey)}
                      </OperateHint>
                    </OperateCopy>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.textMuted}
                    />
                  </OperateRow>
                ))}
              </OperatePanel>
            </OperateSection>

            <ManageSection>
              <SectionHeader>
                <SectionTitle style={{ color: colors.text }}>{t("sectionManage")}</SectionTitle>
              </SectionHeader>
              <ManagePanel style={{ backgroundColor: cardBg, borderColor: hairline }}>
                {MANAGE_ITEMS.map((item, index) => {
                  const isFeedbacks = item.id === "feedbacks";
                  const alert = isFeedbacks && hasIncomingFeedback;
                  const rowOpacity = alert
                    ? feedbackPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.72],
                      })
                    : 1;
                  return (
                  <Animated.View
                    key={item.id}
                    style={{ opacity: rowOpacity }}
                  >
                  <ManageRow
                    onPress={() => handlePress(item.route)}
                    activeOpacity={0.72}
                    style={{
                      borderBottomWidth: index === MANAGE_ITEMS.length - 1 ? 0 : 1,
                      borderBottomColor: hairline,
                      backgroundColor: alert
                        ? isLight
                          ? "rgba(245, 158, 11, 0.1)"
                          : "rgba(245, 158, 11, 0.16)"
                        : "transparent",
                    }}
                  >
                    <ManageIcon
                      style={{
                        backgroundColor: isLight
                          ? `${item.ink}18`
                          : "rgba(255,255,255,0.08)",
                      }}
                    >
                      <Ionicons name={item.icon} size={18} color={item.ink} />
                    </ManageIcon>
                    <ManageCopy>
                      <ManageLabel style={{ color: colors.text }}>
                        {t(item.labelKey)}
                        {alert ? `  ·  ${incomingFeedbackCount}` : ""}
                      </ManageLabel>
                      <ManageHint style={{ color: colors.textMuted }}>
                        {alert ? t("feedbackIncomingHint") : t(item.hintKey)}
                      </ManageHint>
                    </ManageCopy>
                    {alert ? (
                      <FeedbackCountPill>
                        <FeedbackCountText>{incomingFeedbackCount}</FeedbackCountText>
                        <Ionicons name="star" size={11} color={STAR_FEEDBACK} />
                      </FeedbackCountPill>
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.textMuted}
                      />
                    )}
                  </ManageRow>
                  </Animated.View>
                  );
                })}
              </ManagePanel>
            </ManageSection>
          </Content>
        </Body>
      </ScrollView>
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
`;

const Billboard = styled.View`
  position: relative;
  padding: 0;
  justify-content: flex-start;
  overflow: hidden;
`;

const BillboardMark = styled.Text`
  position: absolute;
  font-size: 168px;
  font-weight: 800;
  letter-spacing: -10px;
  line-height: 168px;
`;

const BillboardCopy = styled.View``;

const BillboardKicker = styled.Text`
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  margin-bottom: 8px;
`;

const BillboardGreeting = styled.Text`
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 4px;
`;

const BillboardName = styled.Text`
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.9px;
  line-height: 38px;
  max-width: 78%;
`;

const BillboardRule = styled.View`
  width: 36px;
  height: 3px;
  border-radius: 999px;
  margin-top: 14px;
`;

const StageButton = styled.TouchableOpacity`
  position: relative;
  padding: 18px 18px 18px 20px;
  border-radius: 26px;
  border-width: 1.5px;
  overflow: visible;
  z-index: 2;
  gap: 14px;
`;

const StageCardInner = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const StageCardCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 3px;
`;

const StageCardBrandRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const StageCardIcon = styled.View`
  width: 28px;
  height: 28px;
  border-radius: 9px;
  align-items: center;
  justify-content: center;
`;

const StageCardLabel = styled.Text`
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

const StageCardTitle = styled.Text`
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.4px;
  line-height: 28px;
`;

const StageCardSub = styled.Text`
  font-size: 13px;
  font-weight: 500;
  line-height: 17px;
`;

const StageCardBottom = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
`;

const StageCardCta = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 7px 7px 7px 14px;
  border-radius: 999px;
`;

const StageCardAction = styled.Text`
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.1px;
`;

const StageCardCtaIcon = styled.View`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;

const StageCountWrap = styled.View`
  position: relative;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
`;

const CountPing = styled(Animated.View)`
  position: absolute;
  top: 2px;
  right: 2px;
  bottom: 2px;
  left: 2px;
  border-radius: 999px;
  border-width: 2px;
`;

const CountPingFill = styled(Animated.View)`
  position: absolute;
  top: 2px;
  right: 2px;
  bottom: 2px;
  left: 2px;
  border-radius: 999px;
`;

const StageCountBadge = styled.View`
  width: 72px;
  height: 72px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  gap: 1px;
  z-index: 1;
`;

const StageCountValue = styled.Text`
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.8px;
  line-height: 30px;
`;

const StageCountMeta = styled.Text`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  line-height: 12px;
`;

const Body = styled.View`
  gap: 18px;
`;

const Content = styled.View`
  gap: 18px;
`;

const TabletShell = styled.View`
  gap: 28px;
  max-width: 1180px;
  align-self: center;
`;

const TabletFooter = styled.View`
  margin-top: auto;
  padding-top: 28px;
  border-top-width: 1px;
  gap: 8px;
  max-width: 640px;
`;

const TabletFooterKicker = styled.Text`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
`;

const TabletFooterTitle = styled.Text`
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.6px;
  line-height: 34px;
`;

const TabletFooterBody = styled.Text`
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
  max-width: 520px;
`;

const TabletAtmosphere = styled.View`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
`;

const AtmOrb = styled.View`
  position: absolute;
  border-radius: 999px;
`;

const TabletBrand = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
`;

const TabletHeaderActions = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
`;

const TabletIconBtn = styled.TouchableOpacity`
  width: 48px;
  height: 48px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const TabletBrandName = styled.Text`
  flex: 1;
  min-width: 0;
  font-size: 44px;
  font-weight: 800;
  letter-spacing: -1.2px;
  line-height: 48px;
`;

const TabletGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
`;

const TabletOrdersCard = styled.TouchableOpacity`
  flex: 1;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 24px;
  border-radius: 28px;
  border-width: 1.5px;
  overflow: hidden;
`;

const TabletOrdersMeta = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
`;

const TabletOrdersIcon = styled.View`
  width: 36px;
  height: 36px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
`;

const TabletOrdersLabel = styled.Text`
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
`;

const TabletOrdersCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 8px;
  justify-content: center;
`;

const TabletOrdersTitle = styled.Text`
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.6px;
  line-height: 30px;
`;

const TabletOrdersSub = styled.Text`
  font-size: 14px;
  font-weight: 500;
  line-height: 18px;
`;

const TabletOrdersAside = styled.View`
  align-items: center;
  justify-content: center;
  gap: 12px;
`;

const TabletCountWrap = styled.View`
  position: relative;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
`;

const TabletCountBadge = styled.View`
  width: 78px;
  height: 78px;
  border-radius: 999px;
  border-width: 1.5px;
  align-items: center;
  justify-content: center;
  gap: 2px;
  z-index: 1;
  background-color: transparent;
`;

const TabletCountValue = styled.Text`
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -1px;
  line-height: 32px;
`;

const TabletCountMeta = styled.Text`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  line-height: 12px;
`;

const TabletOrdersCta = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
`;

const TabletOrdersCtaText = styled.Text`
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.1px;
  color: #ffffff;
`;

const TabletTile = styled.TouchableOpacity`
  padding: 18px 16px;
  border-radius: 24px;
  border-width: 1px;
  gap: 14px;
  justify-content: space-between;
  overflow: hidden;
`;

const TabletTileIcon = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 16px;
  align-items: center;
  justify-content: center;
`;

const TabletTileCopy = styled.View`
  gap: 4px;
`;

const TabletTileLabel = styled.Text`
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const TabletTileHint = styled.Text`
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
`;

const OperateSection = styled.View`
  gap: 12px;
`;

const OperatePanel = styled.View`
  border-radius: 24px;
  border-width: 1px;
  overflow: hidden;
`;

const OperateRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  min-height: 72px;
`;

const OperateIcon = styled.View`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
`;

const OperateCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 2px;
`;

const OperateLabel = styled.Text`
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.15px;
`;

const OperateHint = styled.Text`
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
`;

const SectionHeader = styled.View`
  padding-horizontal: 4px;
`;

const SectionTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const ManageSection = styled.View`
  gap: 12px;
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
  letter-spacing: -0.15px;
`;

const ManageHint = styled.Text`
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
`;

const FeedbackCountPill = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 10px;
  background-color: rgba(245, 158, 11, 0.18);
`;

const FeedbackCountText = styled.Text`
  font-size: 13px;
  font-weight: 800;
  color: #b45309;
`;
