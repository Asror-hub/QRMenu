import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes, css } from "styled-components";
import { supabase } from "../services/supabase";
import { useRestaurant } from "../context/RestaurantContext";
import { useLanguage } from "../context/LanguageContext";
import { TopBarSlotsContext } from "../components/Layout";
import { formatCurrency } from "../utils/currency";
import { cardItem, cardItemHover, cardPanel, listSurface } from "../styles/cards";
import notificationSound from "../assets/sounds/notification.mp3";

const ORDER_STATUS_COLORS = {
  pending: { base: "#ea580c", soft: "rgba(234, 88, 12, 0.1)", ring: "rgba(234, 88, 12, 0.34)" },
  accepted: { base: "#2563eb", soft: "rgba(37, 99, 235, 0.1)", ring: "rgba(37, 99, 235, 0.32)" },
  ready: { base: "#0d9488", soft: "rgba(13, 148, 136, 0.1)", ring: "rgba(13, 148, 136, 0.32)" },
  finish: { base: "#16a34a", soft: "rgba(22, 163, 74, 0.1)", ring: "rgba(22, 163, 74, 0.3)" }
};

const getStatusColor = (status) =>
  ORDER_STATUS_COLORS[status] ?? ORDER_STATUS_COLORS.pending;

function formatOrderLogTime(iso, locale) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_SWIPE_MS = 1400;

function isWaiterCallOrder(order) {
  return (order?.items ?? []).some((item) => item?.type === "waiter_call");
}

/** Incoming Orders screen is for QR/online orders (+ waiter calls), not waiter-submitted POS carts. */
function isStaffSubmittedOrder(order) {
  return order?.source === "staff" && !isWaiterCallOrder(order);
}

function getSidebarOrderLabel(order, t) {
  return isWaiterCallOrder(order)
    ? t("waiterRequest")
    : t("orderNumber", { number: order.order_number ?? "---" });
}

function PrepTimerDisplay({ order, prepTimeMins, t }) {
  const startIso = order.created_at ?? order.accepted_at ?? null;
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!startIso || prepTimeMins == null || prepTimeMins < 0) {
    return (
      <TimerCircle $borderColor="#22c55e" $borderStyle="solid" $bg="transparent">
        <TimerCircleText>—</TimerCircleText>
      </TimerCircle>
    );
  }
  if (order.status === "ready") {
    return (
      <TimerCircle $borderColor="#22c55e" $borderStyle="solid" $bg="transparent">
        <TimerCircleText $green>{t("ready")}</TimerCircleText>
      </TimerCircle>
    );
  }
  if (order.status === "finish") {
    return (
      <TimerFinishedWrap>
        <ReadyCircleOuter>
          <ReadyCircle>
            <TimerCheckmark viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </TimerCheckmark>
          </ReadyCircle>
        </ReadyCircleOuter>
        <TimerLabel>{t("finished")}</TimerLabel>
      </TimerFinishedWrap>
    );
  }

  const start = new Date(startIso).getTime();
  const target = start + prepTimeMins * 60 * 1000;
  const now = Date.now();
  const secsLeft = Math.floor((target - now) / 1000);
  let text = "—";
  let state = "countdown";
  if (secsLeft > 0) {
    const totalMins = Math.floor(secsLeft / 60);
    text = totalMins >= 60
      ? `${Math.floor(totalMins / 60)}:${(totalMins % 60).toString().padStart(2, "0")}`
      : `${totalMins}:${(secsLeft % 60).toString().padStart(2, "0")}`;
  } else {
    const overtimeSecs = Math.abs(secsLeft);
    const totalMins = Math.floor(overtimeSecs / 60);
    state = totalMins >= 15 ? "over15" : "overtime";
    text = totalMins >= 60
      ? `${Math.floor(totalMins / 60)}:${(totalMins % 60).toString().padStart(2, "0")}`
      : `${totalMins}:${(overtimeSecs % 60).toString().padStart(2, "0")}`;
  }

  const borderColor = state === "countdown" ? "#22c55e" : "#f97316";
  const borderStyle = state === "countdown" ? "solid" : "dotted";
  const bg = state === "countdown" ? "transparent" : "rgba(249,115,22,0.15)";
  const numberColor = state === "over15" ? "#ef4444" : state === "overtime" ? "#f97316" : undefined;

  return (
    <TimerCircle $borderColor={borderColor} $borderStyle={borderStyle} $bg={bg}>
      <TimerCircleText $color={numberColor}>{text}</TimerCircleText>
    </TimerCircle>
  );
}

