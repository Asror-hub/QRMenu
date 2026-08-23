import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import styled from "styled-components/native";
import { supabase } from "@/src/services/supabase";
import { useOrders, type Order, type OrderItem } from "@/src/context/OrdersContext";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCurrency } from "@/src/utils/currency";

const FILTERS = [
  { id: "pending", labelKey: "ordersFilterNew", status: "pending", ink: "#ff6600" },
  { id: "accepted", labelKey: "ordersFilterInProgress", status: "accepted", ink: "#0284c7" },
  { id: "ready", labelKey: "ordersFilterReady", status: "ready", ink: "#16a34a" },
  { id: "finish", labelKey: "ordersFilterFinished", status: "finish", ink: "#78716c" },
];

const ORDER_STATUS_COLORS: Record<
  string,
  { base: string; soft: string; ring: string }
> = {
  pending: { base: "#ea580c", soft: "rgba(234, 88, 12, 0.1)", ring: "rgba(234, 88, 12, 0.34)" },
  accepted: { base: "#2563eb", soft: "rgba(37, 99, 235, 0.1)", ring: "rgba(37, 99, 235, 0.32)" },
  ready: { base: "#0d9488", soft: "rgba(13, 148, 136, 0.1)", ring: "rgba(13, 148, 136, 0.32)" },
  finish: { base: "#16a34a", soft: "rgba(22, 163, 74, 0.1)", ring: "rgba(22, 163, 74, 0.3)" },
};

const getStatusColor = (status: string) =>
  ORDER_STATUS_COLORS[status] ?? ORDER_STATUS_COLORS.pending;

function formatOrderLogTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isWaiterCallOrder(order: Order): boolean {
  return (order.items ?? []).some((item: OrderItem & { type?: string }) => item?.type === "waiter_call");
}

/** Incoming Orders screen is for QR/online orders (+ waiter calls), not waiter-submitted POS carts. */
function isStaffSubmittedOrder(order: Order): boolean {
  return order.source === "staff" && !isWaiterCallOrder(order);
}

function getSidebarOrderLabel(
  order: Order,
  translate: (key: string, vars?: Record<string, string | number | null | undefined>) => string
) {
  return isWaiterCallOrder(order)
    ? translate("ordersWaiterRequest")
    : translate("ordersOrderNum", { n: order.order_number ?? "---" });
}

function DropdownChevron({ open, color }: { open: boolean; color: string }) {
  const spin = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(spin, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, spin]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: spin.interpolate({
              inputRange: [0, 1],
              outputRange: ["-90deg", "0deg"],
            }),
          },
        ],
      }}
    >
      <Ionicons name="chevron-down" size={18} color={color} />
    </Animated.View>
  );
}

function AnimatedCollapse({
  expanded,
  children,
}: {
  expanded: boolean;
  children: ReactNode;
}) {
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [expanded, progress]);

  const targetHeight = contentHeight > 0 ? contentHeight : 2400;

  return (
    <Animated.View
      pointerEvents={expanded ? "auto" : "none"}
      style={{
        maxHeight: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, targetHeight],
        }),
        opacity: progress.interpolate({
          inputRange: [0, 0.25, 1],
          outputRange: [0, 0.7, 1],
        }),
        overflow: "hidden",
      }}
    >
      <View
        onLayout={(e) => {
          const next = Math.ceil(e.nativeEvent.layout.height);
          if (next > 0 && Math.abs(next - contentHeight) > 1) {
            setContentHeight(next);
          }
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

function OrderRevealRow({
  index,
  active,
  children,
}: {
  index: number;
  active: boolean;
  children: ReactNode;
}) {
  const anim = useRef(new Animated.Value(active ? 0 : 1)).current;

  useEffect(() => {
    if (!active) {
      anim.setValue(0);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      delay: Math.min(index * 45, 225),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, anim, index]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

const ACTION_SWIPE_MS = 1100;

type AnimatedStatusButtonProps = {
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "primary" | "danger";
  borderColor?: string;
  children: ReactNode;
};

function AnimatedStatusButton({
  onPress,
  disabled,
  variant = "primary",
  borderColor,
  children,
}: AnimatedStatusButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const [btnWidth, setBtnWidth] = useState(0);
  const [sweeping, setSweeping] = useState(false);
  const busyRef = useRef(false);

  const isDanger = variant === "danger";
  const fillColor = isDanger ? "#dc2626" : "#ff6600";
  const baseBg = isDanger ? "rgba(239, 68, 68, 0.14)" : "rgba(255, 102, 0, 0.22)";
  const outline = borderColor ?? (isDanger ? "rgba(220, 38, 38, 0.35)" : "rgba(255, 102, 0, 0.55)");

  const animateScale = (toValue: number, tension = 280, friction = 18) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      tension,
      friction,
    }).start();
  };

  const handlePressIn = () => {
    if (disabled || busyRef.current) return;
    animateScale(0.97, 420, 22);
  };

  const handlePressOut = () => {
    if (busyRef.current) return;
    animateScale(1);
  };

  const handlePress = async () => {
    if (disabled || busyRef.current) return;
    busyRef.current = true;
    setSweeping(true);
    sweep.setValue(0);

    await new Promise<void>((resolve) => {
      Animated.parallel([
        Animated.timing(sweep, {
          toValue: 1,
          duration: ACTION_SWIPE_MS,
          easing: Easing.bezier(0.33, 1, 0.32, 1),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 0.97,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 180,
            friction: 9,
          }),
        ]),
      ]).start(({ finished }) => {
        if (finished) resolve();
        else resolve();
      });
    });

    try {
      await onPress();
    } finally {
      busyRef.current = false;
      setSweeping(false);
      sweep.setValue(0);
      animateScale(1);
    }
  };

  const sweepX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(btnWidth, 1) * 1.05],
  });

  return (
    <Animated.View
      style={{ flex: 1, transform: [{ scale }] }}
      onLayout={(e) => setBtnWidth(e.nativeEvent.layout.width)}
    >
      <ActionBtnShell
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || sweeping}
        activeOpacity={1}
        style={{
          backgroundColor: baseBg,
          borderColor: outline,
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: fillColor,
              transform: [{ translateX: sweepX }],
            },
          ]}
        />
        <ActionBtnContent pointerEvents="none">
          {sweeping ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            children
          )}
        </ActionBtnContent>
      </ActionBtnShell>
    </Animated.View>
  );
}