const Orders = () => {
  const { restaurant, refresh } = useRestaurant();
  const { t, locale } = useLanguage();
  const { actionsEl: topBarActionsEl } = useContext(TopBarSlotsContext);
  const prepTimeMins = Number(restaurant?.prep_time) || 15;
  const currency = restaurant?.currency ?? "USD";
  const [orderLogsExpanded, setOrderLogsExpanded] = useState(false);
  const [loadingOrderId, setLoadingOrderId] = useState(null);
  const [actionSweeping, setActionSweeping] = useState(false);
  const [orders, setOrders] = useState([]);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [expandedFilters, setExpandedFilters] = useState({});
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem("admin_sound_enabled") === "true"
  );
  const autoAcceptEnabled = !!restaurant?.auto_accept;
  const channelRef = useRef(null);
  const notificationAudioRef = useRef(null);
  const prevOrderIdsRef = useRef(new Set());
  const hasLoadedRef = useRef(false);
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const pendingAlarmRef = useRef(null);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  const loadOrders = async () => {
    if (!restaurant?.id) return;
    const { data, error } = await supabase
      .from("orders")
      .select("id, table_id, status, items, order_number, comment, source, created_at, accepted_at, ready_at, finished_at, archived_at, tables (table_number, table_name)")
      .eq("restaurant_id", restaurant.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[admin Orders] load failed:", error.message);
      return;
    }
    setOrders(data ?? []);
  };

  useEffect(() => {
    loadOrders();
  }, [restaurant]);

  useEffect(() => {
    const checkAutoStatus = async () => {
      const list = ordersRef.current;
      const targetMs = prepTimeMins * 60 * 1000;
      const twelveHours = 12 * 60 * 60 * 1000;
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const now = Date.now();
      let didUpdate = false;

      for (const order of list) {
        const startIso = order.accepted_at ?? order.created_at;
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
                : {})
            })
            .eq("id", order.id);
          setSelectedOrder((o) => (o && String(o.id) === String(order.id) ? null : o));
          didUpdate = true;
        } else if (overtimeMs >= twelveHours && order.status !== "finish") {
          await updateStatus(order.id, order.table_id, "finish");
          didUpdate = true;
        }
      }
      if (didUpdate) loadOrders();
    };
    checkAutoStatus();
    const id = setInterval(checkAutoStatus, 60_000);
    return () => clearInterval(id);
  }, [prepTimeMins]);

  useEffect(() => {
    if (!orders.length) return;
    const latestId = orders[0]?.id;
    const next = orders.reduce((acc, order) => {
      acc[order.id] = order.id === latestId;
      return acc;
    }, {});
    setExpandedOrders(next);
  }, [orders]);

  useEffect(() => {
    const nextIds = new Set(orders.map((order) => order.id));
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      prevOrderIdsRef.current = nextIds;
      return;
    }
    const newOrders = orders.filter((order) => !prevOrderIdsRef.current.has(order.id));
    const newPendingIds = new Set(
      newOrders
        .filter((o) => o.status === "pending" && !isStaffSubmittedOrder(o))
        .map((o) => o.id)
    );
    if (newPendingIds.size && soundEnabled) {
      playBeep();
    }
    setHighlightedIds((prev) => {
      const next = new Set(prev);
      newPendingIds.forEach((id) => next.add(id));
      orders
        .filter((o) => o.status !== "pending" || isStaffSubmittedOrder(o))
        .forEach((o) => next.delete(o.id));
      return next;
    });
    prevOrderIdsRef.current = nextIds;
  }, [orders, soundEnabled]);

  useEffect(() => {
    const hasPending = orders.some(
      (order) => order.status === "pending" && !isStaffSubmittedOrder(order)
    );
    if (soundEnabled && hasPending && !pendingAlarmRef.current) {
      pendingAlarmRef.current = setInterval(() => {
        playBeep();
      }, 6000);
    }

    if ((!soundEnabled || !hasPending) && pendingAlarmRef.current) {
      clearInterval(pendingAlarmRef.current);
      pendingAlarmRef.current = null;
    }

    return () => {
      if (pendingAlarmRef.current && (!soundEnabled || !hasPending)) {
        clearInterval(pendingAlarmRef.current);
        pendingAlarmRef.current = null;
      }
    };
  }, [orders, soundEnabled]);

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
  }, [orders, autoAcceptEnabled]);

  const playBeep = async () => {
    try {
      if (!notificationAudioRef.current) {
        notificationAudioRef.current = new Audio(notificationSound);
        notificationAudioRef.current.preload = "auto";
      }
      const audio = notificationAudioRef.current;
      audio.currentTime = 0;
      await audio.play();
    } catch {
      // ignore (e.g. autoplay blocked until a user gesture)
    }
  };

  const enableSound = async () => {
    setSoundEnabled(true);
    localStorage.setItem("admin_sound_enabled", "true");
    await playBeep();
  };

  useEffect(() => {
    if (!restaurant?.id) return;

    channelRef.current = supabase.channel("order-status");
    channelRef.current.subscribe();

    const channel = supabase
      .channel("orders-admin")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        (payload) => {
          loadOrders();
          if (payload.eventType === "INSERT" && soundEnabled) {
            const row = payload.new ?? null;
            if (row?.status === "pending" && row?.source !== "staff") {
              playBeep();
            }
          }
        }
      )
      .subscribe();

    const interval = setInterval(loadOrders, 10000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [restaurant, soundEnabled]);

  const updateStatus = async (id, tableId, status) => {
    setLoadingOrderId(id);
    try {
      const now = new Date().toISOString();
      const updates = { status };
      if (status === "accepted") updates.accepted_at = now;
      else if (status === "ready") updates.ready_at = now;
      else if (status === "finish") updates.finished_at = now;

      // Optimistic UI so the detail panel advances immediately.
      setOrders((prev) =>
        prev.map((order) => (String(order.id) === String(id) ? { ...order, ...updates } : order))
      );
      setSelectedOrder((current) =>
        current && String(current.id) === String(id) ? { ...current, ...updates } : current
      );

      const { data, error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", id)
        .select("id, status")
        .maybeSingle();

      if (error) {
        console.warn("[admin Orders] status update failed:", error.message);
        await loadOrders();
        return;
      }
      if (!data) {
        console.warn("[admin Orders] status update matched no rows (check RLS / ownership).");
        await loadOrders();
        return;
      }

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "status",
          payload: { orderId: id, tableId, status }
        });
      }
      if (status === "accepted") {
        supabase.functions.invoke("send-order-to-pos", { body: { orderId: id } }).catch(() => {});
      }
      await loadOrders();
    } finally {
      setLoadingOrderId(null);
    }
  };

  const runStatusAction = async (action) => {
    if (actionSweeping || loadingOrderId) return;
    setActionSweeping(true);
    await new Promise((resolve) => setTimeout(resolve, ACTION_SWIPE_MS));
    try {
      await action();
    } finally {
      setActionSweeping(false);
    }
  };

  const deleteOrder = async (id) => {
    const order = ordersRef.current.find((o) => String(o.id) === String(id));
    const now = new Date().toISOString();
    // Soft-archive instead of hard delete so analytics history is preserved.
    await supabase
      .from("orders")
      .update({
        archived_at: now,
        ...(order && order.status !== "finish"
          ? { status: "finish", finished_at: order.finished_at ?? now }
          : {})
      })
      .eq("id", id);
    setSelectedOrder((o) => (o && String(o.id) === String(id) ? null : o));
    loadOrders();
  };

  const toggleOrder = (id) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getOrderTotal = (items = []) =>
    items.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );

  const filters = useMemo(
    () => [
      { id: "pending", label: t("newOrders"), status: "pending" },
      { id: "accepted", label: t("inProgress"), status: "accepted" },
      { id: "ready", label: t("ready"), status: "ready" },
      { id: "finish", label: t("finished"), status: "finish" }
    ],
    [t]
  );

  const screenOrders = useMemo(
    () => orders.filter((order) => !isStaffSubmittedOrder(order)),
    [orders]
  );

  const ordersByStatus = useMemo(
    () =>
      filters.reduce((acc, filter) => {
        acc[filter.status] = screenOrders.filter((order) => order.status === filter.status);
        return acc;
      }, {}),
    [filters, screenOrders]
  );

  useEffect(() => {
    setSelectedOrder((current) => {
      // Never keep waiter/self (staff) orders in the detail pane.
      if (current && isStaffSubmittedOrder(current)) {
        return screenOrders[0] ?? null;
      }
      if (current == null) {
        return screenOrders[0] ?? null;
      }
      const next = screenOrders.find((o) => String(o.id) === String(current.id));
      if (next) return next;
      // Do not fall back to a staff order on a miss.
      return current;
    });
  }, [screenOrders]);

  const getTableDisplay = (order) => {
    const name = order.tables?.table_name?.trim();
    const number = order.tables?.table_number;
    if (name && number != null && number !== "") {
      return { primary: String(number), secondary: name };
    }
    if (number != null && number !== "") {
      return { primary: String(number), secondary: null };
    }
    if (name) {
      return { primary: name, secondary: null };
    }
    return { primary: String(order.table_id ?? "—"), secondary: null };
  };

  const formatTableLabel = (order) => {
    const { primary, secondary } = getTableDisplay(order);
    if (secondary) return `${secondary} ${primary}`;
    return t("tableLabel", { number: primary });
  };

  return (
    <PageShell>
      {topBarActionsEl &&
        createPortal(
          <ControlsRow>
            <ToggleControlButton
              type="button"
              $active={autoAcceptEnabled}
              onClick={async () => {
                if (!restaurant?.id) return;
                const next = !autoAcceptEnabled;
                const { error } = await supabase
                  .from("restaurants")
                  .update({ auto_accept: next })
                  .eq("id", restaurant.id);
                if (!error) {
                  refresh();
                }
              }}
              aria-label={autoAcceptEnabled ? t("autoAcceptOn") : t("autoAcceptOff")}
            >
              <AutoAcceptGlyph $active={autoAcceptEnabled} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
                </svg>
              </AutoAcceptGlyph>
              <ToggleKnob $active={autoAcceptEnabled} />
              <span>{t("autoAccept")}</span>
            </ToggleControlButton>
            <SoundIconButton
              type="button"
              $active={soundEnabled}
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                localStorage.setItem("admin_sound_enabled", String(next));
                if (next) playBeep();
              }}
              aria-label={soundEnabled ? t("soundOn") : t("soundOff")}
            >
              {soundEnabled ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              )}
              <span>{soundEnabled ? t("soundOn") : t("soundOff")}</span>
            </SoundIconButton>
          </ControlsRow>,
          topBarActionsEl
        )}
    <Page>
      <FilterPane>
        {filters.map((filter) => {
          const isOpen = expandedFilters[filter.status] ?? true;
          const filtered = ordersByStatus[filter.status] ?? [];
          return (
            <FilterSection key={filter.id} $status={filter.status}>
              <FilterHeader>
                <FilterTitleWrap>
                  <SectionDot $status={filter.status} aria-hidden />
                  <FilterTitle>{filter.label}</FilterTitle>
                  <FilterCountBadge $status={filter.status}>{filtered.length}</FilterCountBadge>
                </FilterTitleWrap>
                <ToggleButton
                  type="button"
                  aria-label={isOpen ? t("collapseSection") : t("expandSection")}
                  onClick={() =>
                    setExpandedFilters((prev) => ({
                      ...prev,
                      [filter.status]: !isOpen
                    }))
                  }
                >
                  <ChevronIcon $open={isOpen} viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </ChevronIcon>
                </ToggleButton>
              </FilterHeader>
              {isOpen && (
                <FilterList>
                  {filtered.length === 0 ? (
                    <EmptyState>{t("noOrders")}</EmptyState>
                  ) : (
                    filtered.map((order) => (
                      <FilterListRow key={order.id}>
                        {(() => {
                          const isWaiterRequest = isWaiterCallOrder(order);
                          return (
                        <FilterOrderButton
                          type="button"
                          $status={filter.status}
                          $active={String(order.id) === String(selectedOrder?.id)}
                          $highlight={highlightedIds.has(order.id)}
                          $waiter={isWaiterRequest}
                          onClick={() => {
                            setSelectedOrder(order);
                            setMobileDetailOpen(true);
                          }}
                        >
                          <div>
                            <strong>{formatTableLabel(order)}</strong>
                            <OrderMetaRow>
                              <span>{getSidebarOrderLabel(order, t)}</span>
                              {!isWaiterRequest && (
                                <span>{formatCurrency(getOrderTotal(order.items), currency)}</span>
                              )}
                            </OrderMetaRow>
                          </div>
                          <PrepTimerDisplay order={order} prepTimeMins={prepTimeMins} t={t} />
                        </FilterOrderButton>
                          );
                        })()}
                      </FilterListRow>
                    ))
                  )}
                </FilterList>
              )}
            </FilterSection>
          );
        })}
      </FilterPane>
      <DetailsPane $mobileOpen={mobileDetailOpen}>
        <MobileBackBar>
          <MobileBackButton type="button" onClick={() => setMobileDetailOpen(false)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 19l-7-7 7-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{t("allOrders")}</span>
          </MobileBackButton>
        </MobileBackBar>
        {selectedOrder ? (
          <>
          {(() => {
            const isWaiterRequest = isWaiterCallOrder(selectedOrder);
            const tableDisplay = getTableDisplay(selectedOrder);
            return (
          <DetailCard>
            <DetailBody>
            <DetailHeader>
              <OrderTopRow>
                <OrderTagWrap>
                  <OrderTag>#{selectedOrder.order_number ?? "---"}</OrderTag>
                  <OrderStatusPill $status={selectedOrder.status}>
                    {selectedOrder.status}
                  </OrderStatusPill>
                </OrderTagWrap>
                <TableBadge>
                  <TableBadgeRow>
                    <TableBadgeEyebrow>{t("table")}</TableBadgeEyebrow>
                    <TableBadgePrimary>{tableDisplay.primary}</TableBadgePrimary>
                  </TableBadgeRow>
                  {tableDisplay.secondary && (
                    <TableBadgeSecondary>{tableDisplay.secondary}</TableBadgeSecondary>
                  )}
                </TableBadge>
              </OrderTopRow>
            </DetailHeader>
            {isWaiterRequest ? (
              <Items>
                {selectedOrder.comment && (
                  <CommentBlock>
                    <strong>{t("message")}</strong>
                    <span>{selectedOrder.comment}</span>
                  </CommentBlock>
                )}
              </Items>
            ) : (
              <>
                <Items>
                  {selectedOrder.comment && (
                    <CommentBlock>
                      <strong>{t("comment")}</strong>
                      <span>{selectedOrder.comment}</span>
                    </CommentBlock>
                  )}
                  {(selectedOrder.items ?? []).map((item, index) => {
                    const price = Number(item.price || 0);
                    const quantity = Number(item.quantity || 0);
                    return (
                      <ItemRow key={`${selectedOrder.id}-${index}`}>
                        <ItemName>
                          <QtyBadge>x{quantity}</QtyBadge>
                          <span>{item.name}</span>
                        </ItemName>
                        <LineTotalWrap>
                          <LinePrice>{formatCurrency(Number(item.price || 0), currency)}</LinePrice>
                          <LineTotal>{formatCurrency(price * quantity, currency)}</LineTotal>
                        </LineTotalWrap>
                      </ItemRow>
                    );
                  })}
                </Items>
                <OrderTotal>
                  <span>{t("orderTotal")}</span>
                  <strong>{formatCurrency(getOrderTotal(selectedOrder.items), currency)}</strong>
                </OrderTotal>
              </>
            )}
            </DetailBody>
            <Actions>
              {selectedOrder.status === "pending" && (
                <ActionButton
                  type="button"
                  $sweeping={actionSweeping}
                  onClick={() => {
                    runStatusAction(async () => {
                      if (isWaiterCallOrder(selectedOrder)) {
                        await deleteOrder(selectedOrder.id);
                        return;
                      }
                      await updateStatus(selectedOrder.id, selectedOrder.table_id, "accepted");
                    });
                  }}
                  disabled={actionSweeping || loadingOrderId === selectedOrder.id}
                >
                  <ActionButtonLabel>
                    {actionSweeping || loadingOrderId === selectedOrder.id ? (
                      <ButtonLoader aria-label={t("loading")}>
                        <ButtonLoaderDot />
                        <ButtonLoaderDot />
                        <ButtonLoaderDot />
                      </ButtonLoader>
                    ) : isWaiterCallOrder(selectedOrder) ? (
                      t("finish")
                    ) : (
                      t("accept")
                    )}
                  </ActionButtonLabel>
                </ActionButton>
              )}
              {selectedOrder.status === "accepted" && (
                <ActionButton
                  type="button"
                  $sweeping={actionSweeping}
                  onClick={() =>
                    runStatusAction(() =>
                      updateStatus(selectedOrder.id, selectedOrder.table_id, "ready")
                    )
                  }
                  disabled={actionSweeping || loadingOrderId === selectedOrder.id}
                >
                  <ActionButtonLabel>
                    {actionSweeping || loadingOrderId === selectedOrder.id ? (
                      <ButtonLoader aria-label={t("loading")}>
                        <ButtonLoaderDot />
                        <ButtonLoaderDot />
                        <ButtonLoaderDot />
                      </ButtonLoader>
                    ) : (
                      t("markReady")
                    )}
                  </ActionButtonLabel>
                </ActionButton>
              )}
              {selectedOrder.status === "ready" && (
                <ActionButton
                  type="button"
                  $sweeping={actionSweeping}
                  onClick={() =>
                    runStatusAction(() =>
                      updateStatus(selectedOrder.id, selectedOrder.table_id, "finish")
                    )
                  }
                  disabled={actionSweeping || loadingOrderId === selectedOrder.id}
                >
                  <ActionButtonLabel>
                    {actionSweeping || loadingOrderId === selectedOrder.id ? (
                      <ButtonLoader aria-label={t("loading")}>
                        <ButtonLoaderDot />
                        <ButtonLoaderDot />
                        <ButtonLoaderDot />
                      </ButtonLoader>
                    ) : (
                      t("finish")
                    )}
                  </ActionButtonLabel>
                </ActionButton>
              )}
              {selectedOrder.status === "finish" && (
                <DeleteButton
                  type="button"
                  onClick={() => deleteOrder(selectedOrder.id)}
                >
                  {t("remove")}
                </DeleteButton>
              )}
            </Actions>
          </DetailCard>
            );
          })()}
          {selectedOrder.status !== "pending" && (
            <OrderLogsBlock>
              <OrderLogsHeader type="button" onClick={() => setOrderLogsExpanded((e) => !e)}>
                <OrderLogsTitle>{t("orderLogs")}</OrderLogsTitle>
                <ChevronIcon $open={orderLogsExpanded} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </ChevronIcon>
              </OrderLogsHeader>
              {orderLogsExpanded && (
                <OrderLogsContent>
                  <OrderLogRow>
                    <OrderLogLabel>{t("entered")}</OrderLogLabel>
                    <OrderLogTime>{formatOrderLogTime(selectedOrder.created_at, locale)}</OrderLogTime>
                  </OrderLogRow>
                  {(selectedOrder.status === "accepted" || selectedOrder.status === "ready" || selectedOrder.status === "finish") && (
                    <OrderLogRow>
                      <OrderLogLabel>{t("accepted")}</OrderLogLabel>
                      <OrderLogTime>{formatOrderLogTime(selectedOrder.accepted_at, locale)}</OrderLogTime>
                    </OrderLogRow>
                  )}
                  {(selectedOrder.status === "ready" || selectedOrder.status === "finish") && (
                    <OrderLogRow>
                      <OrderLogLabel>{t("ready")}</OrderLogLabel>
                      <OrderLogTime>{formatOrderLogTime(selectedOrder.ready_at, locale)}</OrderLogTime>
                    </OrderLogRow>
                  )}
                  {selectedOrder.status === "finish" && (
                    <OrderLogRow>
                      <OrderLogLabel>{t("finished")}</OrderLogLabel>
                      <OrderLogTime>{formatOrderLogTime(selectedOrder.finished_at, locale)}</OrderLogTime>
                    </OrderLogRow>
                  )}
                </OrderLogsContent>
              )}
            </OrderLogsBlock>
          )}
          </>
        ) : (
          <DetailsEmpty>
            <EmptyIconRing>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M8 8h8M8 12h8M8 16h5" />
              </svg>
            </EmptyIconRing>
            <EmptyTitle>{t("noOrderSelected")}</EmptyTitle>
            <EmptyText>
              {t("noOrderSelectedHint")}
            </EmptyText>
          </DetailsEmpty>
        )}
      </DetailsPane>
    </Page>
    </PageShell>
  );
};

const PageShell = styled.div`
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  gap: 0;
  flex: 1;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const controlPill = css`
  border: 1px solid var(--container-border);
  background: var(--button-overlay);
  color: var(--orders-text);
  height: 36px;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 600;
  transition: border-color 0.18s ease, background 0.18s ease,
    color 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--sidebar-orange) 55%, var(--container-border));
    background: color-mix(in srgb, var(--sidebar-orange) 8%, var(--button-overlay));
  }

  ${({ $active }) =>
    $active &&
    css`
      border-color: color-mix(in srgb, var(--sidebar-orange) 45%, transparent);
      background: color-mix(in srgb, var(--sidebar-orange) 12%, var(--surface));
      color: var(--sidebar-orange);
    `}

  [data-theme="light"] & {
    background: #ffffff;
    box-shadow: 0 1px 2px rgba(17, 24, 39, 0.05);
  }

  [data-theme="light"] &:hover {
    background: color-mix(in srgb, var(--sidebar-orange) 6%, #ffffff);
    border-color: color-mix(in srgb, var(--sidebar-orange) 45%, var(--container-border));
  }

  ${({ $active }) =>
    $active &&
    css`
      [data-theme="light"] & {
        background: color-mix(in srgb, var(--sidebar-orange) 10%, #ffffff);
        border-color: color-mix(in srgb, var(--sidebar-orange) 42%, transparent);
        box-shadow:
          0 1px 2px rgba(17, 24, 39, 0.05),
          0 4px 10px rgba(17, 24, 39, 0.08);
      }
    `}
`;

const ToggleControlButton = styled.button`
  ${controlPill}

  @media (max-width: 600px) {
    display: none;
  }
`;

const ToggleKnob = styled.span`
  width: 24px;
  height: 14px;
  border-radius: 999px;
  background: ${({ $active }) => ($active ? "var(--sidebar-orange)" : "var(--container-border-strong)")};
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s ease;

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: ${({ $active }) => ($active ? "12px" : "2px")};
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #fff;
    transition: left 0.2s ease;
  }

  @media (max-width: 600px) {
    display: none;
  }