type PrepTimerCircleProps = {
  order: Order;
  prepTimeMins: number;
  colors: { text: string; textMuted: string };
};

function PrepTimerCircle({ order, prepTimeMins, colors }: PrepTimerCircleProps) {
  const { t } = useLanguage();
  // Use created_at so the countdown matches the configured prep time from order placement
  // (same clock as the customer QR status screen).
  const startIso = order.created_at ?? order.accepted_at ?? null;
  const [display, setDisplay] = useState({ text: "—", isOvertime: false, isOver15: false });

  useEffect(() => {
    if (!startIso || prepTimeMins == null || prepTimeMins < 0) {
      setDisplay({ text: "—", isOvertime: false, isOver15: false });
      return;
    }
    const tick = () => {
      const start = new Date(startIso).getTime();
      const target = start + prepTimeMins * 60 * 1000;
      const now = Date.now();
      const secsLeft = Math.floor((target - now) / 1000);

      if (secsLeft > 0) {
        const totalMins = Math.floor(secsLeft / 60);
        if (totalMins >= 60) {
          const h = Math.floor(totalMins / 60);
          const m = totalMins % 60;
          setDisplay({ text: `${h}:${m.toString().padStart(2, "0")}`, isOvertime: false, isOver15: false });
        } else {
          const s = secsLeft % 60;
          setDisplay({ text: `${totalMins}:${s.toString().padStart(2, "0")}`, isOvertime: false, isOver15: false });
        }
      } else {
        const overtimeSecs = Math.abs(secsLeft);
        const totalMins = Math.floor(overtimeSecs / 60);
        if (totalMins >= 60) {
          const h = Math.floor(totalMins / 60);
          const m = totalMins % 60;
          const isOver15 = totalMins >= 15;
          setDisplay({ text: `${h}:${m.toString().padStart(2, "0")}`, isOvertime: true, isOver15 });
        } else {
          const s = overtimeSecs % 60;
          const isOver15 = totalMins >= 15;
          setDisplay({ text: `${totalMins}:${s.toString().padStart(2, "0")}`, isOvertime: true, isOver15 });
        }
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startIso, prepTimeMins]);

  if (order.status === "ready") {
    return (
      <TimerCircleWrapper style={{ borderColor: "#22c55e", borderStyle: "solid", backgroundColor: "transparent" }}>
        <TimerCircleText style={{ color: "#22c55e", fontSize: 11 }}>
          {t("ordersFilterReady")}
        </TimerCircleText>
      </TimerCircleWrapper>
    );
  }

  if (order.status === "finish") {
    return (
      <ReadyIndicatorWrap>
        <ReadyCircleOuter>
          <ReadyCircle>
            <TickIconWrap>
              <Ionicons name="checkmark" size={34} color="#22c55e" />
            </TickIconWrap>
          </ReadyCircle>
        </ReadyCircleOuter>
        <FinishedLabel>{t("ordersFilterFinished")}</FinishedLabel>
      </ReadyIndicatorWrap>
    );
  }

  const borderColor = display.isOvertime ? "#f97316" : "#22c55e";
  const borderStyle = display.isOvertime ? "dotted" : "solid";
  const backgroundColor = display.isOvertime ? "rgba(249,115,22,0.15)" : "transparent";
  const numberColor = display.isOver15 ? "#ef4444" : display.isOvertime ? "#f97316" : colors.text;

  return (
    <TimerCircleWrapper style={{ borderColor, borderStyle, backgroundColor }}>
      <TimerCircleText style={{ color: numberColor }}>{display.text}</TimerCircleText>
    </TimerCircleWrapper>
  );
}

export default function Orders() {
  const { orders, loadOrders, soundEnabled, toggleSound, updateStatus, orderStatusChannelRef } = useOrders();
  const { restaurant, updateRestaurant } = useRestaurant();
  const { t } = useLanguage();
  const currency = restaurant?.currency ?? "USD";
  const { colors, theme } = useTheme();
  const isLight = theme === "light";
  const prepTimeMins = Number(restaurant?.prep_time) || 15;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;
  /** Keep a snapshot in state, not `orders.find(id)` — derived-only visibility closes the modal on every `orders` refresh. */
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const autoAcceptEnabled = !!restaurant?.auto_accept;
  const [refreshing, setRefreshing] = useState(false);
  const [orderLogsExpanded, setOrderLogsExpanded] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({
    pending: true,
    accepted: true,
    ready: true,
    finish: false,
  });
  const [, forceRender] = useState(0);
  const prevOrderIdsRef = useRef(new Set<string>());
  const hasLoadedRef = useRef(false);
  const mountTimestampRef = useRef(Date.now());
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const screenOrders = useMemo(
    () => orders.filter((order) => !isStaffSubmittedOrder(order)),
    [orders]
  );
  const highlightMapRef = useRef<
    Map<
      string,
      {
        value: Animated.Value;
        animation: Animated.CompositeAnimation;
      }
    >
  >(new Map());

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const toggleAutoAccept = async () => {
    if (!restaurant?.id) return;
    const next = !autoAcceptEnabled;
    const { data, error } = await supabase
      .from("restaurants")
      .update({ auto_accept: next })
      .eq("id", restaurant.id)
      .select("*")
      .single();
    if (error) return;
    updateRestaurant(data);
  };

  useEffect(
    () => () => {
      highlightMapRef.current.forEach((entry) => entry.animation.stop());
      highlightMapRef.current.clear();
    },
    []
  );

  useEffect(() => {
    const checkAutoStatus = async () => {
      const list = ordersRef.current;
      const targetMs = prepTimeMins * 60 * 1000;
      const twelveHours = 12 * 60 * 60 * 1000;
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const now = Date.now();
      let didUpdate = false;

      for (const order of list) {
        const startIso = order.accepted_at ?? order.created_at ?? null;
        if (!startIso) continue;
        const start = new Date(startIso).getTime();
        const target = start + targetMs;
        const overtimeMs = now - target;

        if (overtimeMs >= twentyFourHours) {
          // Soft-archive so analytics charts keep historical order/revenue data.
          await supabase
            .from("orders")
            .update({
              archived_at: new Date().toISOString(),
              ...(order.status !== "finish"
                ? { status: "finish", finished_at: order.finished_at ?? new Date().toISOString() }
                : {}),
            })
            .eq("id", order.id);
          setSelectedOrder((o) => (o && String(o.id) === String(order.id) ? null : o));
          didUpdate = true;
        } else if (overtimeMs >= twelveHours && order.status !== "finish") {
          await updateStatus(order.id, order.table_id, "finish");
          didUpdate = true;
        }
      }
      if (didUpdate) await loadOrders();
    };
    checkAutoStatus();
    const id = setInterval(checkAutoStatus, 60_000);
    return () => clearInterval(id);
  }, [prepTimeMins, loadOrders, updateStatus]);

  useEffect(() => {
    if (orders.length === 0) {
      return;
    }
    setSelectedOrder((current) => {
      if (!current?.id) return current;
      const next = orders.find((o) => String(o.id) === String(current.id));
      if (next) {
        if (isStaffSubmittedOrder(next)) return null;
        return next;
      }
      // Do not null out here — brief misses or RLS hiccups were closing the sheet in a loop.
      return current;
    });
  }, [orders]);

  useEffect(() => {
    if (!isTablet) return;
    if (selectedOrder) return;
    if (!screenOrders.length) return;
    setSelectedOrder(screenOrders[0] ?? null);
  }, [isTablet, screenOrders, selectedOrder]);

  useEffect(() => {
    if (!autoAcceptEnabled) return;
    const pendingOrders = orders.filter(
      (order) =>
        order.status === "pending" &&
        !isWaiterCallOrder(order) &&
        !isStaffSubmittedOrder(order)
    );
    if (!pendingOrders.length) return;

    let cancelled = false;
    const run = async () => {
      for (const order of pendingOrders) {
        if (cancelled) break;
        await updateStatus(order.id, order.table_id, "accepted");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [orders, autoAcceptEnabled, updateStatus]);

  useEffect(() => {
    const nextIds = new Set(orders.map((o) => o.id));
    const pendingIds = new Set(
      orders.filter((o) => o.status === "pending" && !isStaffSubmittedOrder(o)).map((o) => o.id)
    );
    let highlightsMutated = false;

    const addHighlightForOrder = (order: Order) => {
      const map = highlightMapRef.current;
      if (!map.has(order.id)) {
        const value = new Animated.Value(0);
        const animation = Animated.loop(
          Animated.sequence([
            Animated.timing(value, { toValue: 1, duration: 450, useNativeDriver: false }),
            Animated.timing(value, { toValue: 0, duration: 650, useNativeDriver: false }),
          ])
        );
        map.set(order.id, { value, animation });
        value.setValue(0);
        animation.start();
        highlightsMutated = true;
      }
    };

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      prevOrderIdsRef.current = nextIds;
      orders.filter((o) => o.status === "pending" && !isStaffSubmittedOrder(o)).forEach(addHighlightForOrder);
    } else {
      const newOrders = orders.filter((o) => !prevOrderIdsRef.current.has(o.id));
      const isPastGracePeriod = Date.now() - mountTimestampRef.current > 3000;
      const pendingNewOrders = isPastGracePeriod
        ? newOrders.filter((o) => o.status === "pending" && !isStaffSubmittedOrder(o))
        : [];
      pendingNewOrders.forEach(addHighlightForOrder);
    }

    highlightMapRef.current.forEach((entry, orderId) => {
      if (!pendingIds.has(orderId)) {
        entry.animation.stop();
        highlightMapRef.current.delete(orderId);
        highlightsMutated = true;
      }
    });
    if (highlightsMutated) {
      forceRender((v) => v + 1);
    }
    highlightMapRef.current.forEach((entry, orderId) => {
      if (!nextIds.has(orderId)) {
        entry.animation.stop();
        highlightMapRef.current.delete(orderId);
      }
    });
    prevOrderIdsRef.current = nextIds;
  }, [orders]);

  const deleteOrder = async (id: string) => {
    const order = orders.find((o) => String(o.id) === String(id));
    const now = new Date().toISOString();
    // Soft-archive instead of hard delete so analytics history is preserved.
    await supabase
      .from("orders")
      .update({
        archived_at: now,
        ...(order && order.status !== "finish"
          ? { status: "finish", finished_at: order.finished_at ?? now }
          : {}),
      })
      .eq("id", id);
    loadOrders();
    setSelectedOrder(null);
  };

  const getOrderTotal = (items: OrderItem[] = []) =>
    items.reduce(
      (sum, item) =>
        sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );

  const ordersByStatus = useMemo(
    () =>
      FILTERS.reduce(
        (acc, f) => {
          acc[f.status] = screenOrders.filter((o) => o.status === f.status);
          return acc;
        },
        {} as Record<string, Order[]>
      ),
    [screenOrders]
  );

  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("ordersTitle"),
      headerTitle: t("ordersTitle"),
      headerRight: () => (
        <HeaderControls>
          <TogglePill
            onPress={toggleAutoAccept}
            style={{
              borderColor: autoAcceptEnabled
                ? colors.primary
                : isLight
                  ? "rgba(28, 25, 23, 0.1)"
                  : colors.containerBorderSubtle,
              backgroundColor: autoAcceptEnabled
                ? colors.primaryMuted
                : isLight
                  ? colors.surface
                  : colors.buttonOverlay,
            }}
          >
            <ToggleTrack
              style={{
                borderColor: autoAcceptEnabled
                  ? colors.primary
                  : isLight
                    ? "rgba(28, 25, 23, 0.12)"
                    : colors.containerBorderSubtle,
              }}
            >
              <ToggleThumb
                style={{
                  transform: [{ translateX: autoAcceptEnabled ? 14 : 0 }],
                  backgroundColor: autoAcceptEnabled ? colors.primary : colors.surface,
                  borderColor: autoAcceptEnabled
                    ? colors.primary
                    : isLight
                      ? "rgba(28, 25, 23, 0.12)"
                      : colors.containerBorderSubtle,
                }}
              />
            </ToggleTrack>
            <ToggleLabel style={{ color: colors.text }}>Auto Accept</ToggleLabel>
          </TogglePill>

          <TogglePill
            onPress={toggleSound}
            style={{
              marginRight: 16,
              borderColor: soundEnabled
                ? colors.primary
                : isLight
                  ? "rgba(28, 25, 23, 0.1)"
                  : colors.containerBorderSubtle,
              backgroundColor: soundEnabled
                ? colors.primaryMuted
                : isLight
                  ? colors.surface
                  : colors.buttonOverlay,
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ToggleTrack
              style={{
                borderColor: soundEnabled
                  ? colors.primary
                  : isLight
                    ? "rgba(28, 25, 23, 0.12)"
                    : colors.containerBorderSubtle,
              }}
            >
              <ToggleThumb
                style={{
                  transform: [{ translateX: soundEnabled ? 14 : 0 }],
                  backgroundColor: soundEnabled ? colors.primary : colors.surface,
                  borderColor: soundEnabled
                    ? colors.primary
                    : isLight
                      ? "rgba(28, 25, 23, 0.12)"
                      : colors.containerBorderSubtle,
                }}
              />
            </ToggleTrack>
            <ToggleIconWrap>
              <Ionicons
                name={soundEnabled ? "volume-high" : "volume-mute"}
                size={18}
                color={soundEnabled ? colors.primary : colors.textMuted}
              />
            </ToggleIconWrap>
          </TogglePill>
        </HeaderControls>
      ),
    });
  }, [
    navigation,
    soundEnabled,
    colors.text,
    colors.primary,
    colors.containerBorderSubtle,
    colors.buttonOverlay,
    colors.primaryMuted,
    colors.surface,
    colors.textMuted,
    autoAcceptEnabled,
    t,
  ]);

  const formatTableLabel = (order: Order) => {
    const name = order.tables?.table_name;
    const number = order.tables?.table_number;
    if (name && number) return `${name} ${number}`;
    if (name) return name;
    if (number) return `Table ${number}`;
    return `Table ${order.table_id ?? "---"}`;
  };

  const ordersListBlock = (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: isTablet ? 4 : 12,
        paddingBottom: isTablet ? Math.max(insets.bottom, 16) + 12 : Math.max(insets.bottom, 24) + 16,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <TwoCol $tablet={isTablet}>
        <OrderList $tablet={isTablet}>
          {FILTERS.map((filter) => {
            const hairline = isLight
              ? "rgba(148, 163, 184, 0.32)"
              : "rgba(168, 162, 158, 0.28)";
            const rowRule = isLight
              ? "rgba(28, 25, 23, 0.06)"
              : "rgba(255,255,255,0.08)";
            const list = ordersByStatus[filter.status] ?? [];
            const isOpen = expandedFilters[filter.status] ?? true;
            const isPending = filter.status === "pending";

            return (
              <BoardPanel
                key={filter.id}
                style={{
                  backgroundColor: colors.surface,
                  borderColor:
                    isPending && list.length > 0 && isLight
                      ? "rgba(255, 102, 0, 0.18)"
                      : hairline,
                }}
              >
                <DropdownHeader
                  onPress={() => {
                    setExpandedFilters((prev) => ({
                      ...prev,
                      [filter.status]: !isOpen,
                    }));
                  }}
                  activeOpacity={0.75}
                  style={{
                    borderBottomWidth: isOpen ? 1 : 0,
                    borderBottomColor: rowRule,
                  }}
                >
                  <DropdownHeaderLeft>
                    <DropdownTitle style={{ color: colors.text }}>
                      {t(filter.labelKey)}
                    </DropdownTitle>
                  </DropdownHeaderLeft>
                  <DropdownChevron open={isOpen} color={colors.textMuted} />
                </DropdownHeader>

                <AnimatedCollapse expanded={isOpen}>
                  {list.length === 0 ? (
                    <EmptyHint style={{ color: colors.textMuted }}>
                      {t("ordersEmptyBucket")}
                    </EmptyHint>
                  ) : (
                    <OrderCardsList>
                      {list.map((order, orderIndex) => {
                        const isSelected =
                          String(selectedOrder?.id) === String(order.id);
                        const isWaiterRequest = isWaiterCallOrder(order);
                        const statusColors = getStatusColor(filter.status);
                        const highlightEntry = highlightMapRef.current.get(order.id);
                        const highlightAnim = highlightEntry?.value ?? null;
                        const accentColor = isWaiterRequest
                          ? "#0ea5e9"
                          : isSelected
                            ? isLight
                              ? statusColors.base
                              : "#ff6600"
                            : highlightAnim
                              ? "#ea580c"
                              : isLight
                                ? statusColors.base
                                : filter.status === "pending"
                                  ? "#f97316"
                                  : "rgba(255,102,0,0.28)";

                        const idleBg = isWaiterRequest
                          ? isLight
                            ? "rgba(14, 165, 233, 0.1)"
                            : "rgba(14, 165, 233, 0.16)"
                          : isSelected
                            ? isLight
                              ? statusColors.soft
                              : "rgba(255,102,0,0.12)"
                            : colors.surface;

                        const highlightColor = isWaiterRequest
                          ? "rgba(14, 165, 233, 0.22)"
                          : isLight
                            ? "rgba(255,102,0,0.14)"
                            : "rgba(255,102,0,0.22)";

                        const animatedBackground = highlightAnim
                          ? highlightAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [idleBg, highlightColor],
                            })
                          : idleBg;

                        const cardBorder = isLight
                          ? "rgba(148, 163, 184, 0.32)"
                          : "rgba(168, 162, 158, 0.28)";

                        return (
                          <OrderRevealRow
                            key={order.id}
                            index={orderIndex}
                            active={isOpen}
                          >
                            <AnimatedOrderWrapper
                              style={{
                                backgroundColor: animatedBackground,
                                borderColor: isSelected
                                  ? isWaiterRequest
                                    ? "rgba(14, 165, 233, 0.42)"
                                    : statusColors.ring
                                  : cardBorder,
                                borderLeftWidth: isLight ? 3 : 4,
                                borderLeftColor: accentColor,
                                transform: [
                                  {
                                    scale: highlightAnim
                                      ? highlightAnim.interpolate({
                                          inputRange: [0, 1],
                                          outputRange: [1, 1.01],
                                        })
                                      : 1,
                                  },
                                ],
                              }}
                            >
                              <OrderBtn
                                onPress={() => {
                                  const o = order;
                                  requestAnimationFrame(() => setSelectedOrder(o));
                                }}
                                activeOpacity={0.78}
                              >
                                <OrderBtnCopy>
                                  <OrderBtnLabel
                                    style={{ color: colors.text }}
                                    numberOfLines={1}
                                  >
                                    {formatTableLabel(order)}
                                  </OrderBtnLabel>
                                  <OrderMetaRow>
                                    <OrderBtnMeta
                                      style={{ color: colors.text, opacity: 0.9 }}
                                      numberOfLines={1}
                                    >
                                      {getSidebarOrderLabel(order, t)}
                                    </OrderBtnMeta>
                                    {!isWaiterRequest ? (
                                      <OrderBtnTotal style={{ color: colors.text, opacity: 0.9 }}>
                                        {formatCurrency(getOrderTotal(order.items), currency)}
                                      </OrderBtnTotal>
                                    ) : null}
                                  </OrderMetaRow>
                                </OrderBtnCopy>
                                <PrepTimerCircle
                                  order={order}
                                  prepTimeMins={prepTimeMins}
                                  colors={colors}
                                />
                              </OrderBtn>
                            </AnimatedOrderWrapper>
                          </OrderRevealRow>
                        );
                      })}
                    </OrderCardsList>
                  )}
                </AnimatedCollapse>
              </BoardPanel>
            );
          })}
        </OrderList>
      </TwoCol>
    </ScrollView>
  );

  const hairline = isLight
    ? "rgba(148, 163, 184, 0.32)"
    : "rgba(168, 162, 158, 0.28)";
  const rowRule = isLight
    ? "rgba(28, 25, 23, 0.06)"
    : "rgba(255,255,255,0.08)";

  const renderOrderDetails = (order: Order) => {
    const statusMeta = FILTERS.find((f) => f.status === order.status);
    const items = order.items ?? [];

    return (
      <DetailsContent>
        <DetailCard
          style={{
            backgroundColor: colors.surface,
            borderColor: hairline,
          }}
        >
          <DetailHero>
            <TableLabel style={{ color: colors.text }} numberOfLines={2}>
              {formatTableLabel(order)}
            </TableLabel>
            <DetailMetaRow>
              <OrderIdPill
                style={{
                  backgroundColor: isLight
                    ? "rgba(28, 25, 23, 0.05)"
                    : "rgba(255,255,255,0.08)",
                }}
              >
                <OrderIdText style={{ color: colors.textMuted }}>
                  #{order.order_number ?? "—"}
                </OrderIdText>
              </OrderIdPill>
              {statusMeta && (
                <StatusPill
                  style={{
                    backgroundColor: isLight
                      ? `${statusMeta.ink}14`
                      : `${statusMeta.ink}22`,
                  }}
                >
                  <StatusPillText style={{ color: statusMeta.ink }}>
                    {t(statusMeta.labelKey)}
                  </StatusPillText>
                </StatusPill>
              )}
            </DetailMetaRow>
          </DetailHero>

          {!!order.comment && (
            <CommentBlock
              style={{
                backgroundColor: isLight
                  ? "rgba(28, 25, 23, 0.03)"
                  : colors.surface2,
                borderColor: hairline,
              }}
            >
              <CommentLabel style={{ color: colors.textMuted }}>{t("note")}</CommentLabel>
              <CommentText style={{ color: colors.text }}>{order.comment}</CommentText>
            </CommentBlock>
          )}

          <ItemsList style={{ borderColor: hairline }}>
            {items.length === 0 ? (
              <EmptyHint style={{ color: colors.textMuted, paddingVertical: 12 }}>
                {t("ordersNoItems")}
              </EmptyHint>
            ) : (
              items.map((item, idx) => {
                const price = Number(item.price || 0);
                const qty = Number(item.quantity || 0);
                return (
                  <View key={`${order.id}-item-${idx}`}>
                    {idx > 0 && (
                      <DividerLine style={{ backgroundColor: rowRule }} />
                    )}
                    <ItemRow>
                      <QtyBadge
                        style={{
                          backgroundColor: "transparent",
                          borderColor: "#ff944d",
                        }}
                      >
                        <QtyBadgeText style={{ color: "#ff944d" }}>
                          ×{qty}
                        </QtyBadgeText>
                      </QtyBadge>
                      <ItemNameText style={{ color: colors.text }} numberOfLines={3}>
                        {item.name}
                      </ItemNameText>
                      <LineTotal style={{ color: colors.text }}>
                        {formatCurrency(price * qty, currency)}
                      </LineTotal>
                    </ItemRow>
                  </View>
                );
              })
            )}
          </ItemsList>

          <OrderTotal style={{ borderTopColor: rowRule }}>
            <OrderTotalLabel style={{ color: colors.textMuted }}>{t("total")}</OrderTotalLabel>
            <OrderTotalValue style={{ color: colors.text }}>
              {formatCurrency(getOrderTotal(order.items), currency)}
            </OrderTotalValue>
          </OrderTotal>
        </DetailCard>

        {order.status !== "pending" && (
          <OrderLogsBlock
            style={{
              backgroundColor: colors.surface,
              borderColor: hairline,
            }}
          >
            <OrderLogsHeader
              onPress={() => setOrderLogsExpanded((e) => !e)}
              activeOpacity={0.75}
            >
              <OrderLogsTitle style={{ color: colors.text }}>Order logs</OrderLogsTitle>
              <Ionicons
                name={orderLogsExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textMuted}
              />
            </OrderLogsHeader>
            {orderLogsExpanded && (
              <OrderLogsContent>
                <OrderLogRow style={{ borderBottomColor: rowRule }}>
                  <OrderLogLabel style={{ color: colors.textMuted }}>Entered</OrderLogLabel>
                  <OrderLogTime style={{ color: colors.text }}>
                    {formatOrderLogTime(order.created_at)}
                  </OrderLogTime>
                </OrderLogRow>
                {(order.status === "accepted" ||
                  order.status === "ready" ||
                  order.status === "finish") && (
                  <OrderLogRow style={{ borderBottomColor: rowRule }}>
                    <OrderLogLabel style={{ color: colors.textMuted }}>Accepted</OrderLogLabel>
                    <OrderLogTime style={{ color: colors.text }}>
                      {formatOrderLogTime(order.accepted_at)}
                    </OrderLogTime>
                  </OrderLogRow>
                )}
                {(order.status === "ready" || order.status === "finish") && (
                  <OrderLogRow style={{ borderBottomColor: rowRule }}>
                    <OrderLogLabel style={{ color: colors.textMuted }}>Ready</OrderLogLabel>
                    <OrderLogTime style={{ color: colors.text }}>
                      {formatOrderLogTime(order.ready_at)}
                    </OrderLogTime>
                  </OrderLogRow>
                )}
                {order.status === "finish" && (
                  <OrderLogRow style={{ borderBottomWidth: 0 }}>
                    <OrderLogLabel style={{ color: colors.textMuted }}>Finished</OrderLogLabel>
                    <OrderLogTime style={{ color: colors.text }}>
                      {formatOrderLogTime(order.finished_at)}
                    </OrderLogTime>
                  </OrderLogRow>
                )}
              </OrderLogsContent>
            )}
          </OrderLogsBlock>
        )}
      </DetailsContent>
    );
  };

  const renderOrderActions = (order: Order) => (
    <Actions>
      {order.status === "pending" && (
        <AnimatedStatusButton
          disabled={!!loadingOrderId}
          onPress={async () => {
            setLoadingOrderId(order.id);
            try {
              if (isWaiterCallOrder(order)) {
                await deleteOrder(order.id);
                return;
              }
              await updateStatus(order.id, order.table_id, "accepted");
              setSelectedOrder(null);
            } finally {
              setLoadingOrderId(null);
            }
          }}
        >
          {loadingOrderId === order.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ActionBtnText>
              {isWaiterCallOrder(order) ? t("ordersFinish") : t("ordersAccept")}
            </ActionBtnText>
          )}
        </AnimatedStatusButton>
      )}
      {order.status === "accepted" && (
        <AnimatedStatusButton
          disabled={!!loadingOrderId}
          onPress={async () => {
            setLoadingOrderId(order.id);
            try {
              await updateStatus(order.id, order.table_id, "ready");
              setSelectedOrder(null);
            } finally {
              setLoadingOrderId(null);
            }
          }}
        >
          {loadingOrderId === order.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ActionBtnText>{t("ordersReady")}</ActionBtnText>
          )}
        </AnimatedStatusButton>
      )}
      {order.status === "ready" && (
        <AnimatedStatusButton
          disabled={!!loadingOrderId}
          onPress={async () => {
            setLoadingOrderId(order.id);
            try {
              await updateStatus(order.id, order.table_id, "finish");
              setSelectedOrder(null);
            } finally {
              setLoadingOrderId(null);
            }
          }}
        >
          {loadingOrderId === order.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ActionBtnText>{t("ordersFinish")}</ActionBtnText>
          )}
        </AnimatedStatusButton>
      )}
      {order.status === "finish" && (
        <AnimatedStatusButton
          variant="danger"
          borderColor={isLight ? "rgba(220,38,38,0.28)" : "rgba(239,68,68,0.5)"}
          onPress={async () => {
            await deleteOrder(order.id);
          }}
        >
          <DeleteBtnText>{t("ordersRemove")}</DeleteBtnText>
        </AnimatedStatusButton>
      )}
    </Actions>
  );

  return (
    <Container style={{ backgroundColor: colors.bg }}>
      <MainContent $tablet={isTablet}>
        <ListColumn $tablet={isTablet}>
          {isTablet ? (
            <LeftPaneInner $tablet={isTablet}>
              {ordersListBlock}
            </LeftPaneInner>
          ) : (
            ordersListBlock
          )}
        </ListColumn>
        {isTablet && (
          <DetailsColumn>
            <TabletPaneInner $tablet={isTablet}>
              <DetailsPaneCard
                style={{
                  backgroundColor: colors.surface,
                  borderColor: hairline,
                }}
              >
                {selectedOrder ? (
                  <>
                    <ScrollView
                      style={{ flex: 1 }}
                      contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
                      showsVerticalScrollIndicator={false}
                    >
                      {renderOrderDetails(selectedOrder)}
                    </ScrollView>
                    <TabletBottomActions
                      style={{
                        borderTopColor: rowRule,
                        paddingBottom: Math.max(insets.bottom, 12) + 39,
                      }}
                    >
                      {renderOrderActions(selectedOrder)}
                    </TabletBottomActions>
                  </>
                ) : (
                  <EmptyDetailsWrap>
                    <EmptyState style={{ color: colors.textMuted }}>
                      {t("ordersSelectDetails")}
                    </EmptyState>
                  </EmptyDetailsWrap>
                )}
              </DetailsPaneCard>
            </TabletPaneInner>
          </DetailsColumn>
        )}
      </MainContent>

        <Modal
          visible={!isTablet && !!selectedOrder}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedOrder(null)}
        >
          <ModalContainer style={{ backgroundColor: colors.bg }}>
            <ModalHeader style={{ borderBottomColor: hairline, paddingTop: Math.max(insets.top * 0.2, 10) }}>
              <ModalHandleWrap>
                <ModalHandle />
              </ModalHandleWrap>
              <ModalHeaderRow>
                <ModalSpacer />
                <ModalTitle style={{ color: colors.text }} numberOfLines={1}>
                  Order Details
                </ModalTitle>
                <ModalCloseBtn
                  onPress={() => setSelectedOrder(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{
                    backgroundColor: "transparent",
                    borderColor: "#ff944d",
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("ordersCloseDetails")}
                >
                  <Ionicons name="close" size={22} color="#ff944d" />
                </ModalCloseBtn>
              </ModalHeaderRow>
            </ModalHeader>
            {selectedOrder && (
              <>
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                  showsVerticalScrollIndicator={false}
                >
                  {renderOrderDetails(selectedOrder)}
                </ScrollView>
                <ModalBottomFixed
                  style={{
                    backgroundColor: colors.bg,
                    paddingBottom: Math.max(insets.bottom, 16),
                    borderTopColor: hairline,
                  }}
                >
                  {renderOrderActions(selectedOrder)}
                </ModalBottomFixed>
              </>
            )}
          </ModalContainer>
        </Modal>
    </Container>
  );
}