`;

const AutoAcceptGlyph = styled.span`
  display: none;

  @media (max-width: 600px) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${({ $active }) =>
      $active ? "var(--sidebar-orange)" : "var(--text-muted)"};
    transition: color 0.2s ease;

    svg {
      width: 20px;
      height: 20px;
    }
  }
`;

const SoundIconButton = styled.button`
  ${controlPill}

  @media (max-width: 600px) {
    gap: 0;
    padding: 0 10px;

    span {
      display: none;
    }
  }
`;

const Page = styled.div`
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 22px;
  align-items: start;
  min-height: 0;
  height: 100%;
  overflow: hidden;

  @media (max-width: 1180px) {
    grid-template-columns: 280px 1fr;
    gap: 16px;
  }

  @media (max-width: 900px) {
    grid-template-columns: 240px 1fr;
    gap: 12px;
  }

  @media (max-width: 760px) {
    position: relative;
    grid-template-columns: 1fr;
    gap: 0;
    align-items: stretch;
    overflow: hidden;
  }
`;

const newOrderPulse = keyframes`
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255, 102, 0, 0.25); }
  50% { opacity: 0.95; box-shadow: 0 0 0 6px rgba(255, 102, 0, 0.08); }
`;

const actionSwipeFill = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(105%); }
`;

const FilterPane = styled.aside`
  ${cardPanel}
  border-radius: var(--radius-lg);
  padding: 18px;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  @media (max-width: 900px) {
    padding: 14px;
  }

  @media (max-width: 760px) {
    height: 100%;
    max-height: none;
    padding: 14px;
  }

  [data-theme="light"] & {
    box-shadow: none;
  }
`;

const FilterList = styled.div`
  display: grid;
  gap: 10px;
`;

const FilterListRow = styled.div`
  display: grid;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--container-border-subtle);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const FilterSection = styled.div`
  display: grid;
  gap: 12px;
  margin-bottom: 18px;
  padding: 10px;
  ${listSurface}
  background: ${({ $status }) =>
    $status === "pending"
      ? `linear-gradient(180deg, rgba(255, 102, 0, 0.1), color-mix(in srgb, var(--surface) 80%, var(--bg) 20%))`
      : undefined};

  &:last-child {
    margin-bottom: 0;
  }

  [data-theme="light"] & {
    gap: 10px;
    margin-bottom: 22px;
    padding: 0;
    background: none;
    box-shadow: none;
  }
`;

const FilterHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 2px 0 4px;

  [data-theme="light"] & {
    padding: 0 2px 9px;
    border-bottom: 1px solid var(--container-border-subtle);
  }
`;

const SectionDot = styled.span`
  display: none;

  [data-theme="light"] & {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 3px;
    flex-shrink: 0;
    background: ${({ $status }) => getStatusColor($status).base};
    box-shadow: 0 0 0 3px ${({ $status }) => getStatusColor($status).soft};
  }
`;

const FilterTitle = styled.h3`
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--orders-text);
`;

const FilterTitleWrap = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`;

const FilterCountBadge = styled.span`
  min-width: 26px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: ${({ $status }) => ($status === "pending" ? "#ffffff" : "var(--orders-text)")};
  background: ${({ $status }) =>
    $status === "pending" ? "var(--sidebar-orange)" : "var(--container-border-subtle)"};

  [data-theme="light"] & {
    min-width: 24px;
    color: ${({ $status }) => getStatusColor($status).base};
    background: ${({ $status }) => getStatusColor($status).soft};
    border: 1px solid ${({ $status }) => getStatusColor($status).ring};
  }
`;

const OrderMetaRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  opacity: 0.9;
`;