const Container = styled.View`flex: 1;`;
const HeaderControls = styled.View`
  flex-direction: row;
  align-items: center;
`;
const TogglePill = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  border-width: 1px;
  border-radius: 999px;
  padding: 5px 10px 5px 8px;
  margin-right: 8px;
`;
const ToggleTrack = styled.View`
  width: 32px;
  height: 18px;
  border-radius: 999px;
  border-width: 1px;
  margin-right: 6px;
  justify-content: center;
  padding: 1px;
`;
const ToggleThumb = styled.View`
  width: 14px;
  height: 14px;
  border-radius: 7px;
  border-width: 1px;
`;
const ToggleIconWrap = styled.View`
  width: 18px;
  align-items: center;
  justify-content: center;
  margin-right: 0px;
`;
const ToggleLabel = styled.Text`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2px;
`;
const MainContent = styled.View<{ $tablet: boolean }>`
  flex: 1;
  flex-direction: ${({ $tablet }) => ($tablet ? "row" : "column")};
`;
const ListColumn = styled.View<{ $tablet: boolean }>`
  flex: ${({ $tablet }) => ($tablet ? 0.3 : 1)};
`;
const LeftPaneInner = styled.View<{ $tablet: boolean }>`
  flex: 1;
  padding-top: ${({ $tablet }) => ($tablet ? "16px" : "16px")};
  padding-bottom: ${({ $tablet }) => ($tablet ? "0px" : "16px")};
  padding-left: ${({ $tablet }) => ($tablet ? "12px" : "16px")};
  padding-right: ${({ $tablet }) => ($tablet ? "8px" : "16px")};