const FilterOrderButton = styled.button`
  ${cardItem}
  ${cardItemHover}
  border-left: 4px solid
    ${({ $active, $status, $highlight, $waiter }) =>
      $waiter
        ? "#0ea5e9"
        : $active
          ? "var(--sidebar-orange)"
          : $highlight
            ? "#ea580c"
            : $status === "pending"
              ? "#f97316"
              : "color-mix(in srgb, var(--primary) 28%, var(--container-border-subtle))"};
  background: ${({ $active, $highlight, $waiter }) =>
    $waiter
      ? "linear-gradient(180deg, rgba(14, 165, 233, 0.16), color-mix(in srgb, var(--surface) 90%, var(--button-overlay) 10%))"
      : $active
        ? "linear-gradient(180deg, color-mix(in srgb, var(--primary) 14%, var(--surface)), color-mix(in srgb, var(--surface) 90%, var(--button-overlay) 10%))"
        : $highlight
          ? "linear-gradient(180deg, rgba(255, 102, 0, 0.14), color-mix(in srgb, var(--surface) 90%, var(--button-overlay) 10%))"
          : undefined};
  color: var(--orders-text);
  padding: 12px;
  cursor: pointer;
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  animation: ${({ $highlight }) => ($highlight ? css`${newOrderPulse} 2s ease-in-out infinite` : "none")};

  &:hover {
    background: ${({ $status, $waiter }) =>
      $waiter
        ? "linear-gradient(180deg, rgba(14, 165, 233, 0.2), color-mix(in srgb, var(--surface) 88%, var(--button-overlay) 12%))"
        : $status === "pending"
          ? "linear-gradient(180deg, rgba(255, 102, 0, 0.16), color-mix(in srgb, var(--surface) 88%, var(--button-overlay) 12%))"
          : undefined};
  }

  [data-theme="light"] & {
    position: relative;
    border: 1px solid var(--orders-container-border);
    border-left: 3px solid
      ${({ $waiter, $status }) => ($waiter ? "#0ea5e9" : getStatusColor($status).base)};
    border-radius: 12px;
    background: ${({ $active, $waiter, $status }) => {
      if ($waiter)
        return "linear-gradient(180deg, rgba(14, 165, 233, 0.1), var(--surface))";
      return $active
        ? `linear-gradient(180deg, ${getStatusColor($status).soft}, var(--surface))`
        : "var(--surface)";
    }};
    padding: 12px 12px 12px 13px;
    transition: transform 0.16s ease, box-shadow 0.18s ease,
      border-color 0.16s ease, background 0.18s ease;
    box-shadow: ${({ $active, $waiter, $status }) =>
      $active
        ? `0 0 0 1.5px ${$waiter ? "rgba(14, 165, 233, 0.42)" : getStatusColor($status).ring}`
        : "0 1px 2px rgba(28, 25, 23, 0.04)"};

    strong {
      font-size: 14.5px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    &:hover {
      transform: translateY(-2px);
      border-color: ${({ $waiter, $status }) =>
        $waiter ? "rgba(14, 165, 233, 0.5)" : getStatusColor($status).ring};
      border-left-color: ${({ $waiter, $status }) =>
        $waiter ? "#0ea5e9" : getStatusColor($status).base};
      background: ${({ $active, $waiter, $status }) => {
        if ($waiter)
          return "linear-gradient(180deg, rgba(14, 165, 233, 0.1), var(--surface))";
        return $active
          ? `linear-gradient(180deg, ${getStatusColor($status).soft}, var(--surface))`
          : "var(--surface)";
      }};
      box-shadow: 0 10px 24px
        ${({ $waiter, $status }) =>
          $waiter ? "rgba(14, 165, 233, 0.18)" : getStatusColor($status).soft};
    }
  }
`;

const DetailsPane = styled.aside`
  ${cardPanel}
  border-radius: var(--radius-lg);
  padding: 24px;
  position: sticky;
  top: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;

  @media (max-width: 1180px) {
    padding: 18px;
    gap: 12px;
  }

  @media (max-width: 900px) {
    padding: 14px;
  }

  @media (max-width: 760px) {
    position: absolute;
    inset: 0;
    z-index: 5;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    transform: translateX(${({ $mobileOpen }) => ($mobileOpen ? "0" : "100%")});
    opacity: ${({ $mobileOpen }) => ($mobileOpen ? 1 : 0)};
    visibility: ${({ $mobileOpen }) => ($mobileOpen ? "visible" : "hidden")};
    transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.28s ease, visibility 0.32s;
    box-shadow: -18px 0 40px rgba(2, 6, 23, 0.28);
  }

  [data-theme="light"] & {
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border: 1px solid var(--orders-container-border);
    box-shadow: none;

    @media (max-width: 760px) {
      background: var(--orders-bg);
    }
  }
`;

const MobileBackBar = styled.div`
  display: none;

  @media (max-width: 760px) {
    display: flex;
    flex-shrink: 0;
    align-items: center;
  }
`;

const MobileBackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--orders-container-border);
  background: var(--surface);
  color: var(--orders-text);
  border-radius: 999px;
  padding: 7px 14px 7px 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    border-color: var(--sidebar-orange);
    background: color-mix(in srgb, var(--sidebar-orange) 10%, var(--surface));
  }
`;

const DetailCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  flex: 1;
  min-height: 0;
  ${cardItem}
  border-color: var(--orders-container-border);

  @media (max-width: 1180px) {
    padding: 16px;
    gap: 14px;
  }

  @media (max-width: 760px) {
    padding: 16px;
  }

  [data-theme="light"] & {
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(24px) saturate(140%);
    -webkit-backdrop-filter: blur(24px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.9);
    border-radius: 16px;
    box-shadow:
      0 2px 4px rgba(17, 24, 39, 0.05),
      0 10px 24px rgba(17, 24, 39, 0.08),
      0 24px 48px rgba(17, 24, 39, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.95),
      inset 0 -1px 0 rgba(255, 255, 255, 0.4);
  }
`;

const DetailBody = styled.div`
  display: grid;
  gap: 18px;
  align-content: start;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  @media (max-width: 1180px) {
    gap: 14px;
  }
`;