`;
const DetailsColumn = styled.View`
  flex: 0.7;
`;
const DetailsPaneCard = styled.View`
  flex: 1;
  border-width: 1px;
  border-radius: 24px;
  overflow: hidden;
`;
const TabletPaneInner = styled.View<{ $tablet: boolean }>`
  flex: 1;
  padding-top: ${({ $tablet }) => ($tablet ? "16px" : "16px")};
  padding-bottom: ${({ $tablet }) => ($tablet ? "16px" : "16px")};
  padding-left: ${({ $tablet }) => ($tablet ? "8px" : "16px")};
  padding-right: ${({ $tablet }) => ($tablet ? "12px" : "16px")};
`;
const ModalContainer = styled.View`
  flex: 1;
`;
const ModalBottomFixed = styled.View`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 14px 16px 0;
  border-top-width: 1px;
`;
const EmptyDetailsWrap = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: 24px;
`;
const TabletBottomActions = styled.View`
  padding: 14px 16px 18px;
  border-top-width: 1px;
`;
const ModalHeader = styled.View`
  padding: 8px 14px 12px;
  border-bottom-width: 1px;
  gap: 10px;
`;
const ModalHandleWrap = styled.View`
  align-items: center;
  justify-content: center;
  gap: 1.5px;
  padding-top: 2px;
`;
const ModalHandle = styled.View`
  width: 36px;
  height: 3px;
  border-radius: 999px;
  background-color: #ff944d;
`;
const ModalHeaderRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  gap: 8px;
`;
const ModalSpacer = styled.View`width: 34px;`;
const ModalTitle = styled.Text`
  flex: 1;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.3px;
  text-align: center;