const OrderLogsBlock = styled.div`
  padding: 14px;
  flex-shrink: 0;
  ${cardItem}
  border-color: var(--orders-container-border);

  [data-theme="light"] & {
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(24px) saturate(140%);
    -webkit-backdrop-filter: blur(24px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.9);
    border-radius: 16px;
    box-shadow:
      0 2px 4px rgba(17, 24, 39, 0.05),
      0 10px 24px rgba(17, 24, 39, 0.08),
      0 24px 48px rgba(17, 24, 39, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.95),
      inset 0 -1px 0 rgba(255, 255, 255, 0.4);
  }
`;

const OrderLogsHeader = styled.button`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  font: inherit;
  color: inherit;
`;

const OrderLogsTitle = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: var(--orders-text);
`;

const OrderLogsContent = styled.div`
  margin-top: 8px;
`;

const OrderLogRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  font-size: 14px;
  border-bottom: 1px dashed var(--container-border-subtle);

  &:last-child {
    border-bottom: none;
  }
`;

const OrderLogLabel = styled.span`
  color: var(--text-muted);
`;

const OrderLogTime = styled.span`
  color: var(--orders-text);
`;

const TimerCircle = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  min-width: 42px;
  min-height: 42px;
  border-radius: 50%;
  border: 2px ${({ $borderStyle }) => $borderStyle} ${({ $borderColor }) => $borderColor};
  background: ${({ $bg }) => $bg};
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
`;

const TimerCircleText = styled.span`
  color: ${({ $color, $green }) => ($green ? "#22c55e" : $color ?? "inherit")};
`;

const TimerFinishedWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
`;

const ReadyCircleOuter = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ReadyCircle = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #22c55e;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const TimerCheckmark = styled.svg`
  width: 16px;
  height: 16px;
  color: #22c55e;
`;

const TimerLabel = styled.span`
  font-size: 9px;
  font-weight: 600;
  color: #22c55e;
`;

const DetailHeader = styled.div`
  display: grid;
  gap: 10px;
  font-size: 15px;
  padding: 0 0 14px;
  border-bottom: 1px solid var(--container-border-subtle);

  @media (max-width: 1180px) {
    gap: 6px;
    padding-bottom: 8px;
  }
`;

const EmptyState = styled.p`
  margin: 0;
  color: var(--orders-text);
  opacity: 0.7;
`;

const DetailsEmpty = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 14px;
  padding: 24px;
`;

const EmptyIconRing = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  color: var(--sidebar-orange);
  background: color-mix(in srgb, var(--sidebar-orange) 12%, var(--surface));
  border: 1px solid var(--container-border);

  svg {
    width: 34px;
    height: 34px;
  }

  [data-theme="light"] & {
    background: color-mix(in srgb, var(--sidebar-orange) 8%, #ffffff);
    border-color: color-mix(in srgb, var(--sidebar-orange) 18%, transparent);
    box-shadow: 0 10px 24px rgba(255, 102, 0, 0.1);
  }
`;

const EmptyTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--orders-text);
`;

const EmptyText = styled.p`
  margin: 0;
  max-width: 300px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-muted);
`;

const List = styled.div`
  display: grid;
  gap: 16px;
`;

const OrderTag = styled.span`
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--sidebar-orange);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
`;

const OrderTopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const OrderTagWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const OrderStatusPill = styled.span`
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: capitalize;
  color: ${({ $status }) =>
    $status === "finish" ? "#16a34a" : $status === "ready" ? "#059669" : $status === "accepted" ? "#2563eb" : "#ea580c"};
  background: ${({ $status }) =>
    $status === "finish"
      ? "rgba(22, 163, 74, 0.15)"
      : $status === "ready"
        ? "rgba(5, 150, 105, 0.15)"
        : $status === "accepted"
          ? "rgba(37, 99, 235, 0.15)"
          : "rgba(234, 88, 12, 0.15)"};
  border: 1px solid
    ${({ $status }) =>
      $status === "finish"
        ? "rgba(22, 163, 74, 0.35)"
        : $status === "ready"
          ? "rgba(5, 150, 105, 0.35)"
          : $status === "accepted"
            ? "rgba(37, 99, 235, 0.35)"
            : "rgba(234, 88, 12, 0.35)"};
`;

const TableBadge = styled.div`
  display: grid;
  justify-items: end;
  align-content: start;
  gap: 3px;
  min-width: 0;
  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--surface-2) 70%, var(--surface));

  @media (max-width: 1180px) {
    padding: 4px 10px;
  }

  [data-theme="light"] & {
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(12px) saturate(130%);
    -webkit-backdrop-filter: blur(12px) saturate(130%);
    border: 1px solid rgba(255, 255, 255, 0.78);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }
`;

const TableBadgeRow = styled.div`
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  line-height: 1;
`;

const TableBadgeEyebrow = styled.span`
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
`;

const TableBadgePrimary = styled.span`
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--orders-text);

  @media (max-width: 1180px) {
    font-size: 16px;
  }
`;

const TableBadgeSecondary = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  line-height: 1.2;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ToggleButton = styled.button`
  border: 1px solid var(--container-border);
  background: var(--button-overlay);
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--orders-text);
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: var(--sidebar-orange);
    background: rgba(255, 102, 0, 0.12);
    transform: translateY(-1px);
    box-shadow: 0 6px 14px rgba(255, 102, 0, 0.15);
  }
`;

const ChevronIcon = styled.svg`
  width: 18px;
  height: 18px;
  transition: transform 0.2s ease, color 0.2s ease;
  transform: rotate(${({ $open }) => ($open ? "0deg" : "-90deg")});
  color: ${({ $open }) => ($open ? "var(--sidebar-orange)" : "var(--orders-text)")};
`;

const Items = styled.div`
  display: grid;
  gap: 0;
  margin-bottom: 12px;
  padding: 14px;
  border: 1px solid var(--orders-container-border);
  border-radius: 14px;
  background: var(--surface);

  @media (max-width: 1180px) {
    padding: 10px 12px;
    margin-bottom: 8px;
  }

  [data-theme="light"] & {
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(16px) saturate(130%);
    -webkit-backdrop-filter: blur(16px) saturate(130%);
    border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
  }
`;

const CommentBlock = styled.div`
  display: grid;
  gap: 4px;
  background: var(--surface-2);
  border-radius: 12px;
  padding: 13px 14px;
  color: var(--orders-text);
  border: 1px solid var(--container-border-subtle);

  strong {
    font-size: 13px;
    color: var(--orders-text);
  }

  [data-theme="light"] & {
    position: relative;
    gap: 5px;
    margin-top: -24px;
    margin-bottom: 13px;
    background: color-mix(in srgb, var(--sidebar-orange) 6%, #ffffff);
    border: 1px solid color-mix(in srgb, var(--sidebar-orange) 18%, transparent);
    border-radius: 12px;
    padding: 8px 14px 12px 17px;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    box-shadow: none;

    @media (max-width: 760px) {
      margin-top: -12 px;
    }
  }

  [data-theme="light"] &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 9px;
    bottom: 9px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--sidebar-orange);
  }

  [data-theme="light"] & strong {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--sidebar-orange) 70%, var(--text-muted));
  }

  [data-theme="light"] & span {
    font-size: 14px;
    line-height: 1.45;
    color: var(--orders-text);
  }
`;

const ItemRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  font-size: 15px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--container-border-subtle);

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  [data-theme="light"] & {
    padding: 2px 0;
    border-bottom: 1px solid rgba(120, 113, 108, 0.14);
  }

  [data-theme="light"] &:first-child {
    padding-top: 0;
  }

  [data-theme="light"] &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const ItemName = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--orders-text);

  [data-theme="light"] & {
    font-weight: 600;
    letter-spacing: -0.01em;
  }