`;
const ModalCloseBtn = styled.TouchableOpacity`
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border-width: 1px;
`;
const DividerLine = styled.View`
  height: ${Math.max(StyleSheet.hairlineWidth, 1)}px;
`;
const SectionDivider = styled.View`
  height: ${Math.max(StyleSheet.hairlineWidth, 1)}px;
  margin-bottom: 16px;
`;
const TwoCol = styled.View<{ $tablet: boolean }>`
  flex-direction: column;
  padding-top: 0;
  padding-bottom: 8px;
  padding-left: ${({ $tablet }) => ($tablet ? "12px" : "16px")};
  padding-right: ${({ $tablet }) => ($tablet ? "8px" : "16px")};
`;
const OrderList = styled.View<{ $tablet: boolean }>`
  gap: 12px;
  margin-bottom: ${({ $tablet }) => ($tablet ? "0px" : "8px")};
`;
const BoardPanel = styled.View`
  border-radius: 24px;
  border-width: 1px;
  overflow: hidden;
`;
const DropdownHeader = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 15px 16px;
  gap: 12px;
`;
const DropdownHeaderLeft = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
`;
const DropdownTitle = styled.Text`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;
const AnimatedOrderWrapper = styled(Animated.View)`
  border-radius: 12px;
  border-width: 1px;
  border-left-width: 3px;
  overflow: hidden;
`;
const OrderCardsList = styled.View`
  gap: 10px;
  padding: 10px 12px 12px;
`;
const OrderBtn = styled.TouchableOpacity`
  padding: 12px 12px 12px 13px;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-height: 64px;
`;
const OrderBtnCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 4px;
  padding-right: 2px;
`;
const OrderBtnLabel = styled.Text`
  font-weight: 700;
  font-size: 14.5px;
  letter-spacing: -0.15px;
  line-height: 19px;
`;
const OrderIdPill = styled.View`
  padding: 2px 7px;
  border-radius: 7px;
  flex-shrink: 0;
`;
const OrderIdText = styled.Text`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1px;
`;
const OrderMetaRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;
const OrderBtnMeta = styled.Text`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 17px;
`;
const OrderBtnTotal = styled.Text`
  flex-shrink: 0;
  font-weight: 500;
  font-size: 13px;
  letter-spacing: -0.1px;
  line-height: 17px;
`;
const ReadyIndicatorWrap = styled.View`
  align-items: center;
`;
const ReadyCircleOuter = styled.View`
  width: 38px;
  height: 38px;
  border-radius: 19px;
  border-width: 1px;
  border-color: rgba(255,255,255,0.85);
  align-items: center;
  justify-content: center;
  overflow: visible;
`;
const ReadyCircle = styled.View`
  width: 32px;
  height: 32px;
  border-radius: 16px;
  border-width: 2px;
  border-color: #22c55e;
  align-items: center;
  justify-content: flex-start;
  overflow: visible;
`;
const TickIconWrap = styled.View`
  margin-top: -10px;