`;

const QtyBadge = styled.span`
  font-size: 12px;
  color: var(--sidebar-orange);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
`;

const LineTotal = styled.span`
  font-weight: 600;
  font-size: 16px;
  color: var(--orders-text);

  [data-theme="light"] & {
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
`;

const LineTotalWrap = styled.div`
  display: grid;
  justify-items: end;
  gap: 2px;
`;

const LinePrice = styled.span`
  font-size: 12px;
  color: var(--text-muted);

  [data-theme="light"] & {
    font-variant-numeric: tabular-nums;
  }
`;

const OrderTotal = styled.div`
  display: grid;
  justify-items: end;
  gap: 2px;
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 17px;
  padding-top: 14px;
  border-top: 1px solid var(--container-border-strong);
  color: var(--orders-text);

  strong {
    font-size: 24px;
    line-height: 1;
    letter-spacing: 0.01em;
  }

  @media (max-width: 1180px) {
    padding-top: 10px;
    margin-bottom: 8px;

    strong {
      font-size: 21px;
    }
  }
`;

const Actions = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: auto;
  flex-shrink: 0;
  padding-top: 4px;
`;

const ActionButton = styled.button`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--sidebar-orange) 70%, #fff 18%);
  background: color-mix(in srgb, var(--sidebar-orange) 22%, var(--surface));
  color: #ffffff;
  border-radius: 999px;
  padding: 7px 16px;
  cursor: pointer;
  flex: 1;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1.15;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-shadow: 0 1px 1px rgba(28, 25, 23, 0.22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28);
  transition: border-color 0.15s ease;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 0;
    transform: translateX(0);
    background: var(--sidebar-orange);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28);
    pointer-events: none;
  }

  ${({ $sweeping }) =>
    $sweeping &&
    css`
      border-color: color-mix(in srgb, var(--sidebar-orange) 45%, var(--orders-container-border));
      pointer-events: none;

      &::before {
        animation: ${actionSwipeFill} ${ACTION_SWIPE_MS}ms cubic-bezier(0.33, 1, 0.32, 1) forwards;
      }
    `}

  &:hover:not(:disabled):not([disabled]) {
    border-color: var(--primary-strong);

    &::before {
      background: var(--primary-strong);
    }
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  [data-theme="light"] & {
    border: 1px solid color-mix(in srgb, var(--sidebar-orange) 62%, rgba(0, 0, 0, 0.12));
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
    transform: translateY(0);
    transition: box-shadow 0.24s ease, transform 0.2s ease;
    box-shadow:
      0 2px 3px rgba(17, 24, 39, 0.06),
      0 6px 12px rgba(17, 24, 39, 0.09),
      0 12px 22px rgba(17, 24, 39, 0.07);
  }

  [data-theme="light"] &::before {
    background:
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.24) 0%,
        rgba(255, 255, 255, 0) 52%
      ),
      var(--sidebar-orange);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
  }

  [data-theme="light"] &:hover:not(:disabled):not([disabled])::before {
    background:
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.24) 0%,
        rgba(255, 255, 255, 0) 52%
      ),
      var(--sidebar-orange);
  }

  [data-theme="light"] &:hover:not(:disabled):not([disabled]) {
    transform: translateY(0);
    border-color: color-mix(in srgb, var(--sidebar-orange) 62%, rgba(0, 0, 0, 0.12));
    box-shadow:
      0 2px 3px rgba(17, 24, 39, 0.06),
      0 6px 12px rgba(17, 24, 39, 0.09),
      0 12px 22px rgba(17, 24, 39, 0.07);
  }

  [data-theme="light"] &:active:not(:disabled):not([disabled]) {
    transform: translateY(1px);
    box-shadow:
      0 1px 2px rgba(17, 24, 39, 0.1),
      0 3px 8px rgba(17, 24, 39, 0.12);

    &::before {
      box-shadow: inset 0 1px 2px rgba(120, 36, 0, 0.22);
    }
  }
`;

const ActionButtonLabel = styled.span`
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.03em;
`;

const buttonLoaderPulse = keyframes`
  0%, 80%, 100% { opacity: 0.35; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-2px); }
`;

const ButtonLoader = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 3.2em;
`;

const ButtonLoaderDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(28, 25, 23, 0.12);
  animation: ${buttonLoaderPulse} 0.9s ease-in-out infinite;

  &:nth-child(2) {
    animation-delay: 0.15s;
  }

  &:nth-child(3) {
    animation-delay: 0.3s;
  }
`;

const DeleteButton = styled.button`
  border: 1px solid color-mix(in srgb, var(--danger) 55%, var(--orders-container-border));
  background: transparent;
  color: var(--danger);
  border-radius: 999px;
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 700;
  width: 100%;
  box-shadow: none;
  transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    border-color: var(--danger);
  }
`;

export default Orders;