`;
const FinishedLabel = styled.Text`
  font-size: 9px;
  font-weight: 600;
  color: #22c55e;
  margin-top: 1px;
`;
const TimerCircleWrapper = styled.View`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  border-width: 2px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;
const TimerCircleText = styled.Text`
  font-size: 11px;
  font-weight: 700;
`;
const EmptyHint = styled.Text`
  text-align: center;
  padding: 22px 12px;
  font-size: 13px;
  font-weight: 500;
`;
const DetailsContent = styled.View`
  gap: 12px;
`;
const DetailCard = styled.View`
  border-radius: 24px;
  border-width: 1px;
  padding: 16px;
  gap: 14px;
`;
const DetailHero = styled.View`
  gap: 8px;
`;
const DetailMetaRow = styled.View`
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
`;
const StatusPill = styled.View`
  padding: 3px 9px;
  border-radius: 999px;
`;
const StatusPillText = styled.Text`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1px;
`;
const TableLabel = styled.Text`
  font-weight: 800;
  font-size: 22px;
  letter-spacing: -0.4px;
  line-height: 28px;
`;
const OrderLogsBlock = styled.View`
  padding: 4px 4px 8px;
  border-radius: 24px;
  border-width: 1px;
  overflow: hidden;
`;
const OrderLogsHeader = styled.TouchableOpacity`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 12px 12px;
`;
const OrderLogsTitle = styled.Text`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;
const OrderLogsContent = styled.View`
  padding: 0 12px 8px;
`;
const OrderLogRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-vertical: 10px;
  border-bottom-width: 1px;
`;
const OrderLogLabel = styled.Text`
  font-size: 13px;
  font-weight: 500;
`;
const OrderLogTime = styled.Text`
  font-size: 13px;
  font-weight: 600;
`;
const CommentBlock = styled.View`
  padding: 12px;
  border-radius: 14px;
  border-width: 1px;
  gap: 4px;
`;
const CommentLabel = styled.Text`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
`;
const CommentText = styled.Text`
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
`;
const ItemsList = styled.View`
  border-width: 1px;
  border-radius: 16px;
  padding: 4px 12px;
  overflow: hidden;
`;
const ItemRow = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 12px 0;
  gap: 10px;
`;
const ItemNameText = styled.Text`
  font-weight: 600;
  flex: 1;
  font-size: 15px;
  letter-spacing: -0.15px;
  line-height: 20px;
`;
const QtyBadge = styled.View`
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;
const QtyBadgeText = styled.Text`
  font-size: 11px;
  font-weight: 800;
`;
const LineTotal = styled.Text`
  font-weight: 700;
  font-size: 14px;
  min-width: 64px;
  text-align: right;
  letter-spacing: -0.2px;
`;
const OrderTotal = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-top: 4px;
  border-top-width: 1px;
`;
const OrderTotalLabel = styled.Text`
  font-size: 14px;
  font-weight: 600;
`;
const OrderTotalValue = styled.Text`
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.4px;
  min-width: 70px;
  text-align: right;
`;
const Actions = styled.View`
  flex-direction: row;
  gap: 8px;
`;
const ActionBtnShell = styled.TouchableOpacity`
  flex: 1;
  overflow: hidden;
  border-width: 1px;
  border-radius: 999px;
  min-height: 50px;
  justify-content: center;
`;
const ActionBtnContent = styled.View`
  z-index: 1;
  min-height: 50px;
  padding: 14px;
  align-items: center;
  justify-content: center;
`;
const ActionBtnText = styled.Text`
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  letter-spacing: -0.2px;
`;
const DeleteBtnText = styled.Text`
  color: #fff;
  font-weight: 800;
  font-size: 15px;
`;
const EmptyState = styled.Text`
  text-align: center;
  padding: 16px;
  font-size: 15px;
  font-weight: 500;
`;
