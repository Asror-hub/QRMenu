import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import styled, { keyframes, css } from "styled-components";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../services/supabase";
import { formatCurrency } from "../utils/currency";
import { hasPlanFeature } from "../utils/planFeatures";
import { upsertCanonical, upsertMeta } from "../utils/seo";
import {
  getDayLabels,
  getLocale,
  normalizeLang,
  readStoredLanguage,
  statusLabel,
  storeLanguage,
  t as translate
} from "../i18n";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const roundRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const wrapCanvasText = (ctx, text, maxWidth) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return ["—"];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
};

const createUuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
};

const asSoldOut = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "t" || normalized === "on") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "f" || normalized === "off") {
      return false;
    }
  }
  if (typeof value === "number") return value !== 0;
  return false;
};

const feedbackShownKey = (orderId) => `qrmenu_feedback_shown_${orderId}`;

const placedOrdersKey = (deviceId) => `qrmenu_placed_orders_${deviceId}`;

const readPlacedOrderIds = (deviceId) => {
  if (!deviceId) return new Set();
  try {
    const raw = localStorage.getItem(placedOrdersKey(deviceId));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch {
    return new Set();
  }
};

const rememberPlacedOrder = (deviceId, orderId) => {
  if (!deviceId || !orderId) return;
  try {
    const next = readPlacedOrderIds(deviceId);
    next.add(orderId);
    localStorage.setItem(placedOrdersKey(deviceId), JSON.stringify([...next]));
  } catch {
    // ignore storage errors
  }
};

const didThisDevicePlaceOrder = (deviceId, orderId) => {
  if (!deviceId || !orderId) return false;
  return readPlacedOrderIds(deviceId).has(orderId);
};

const isWaiterCallOrder = (order) =>
  (order?.items ?? []).some((item) => item?.type === "waiter_call");

const hasFeedbackBeenShown = (orderId) => {
  if (!orderId) return true;
  try {
    return localStorage.getItem(feedbackShownKey(orderId)) === "1";
  } catch {
    return false;
  }
};

const markFeedbackShown = (orderId) => {
  if (!orderId) return;
  try {
    localStorage.setItem(feedbackShownKey(orderId), "1");
  } catch {
    // ignore storage errors
  }
};

function PrepTimerDisplay({ order, prepTimeMins, language, tick }) {
  const startMs = order.createdAt ?? order.acceptedAt ?? 0;
  if (!startMs || prepTimeMins == null || prepTimeMins < 0) {
    return (
      <TimerBadge $state="neutral">
        <TimerText>—</TimerText>
      </TimerBadge>
    );
  }
  if (order.status === "ready") {
    return (
      <TimerBadge $state="ready">
        <TimerText $ready>{translate(language, "statusReady")}</TimerText>
      </TimerBadge>
    );
  }
  if (order.status === "finish") {
    return (
      <TimerFinishedWrap>
        <TimerBadge $state="ready">
          <TimerCheckmark viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </TimerCheckmark>
        </TimerBadge>
        <TimerLabel>{translate(language, "statusFinished")}</TimerLabel>
      </TimerFinishedWrap>
    );
  }
  // `tick` forces a re-render each second from the parent interval.
  void tick;
  const target = Number(startMs) + Number(prepTimeMins) * 60 * 1000;
  const now = Date.now();
  const secsLeft = Math.floor((target - now) / 1000);
  let text = "—";
  let isOvertime = false;
  let isOver15 = false;
  if (secsLeft > 0) {
    const totalMins = Math.floor(secsLeft / 60);
    if (totalMins >= 60) {
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      text = `${h}:${m.toString().padStart(2, "0")}`;
    } else {
      const s = secsLeft % 60;
      text = `${totalMins}:${s.toString().padStart(2, "0")}`;
    }
  } else {
    const overtimeSecs = Math.abs(secsLeft);
    const totalMins = Math.floor(overtimeSecs / 60);
    isOvertime = true;
    isOver15 = totalMins >= 15;
    if (totalMins >= 60) {
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      text = `${h}:${m.toString().padStart(2, "0")}`;
    } else {
      const s = overtimeSecs % 60;
      text = `${totalMins}:${s.toString().padStart(2, "0")}`;
    }
  }
  const state = isOver15 ? "over15" : isOvertime ? "overtime" : "countdown";
  return (
    <TimerBadge $state={state}>
      <TimerText style={{ color: isOver15 ? "#ef4444" : isOvertime ? "#f97316" : "#0f172a" }}>{text}</TimerText>
    </TimerBadge>
  );
}

const CustomerMenu = () => {
  const {
    restaurantId: routeRestaurantId,
    tableId: routeTableId,
    restaurantRef
  } = useParams();
  const tableId = routeTableId || null;
  const isDineIn = Boolean(tableId);
  const [restaurantId, setRestaurantId] = useState(routeRestaurantId || null);
  const [deviceId] = useState(() => {
    try {
      const existing = localStorage.getItem("qrmenu_device_id");
      if (existing) return existing;
      const next =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("qrmenu_device_id", next);
      return next;
    } catch {
      return `dev_${Date.now()}`;
    }
  });
  const sessionKey = useMemo(() => {
    if (tableId) return tableId;
    if (restaurantId) return `site_${restaurantId}_${deviceId}`;
    return null;
  }, [tableId, restaurantId, deviceId]);

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [restaurantName, setRestaurantName] = useState("Menu");
  const [restaurantProfile, setRestaurantProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    instagram: "",
    facebook: "",
    prepTime: 15,
    currency: "USD",
    stripeEnabled: false
  });
  const [restaurantHours, setRestaurantHours] = useState([]);
  const [planId, setPlanId] = useState(null);
  const [restaurantLoaded, setRestaurantLoaded] = useState(false);
  const [tableNumber, setTableNumber] = useState(null);
  const [tableName, setTableName] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState({});
  const statusTimersRef = useRef({});
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [language, setLanguage] = useState(() => readStoredLanguage());
  const t = useCallback((key, vars) => translate(language, key, vars), [language]);
  const locale = useMemo(() => getLocale(language), [language]);
  const dayLabels = useMemo(() => getDayLabels(language), [language]);
  const money = useCallback(
    (amount) => formatCurrency(amount, restaurantProfile.currency, locale),
    [restaurantProfile.currency, locale]
  );

  // Website-only: menu vs reserve; delivery/pickup chosen in cart → checkout modal
  const [websiteScreen, setWebsiteScreen] = useState("menu"); // menu | reserve
  const [websiteFulfillment, setWebsiteFulfillment] = useState("delivery"); // delivery | pickup
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [reserveFirstName, setReserveFirstName] = useState("");
  const [reserveSurname, setReserveSurname] = useState("");
  const [reservePhone, setReservePhone] = useState("");
  const [reserveGuests, setReserveGuests] = useState("2");
  const [reserveDate, setReserveDate] = useState("");
  const [reserveTime, setReserveTime] = useState("");
  const [reserveEndTime, setReserveEndTime] = useState("");
  const [reserveNotes, setReserveNotes] = useState("");
  const [reservationConfirm, setReservationConfirm] = useState(null);
  const [ticketPhotoUrl, setTicketPhotoUrl] = useState(null);
  const [savingTicketPhoto, setSavingTicketPhoto] = useState(false);
  const reservationTicketRef = useRef(null);
  const reservationQrRef = useRef(null);

  useEffect(() => {
    storeLanguage(language);
  }, [language]);

  const [showCart, setShowCart] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [sheetOffset, setSheetOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragStartRef = useRef(null);
  const sheetRef = useRef(null);
  const footerRef = useRef(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});
  const [statusLoading, setStatusLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payOrderForModal, setPayOrderForModal] = useState(null);
  const [receiptWanted, setReceiptWanted] = useState(false);
  const [receiptEmail, setReceiptEmail] = useState("");
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [waiterNotice, setWaiterNotice] = useState("");
  const [waiterCooldownUntil, setWaiterCooldownUntil] = useState(0);
  const [timerTick, setTimerTick] = useState(0);
  const [focusedPendingOrderId, setFocusedPendingOrderId] = useState(null);
  const [acceptanceNotice, setAcceptanceNotice] = useState(null);
  const [feedbackNotice, setFeedbackNotice] = useState(null);
  const [foodRating, setFoodRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackThanks, setFeedbackThanks] = useState(false);
  const feedbackPromptedRef = useRef(new Set());

  useEffect(() => {
    const id = setInterval(() => setTimerTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const setView = (next) => {
    setShowStatus(next);
    if (!next) {
      setFocusedPendingOrderId(null);
      setAcceptanceNotice(null);
    }
    if (!sessionKey) return;
    localStorage.setItem(`qrmenu_view_${sessionKey}`, next ? "status" : "menu");
  };

  const openAllOrders = () => {
    setFocusedPendingOrderId(null);
    setAcceptanceNotice(null);
    setView(true);
  };

  const continueAfterAcceptance = () => {
    setAcceptanceNotice(null);
    setFocusedPendingOrderId(null);
    setShowStatus(true);
    if (sessionKey) {
      localStorage.setItem(`qrmenu_view_${sessionKey}`, "status");
    }
  };

  const openFeedbackPrompt = (order) => {
    if (!order?.orderId || !restaurantId) return;
    // Only the device that placed this exact order may be asked for feedback.
    if (!didThisDevicePlaceOrder(deviceId, order.orderId)) return;
    if (isWaiterCallOrder(order)) return;
    if (hasFeedbackBeenShown(order.orderId)) return;
    if (feedbackPromptedRef.current.has(order.orderId)) return;
    if (feedbackNotice?.orderId === order.orderId) return;
    feedbackPromptedRef.current.add(order.orderId);
    setFoodRating(0);
    setServiceRating(0);
    setFeedbackComment("");
    setFeedbackError("");
    setFeedbackThanks(false);
    setFeedbackNotice({
      orderId: order.orderId,
      orderNumber: order.orderNumber ?? null,
      restaurantId,
      tableId: tableId || null,
    });
  };
  const openFeedbackPromptRef = useRef(openFeedbackPrompt);
  openFeedbackPromptRef.current = openFeedbackPrompt;

  const dismissFeedback = () => {
    if (feedbackNotice?.orderId) {
      markFeedbackShown(feedbackNotice.orderId);
    }
    setFeedbackNotice(null);
    setFeedbackError("");
    setFeedbackThanks(false);
    setFeedbackSubmitting(false);
  };

  const submitFeedback = async () => {
    if (!feedbackNotice?.orderId || !feedbackNotice.restaurantId) return;
    if (foodRating < 1 || serviceRating < 1) {
      setFeedbackError(t("feedbackRateBoth"));
      return;
    }
    setFeedbackSubmitting(true);
    setFeedbackError("");
    const { error } = await supabase.from("order_feedbacks").insert({
      order_id: feedbackNotice.orderId,
      restaurant_id: feedbackNotice.restaurantId,
      table_id: feedbackNotice.tableId,
      order_number: feedbackNotice.orderNumber,
      food_rating: foodRating,
      service_rating: serviceRating,
      comment: feedbackComment.trim() || null,
    });
    setFeedbackSubmitting(false);
    if (error) {
      // Unique violation = already submitted — treat as success.
      if (error.code === "23505") {
        markFeedbackShown(feedbackNotice.orderId);
        setFeedbackThanks(true);
        return;
      }
      setFeedbackError(error.message || t("feedbackSubmitFailed"));
      return;
    }
    markFeedbackShown(feedbackNotice.orderId);
    setFeedbackThanks(true);
  };

  const persistOrders = (orders) => {
    if (!sessionKey) return;
    if (!orders.length) {
      localStorage.removeItem(`qrmenu_orders_${sessionKey}`);
      localStorage.removeItem(`qrmenu_view_${sessionKey}`);
      return;
    }
    localStorage.setItem(`qrmenu_orders_${sessionKey}`, JSON.stringify({ orders }));
  };

  const updateOrders = (updater) => {
    setActiveOrders((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persistOrders(next);
      if (!next.length) {
        setView(false);
      }
      return next;
    });
  };

  const normalizeOrders = (orders) =>
    orders.map((order) => {
      const status = order.status ?? "pending";
      const acceptedAt = status === "accepted" ? (order.acceptedAt ?? Date.now()) : (order.acceptedAt ?? null);
      const displayStatus =
        status === "accepted" ? order.displayStatus ?? "accepted" : status;
      return {
        ...order,
        status,
        acceptedAt,
        displayStatus,
        paymentStatus: order.paymentStatus ?? order.payment_status ?? null,
        createdAt: order.createdAt ?? null
      };
    });

  const mapDbOrderToUiOrder = useCallback((order) => {
    const status = order.status ?? "pending";
    const acceptedAtMs = order.accepted_at
      ? new Date(order.accepted_at).getTime()
      : status === "accepted"
        ? Date.now()
        : null;
    const createdAtMs = order.created_at ? new Date(order.created_at).getTime() : Date.now();
    return {
      orderId: order.id,
      orderNumber: order.order_number,
      status,
      displayStatus: status === "accepted" ? "accepted" : status,
      acceptedAt: acceptedAtMs,
      createdAt: createdAtMs,
      paymentStatus: order.payment_status ?? null,
      items: Array.isArray(order.items) ? order.items : [],
      comment: order.comment ?? "",
      orderType: order.order_type ?? null
    };
  }, []);

  const activeOrdersRef = useRef([]);
  useEffect(() => {
    activeOrdersRef.current = activeOrders;
  }, [activeOrders]);

  // Migrate older website order cache (shared per restaurant) into device-scoped key once.
  useEffect(() => {
    if (isDineIn || !restaurantId || !deviceId) return;
    const nextKey = `qrmenu_orders_site_${restaurantId}_${deviceId}`;
    const legacyKey = `qrmenu_orders_site_${restaurantId}`;
    try {
      if (localStorage.getItem(nextKey) || !localStorage.getItem(legacyKey)) return;
      localStorage.setItem(nextKey, localStorage.getItem(legacyKey));
      const legacyView = localStorage.getItem(`qrmenu_view_site_${restaurantId}`);
      if (legacyView && !localStorage.getItem(`qrmenu_view_site_${restaurantId}_${deviceId}`)) {
        localStorage.setItem(`qrmenu_view_site_${restaurantId}_${deviceId}`, legacyView);
      }
    } catch {
      // ignore
    }
  }, [isDineIn, restaurantId, deviceId]);

  useEffect(() => {
    const loadMenu = async () => {
      const ref = String(restaurantRef || routeRestaurantId || "").trim();
      if (!ref) return;
      if (isDineIn && !tableId) return;

      let restaurantQuery = supabase
        .from("restaurants")
        .select("id, name, email, phone, address, instagram, facebook, prep_time, currency, stripe_enabled, slug, plan_id");

      if (UUID_RE.test(ref)) {
        restaurantQuery = restaurantQuery.eq("id", ref);
      } else {
        restaurantQuery = restaurantQuery.eq("slug", ref.toLowerCase());
      }

      const { data: restaurantData, error: restaurantError } = await restaurantQuery.maybeSingle();

      if (restaurantError) {
        // eslint-disable-next-line no-console
        console.warn("Failed to load restaurant:", restaurantError.message);
      }

      if (!restaurantData?.id) {
        setRestaurantId(null);
        setPlanId(null);
        setRestaurantLoaded(true);
        setRestaurantName(t("menuFallback"));
        return;
      }

      const resolvedId = restaurantData.id;
      setRestaurantId(resolvedId);
      setPlanId(restaurantData.plan_id ?? "ordering");
      setRestaurantLoaded(true);

      setRestaurantName(restaurantData?.name ?? t("menuFallback"));
      setRestaurantProfile({
        name: restaurantData?.name ?? "",
        email: restaurantData?.email ?? "",
        phone: restaurantData?.phone ?? "",
        address: restaurantData?.address ?? "",
        instagram: restaurantData?.instagram ?? "",
        facebook: restaurantData?.facebook ?? "",
        prepTime: Number.isFinite(Number(restaurantData?.prep_time))
          ? Number(restaurantData.prep_time)
          : 15,
        currency: restaurantData?.currency ?? "USD",
        stripeEnabled: restaurantData?.stripe_enabled ?? false
      });

      if (tableId) {
        const { data: tableData, error: tableError } = await supabase
          .from("tables")
          .select("table_number, table_name")
          .eq("id", tableId)
          .eq("restaurant_id", resolvedId)
          .maybeSingle();

        if (tableError) {
          // eslint-disable-next-line no-console
          console.warn("Failed to load table:", tableError.message);
        }

        setTableNumber(tableData?.table_number ?? null);
        setTableName(tableData?.table_name ?? "");
      } else {
        setTableNumber(null);
        setTableName("");
      }

      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("*")
        .eq("restaurant_id", resolvedId)
        .eq("available", true)
        .order("order_index", { ascending: true });

      if (categoryError) {
        // eslint-disable-next-line no-console
        console.warn("Failed to load categories:", categoryError.message);
      }

      const { data: itemData, error: itemError } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", resolvedId)
        .eq("available", true)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      if (itemError) {
        // eslint-disable-next-line no-console
        console.warn("Failed to load menu items:", itemError.message);
      }

      const { data: hoursData, error: hoursError } = await supabase
        .from("restaurant_hours")
        .select("day_of_week, open_time, close_time, closed")
        .eq("restaurant_id", resolvedId)
        .order("day_of_week", { ascending: true });

      if (hoursError) {
        // eslint-disable-next-line no-console
        console.warn("Failed to load hours:", hoursError.message);
      }

      const activeCategoryIds = new Set((categoryData ?? []).map((category) => category.id));
      const visibleItems = (itemData ?? []).filter(
        (item) => !item.category_id || activeCategoryIds.has(item.category_id)
      );

      setCategories(categoryData ?? []);
      setMenuItems(visibleItems);
      setRestaurantHours(hoursData ?? []);
      setCart((prev) =>
        prev.filter((entry) => {
          const match = visibleItems.find((item) => item.id === entry.id);
          return match && !asSoldOut(match.sold_out);
        })
      );
    };

    loadMenu();
  }, [restaurantRef, routeRestaurantId, tableId, isDineIn, t]);

  useEffect(() => {
    if (!sessionKey) return;
    const stored = localStorage.getItem(`qrmenu_cart_${sessionKey}`);
    if (stored) {
      setCart(JSON.parse(stored));
    } else {
      setCart([]);
    }
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;
    localStorage.setItem(`qrmenu_cart_${sessionKey}`, JSON.stringify(cart));
  }, [cart, sessionKey]);

  useEffect(() => {
    if (!selectedItem) return;
    const existing = cart.find((entry) => entry.id === selectedItem.id);
    setModalQuantity(existing?.quantity ?? 1);
  }, [selectedItem, cart]);

  useEffect(() => {
    if (!selectedItem) {
      setSheetOpen(false);
      return;
    }
    const id = requestAnimationFrame(() => setSheetOpen(true));
    return () => cancelAnimationFrame(id);
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [selectedItem]);

  useEffect(() => {
    if (!menuOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [menuOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderPaidId = params.get("order_id");
    const orderPaid = params.get("order_paid") === "1";
    if (orderPaid && orderPaidId && didThisDevicePlaceOrder(deviceId, orderPaidId)) {
      const existing = activeOrdersRef.current.find((o) => o.orderId === orderPaidId);
      if (existing) {
        openFeedbackPrompt({ ...existing, status: "finish" });
      } else {
        openFeedbackPrompt({
          orderId: orderPaidId,
          orderNumber: null,
          items: [],
        });
      }
      updateOrders((prev) =>
        prev
          .map((o) =>
            o.orderId === orderPaidId
              ? { ...o, status: "finish", displayStatus: "Paid", paymentStatus: "paid" }
              : o
          )
          .filter((o) => o.orderId !== orderPaidId)
      );
      window.history.replaceState({}, "", window.location.pathname);
    } else if (orderPaid) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    const cancelled = params.get("payment_cancelled") === "1";
    if (cancelled) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionKey) return;
    const stored = localStorage.getItem(`qrmenu_orders_${sessionKey}`);
    const viewState = localStorage.getItem(`qrmenu_view_${sessionKey}`);
    // Restore cached orders for instant UI; backend sync is the source of truth.
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const nextOrders = normalizeOrders(parsed.orders ?? []).filter(
          (order) => order.status !== "finish"
        );
        if (nextOrders.length) {
          setActiveOrders(nextOrders);
          if (viewState) {
            setShowStatus(viewState === "status");
          }
        }
      } catch {
        // ignore corrupt cache
      }
    }
  }, [sessionKey]);

  useEffect(() => {
    if (!restaurantId || !sessionKey) return;
    let cancelled = false;

    const syncOrdersFromBackend = async () => {
      let query = supabase
        .from("orders")
        .select(
          "id, order_number, status, accepted_at, created_at, payment_status, items, comment, order_type"
        )
        .eq("restaurant_id", restaurantId)
        .neq("status", "finish")
        .is("archived_at", null)
        .order("created_at", { ascending: true });

      if (tableId) {
        query = query.eq("table_id", tableId);
      } else {
        const knownIdSet = new Set(
          (activeOrdersRef.current ?? []).map((order) => order.orderId).filter(Boolean)
        );
        try {
          const stored = localStorage.getItem(`qrmenu_orders_${sessionKey}`);
          const parsed = stored ? JSON.parse(stored) : null;
          (parsed?.orders ?? []).forEach((order) => {
            if (order?.orderId) knownIdSet.add(order.orderId);
          });
        } catch {
          // ignore
        }
        const knownIds = [...knownIdSet];
        if (!knownIds.length) {
          return;
        }
        query = query.in("id", knownIds);
      }

      const { data, error } = await query;

      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("Failed to sync table orders:", error.message);
        return;
      }
      const nextOrders = (data ?? []).map(mapDbOrderToUiOrder);
      const nextIdSet = new Set(nextOrders.map((order) => order.orderId));
      // Finished orders disappear from the guest query (RLS + .neq finish).
      // Detect that transition here so we can ask for feedback.
      (activeOrdersRef.current ?? []).forEach((order) => {
        if (!nextIdSet.has(order.orderId)) {
          openFeedbackPromptRef.current(order);
        }
      });
      // Website sessions are device-scoped — treat synced ids as placed here.
      if (!tableId) {
        nextOrders.forEach((order) => rememberPlacedOrder(deviceId, order.orderId));
      }
      updateOrders(nextOrders);
    };

    syncOrdersFromBackend();
    const intervalId = window.setInterval(syncOrdersFromBackend, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [restaurantId, tableId, sessionKey, mapDbOrderToUiOrder, deviceId]);

  useEffect(() => {
    setExpandedOrders((prev) => {
      if (!activeOrders.length) {
        return Object.keys(prev).length ? {} : prev;
      }

      const ids = activeOrders.map((order) => order.orderId);
      const idSet = new Set(ids);
      const latestId = ids[ids.length - 1];
      const hasNewOrder = ids.some((id) => !Object.prototype.hasOwnProperty.call(prev, id));
      const prevHadVisible = Object.keys(prev).some((id) => idSet.has(id));

      // First load or a newly placed order: only the latest (top) order is open.
      if (hasNewOrder || !prevHadVisible) {
        const next = {};
        ids.forEach((id) => {
          next[id] = id === latestId;
        });
        return next;
      }

      const next = {};
      let changed = false;
      ids.forEach((id) => {
        next[id] = prev[id];
      });
      Object.keys(prev).forEach((id) => {
        if (!idSet.has(id)) changed = true;
      });
      if (!changed && Object.keys(prev).length === ids.length) {
        return prev;
      }
      return next;
    });
  }, [activeOrders]);

  const toggleOrder = (id) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (!focusedPendingOrderId || acceptanceNotice) return;
    const focused = activeOrders.find((order) => order.orderId === focusedPendingOrderId);
    if (!focused) {
      setFocusedPendingOrderId(null);
      return;
    }
    if (focused.status !== "pending") {
      rememberPlacedOrder(deviceId, focused.orderId);
      setAcceptanceNotice({
        orderId: focused.orderId,
        orderNumber: focused.orderNumber
      });
    }
  }, [activeOrders, focusedPendingOrderId, acceptanceNotice, deviceId]);

  useEffect(() => {
    if (!acceptanceNotice) return undefined;
    const timerId = window.setTimeout(() => {
      continueAfterAcceptance();
    }, 2200);
    return () => window.clearTimeout(timerId);
  }, [acceptanceNotice]);

  const visibleOrders = useMemo(() => {
    if (acceptanceNotice?.orderId) {
      const accepted = activeOrders.find((order) => order.orderId === acceptanceNotice.orderId);
      return accepted ? [accepted] : activeOrders;
    }
    if (!focusedPendingOrderId) return activeOrders;
    const focused = activeOrders.find(
      (order) => order.orderId === focusedPendingOrderId && order.status === "pending"
    );
    return focused ? [focused] : activeOrders;
  }, [activeOrders, focusedPendingOrderId, acceptanceNotice]);

  const isPendingFocus = Boolean(
    !acceptanceNotice &&
      focusedPendingOrderId &&
      visibleOrders.length === 1 &&
      visibleOrders[0]?.orderId === focusedPendingOrderId &&
      visibleOrders[0]?.status === "pending"
  );

  const statusInfoText = useMemo(() => {
    if (isPendingFocus) return t("pendingInfo");
    if (isDineIn) return t("deliveryInfo");
    const types = new Set(
      visibleOrders
        .map((order) => order.orderType)
        .filter((type) => type === "delivery" || type === "pickup")
    );
    if (types.size === 1 && types.has("delivery")) return t("webOrdersDeliveryInfo");
    if (types.size === 1 && types.has("pickup")) return t("webOrdersPickupInfo");
    return t("webOrdersInfo");
  }, [isPendingFocus, isDineIn, visibleOrders, t]);

  const openPayModal = (order) => {
    setPayOrderForModal(order);
    setReceiptWanted(false);
    setReceiptEmail("");
    setShowPayModal(true);
    setOrderError("");
  };

  const closePayModal = () => {
    setShowPayModal(false);
    setPayOrderForModal(null);
    setReceiptWanted(false);
    setReceiptEmail("");
  };

  const handlePayOrder = async (order, customerEmail = null) => {
    if (!restaurantId || paymentLoading) return;
    const orderTotal = order.items.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );
    if (orderTotal <= 0) return;
    setPaymentLoading(order.orderId);
    setOrderError("");
    closePayModal();
    try {
      const baseUrl = window.location.origin + window.location.pathname;
      const successUrl = `${baseUrl}?order_paid=1&order_id=${order.orderId}`;
      const cancelUrl = `${baseUrl}?payment_cancelled=1`;
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          orderId: order.orderId,
          successUrl,
          cancelUrl,
          customerEmail: customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) ? customerEmail : null
        }
      });
      const errMsg = error?.message || data?.error || t("paymentFailed");
      if (error) throw new Error(errMsg);
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || t("couldNotStartPayment"));
      }
    } catch (err) {
      setOrderError(err.message || t("paymentFailed"));
      setPaymentLoading(null);
    }
  };

  const openFooter = () => {
    footerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const formatTableLabel = () => {
    if (!isDineIn) return "";
    if (tableName && tableNumber) {
      return `${tableName} ${tableNumber}`;
    }
    if (tableName) {
      return tableName;
    }
    if (tableNumber) {
      return `${t("table")} ${tableNumber}`;
    }
    return `${t("table")} ${tableId}`;
  };

  useEffect(() => {
    const timers = statusTimersRef.current;
    const activeIds = new Set();

    activeOrders.forEach((order) => {
      activeIds.add(order.orderId);
      if (order.status === "accepted" && order.displayStatus !== "preparing") {
        const acceptedAt = order.acceptedAt ?? Date.now();
        const remaining = 5000 - (Date.now() - acceptedAt);
        if (remaining <= 0) {
          updateOrders((prev) =>
            prev.map((item) =>
              item.orderId === order.orderId
                ? { ...item, displayStatus: "preparing" }
                : item
            )
          );
        } else if (!timers[order.orderId]) {
          timers[order.orderId] = setTimeout(() => {
            updateOrders((prev) =>
              prev.map((item) =>
                item.orderId === order.orderId
                  ? { ...item, displayStatus: "preparing" }
                  : item
              )
            );
            delete timers[order.orderId];
          }, remaining);
        }
      } else if (timers[order.orderId]) {
        clearTimeout(timers[order.orderId]);
        delete timers[order.orderId];
      }
    });

    Object.keys(timers).forEach((id) => {
      if (!activeIds.has(id)) {
        clearTimeout(timers[id]);
        delete timers[id];
      }
    });
  }, [activeOrders]);

  useEffect(
    () => () => {
      const timers = statusTimersRef.current;
      Object.values(timers).forEach((timerId) => clearTimeout(timerId));
      statusTimersRef.current = {};
    },
    []
  );

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return menuItems;
    return menuItems.filter((item) => {
      const name = item.name?.toLowerCase() ?? "";
      const description = item.description?.toLowerCase() ?? "";
      return name.includes(term) || description.includes(term);
    });
  }, [menuItems, searchTerm]);

  const groupedItems = useMemo(() => {
    const grouped = {};
    filteredItems.forEach((item) => {
      const key = item.category_id || "uncategorized";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });
    return grouped;
  }, [filteredItems]);

  const categoryFilters = useMemo(() => {
    const list = categories.map((category) => ({
      id: category.id,
      name: category.name
    }));
    const hasUncategorized = (groupedItems.uncategorized ?? []).length > 0;
    return [
      { id: "all", name: t("all") },
      ...list,
      ...(hasUncategorized ? [{ id: "uncategorized", name: t("more") }] : [])
    ];
  }, [categories, groupedItems, t]);

  const [activeCategory, setActiveCategory] = useState("all");
  const sectionRefs = useRef({});
  const chipRefs = useRef({});
  const topChromeRef = useRef(null);
  const ignoreScrollSpyUntilRef = useRef(0);
  const activeCategoryRef = useRef(activeCategory);

  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  useEffect(() => {
    if (!categories.length) return;
    setExpandedCategories((prev) => {
      const next = { ...prev };
      categories.forEach((category) => {
        if (!(category.id in next)) {
          next[category.id] = true;
        }
      });
      if (groupedItems.uncategorized && !("uncategorized" in next)) {
        next.uncategorized = true;
      }
      return next;
    });
  }, [categories, groupedItems]);

  const toggleCategory = (id) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setActiveCategoryFromScroll = (categoryId) => {
    if (activeCategoryRef.current === categoryId) return;
    activeCategoryRef.current = categoryId;
    setActiveCategory(categoryId);
    chipRefs.current[categoryId]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest"
    });
  };

  const scrollToCategory = (categoryId) => {
    ignoreScrollSpyUntilRef.current = Date.now() + 900;
    setActiveCategory(categoryId);
    activeCategoryRef.current = categoryId;
    chipRefs.current[categoryId]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest"
    });

    if (categoryId === "all") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const wasCollapsed = !expandedCategories[categoryId];
    if (wasCollapsed) {
      setExpandedCategories((prev) => ({ ...prev, [categoryId]: true }));
    }

    window.setTimeout(
      () => {
        const section = sectionRefs.current[categoryId];
        if (!section) return;
        const chromeHeight = topChromeRef.current?.offsetHeight ?? 120;
        const top =
          section.getBoundingClientRect().top + window.scrollY - chromeHeight - 8;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      },
      wasCollapsed ? 90 : 0
    );
  };

  useEffect(() => {
    if (showCart || showStatus || searchTerm.trim()) return;

    const sectionIds = [
      ...categories.map((category) => category.id),
      ...(groupedItems.uncategorized ? ["uncategorized"] : [])
    ];
    if (!sectionIds.length) return;

    let ticking = false;

    const updateActiveFromScroll = () => {
      ticking = false;
      if (Date.now() < ignoreScrollSpyUntilRef.current) return;

      const chromeHeight = topChromeRef.current?.offsetHeight ?? 120;
      const probeY = chromeHeight + 12;

      if (window.scrollY <= 24) {
        setActiveCategoryFromScroll("all");
        return;
      }

      let currentId = sectionIds[0];
      for (const id of sectionIds) {
        const section = sectionRefs.current[id];
        if (!section) continue;
        if (section.getBoundingClientRect().top - probeY <= 0) {
          currentId = id;
        } else {
          break;
        }
      }

      setActiveCategoryFromScroll(currentId);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActiveFromScroll);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    updateActiveFromScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [categories, groupedItems, showCart, showStatus, searchTerm]);

  const handleSheetPointerDown = (event) => {
    if (sheetRef.current && sheetRef.current.scrollTop > 0) return;
    dragStartRef.current = event.clientY;
    setIsDraggingSheet(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleSheetPointerMove = (event) => {
    if (!isDraggingSheet || dragStartRef.current === null) return;
    const delta = event.clientY - dragStartRef.current;
    if (delta > 0) {
      setSheetOffset(delta);
      event.preventDefault();
    }
  };

  const handleSheetPointerUp = () => {
    if (!isDraggingSheet) return;
    setIsDraggingSheet(false);
    if (sheetOffset > 120) {
      setSheetOpen(false);
      setTimeout(() => setSelectedItem(null), 500);
    } else {
      setSheetOffset(0);
    }
    dragStartRef.current = null;
  };

  const addToCart = (item) => {
    if (asSoldOut(item?.sold_out)) return;
    setCart((prev) => {
      const existing = prev.find((entry) => entry.id === item.id);
      if (existing) {
        return prev.map((entry) =>
          entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prev) =>
      prev
        .map((entry) =>
          entry.id === itemId ? { ...entry, quantity: entry.quantity - 1 } : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  };

  const isValidPhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  };

  const restaurantPlan = { plan_id: planId };
  const canUseWebsite = hasPlanFeature(restaurantPlan, "website");
  const canReserve = hasPlanFeature(restaurantPlan, "reservations");

  useEffect(() => {
    if (!canReserve && websiteScreen === "reserve") {
      setWebsiteScreen("menu");
    }
  }, [canReserve, websiteScreen]);

  useEffect(() => {
    const name = restaurantName || t("menuFallback");
    const isPublicWebsite = !isDineIn && restaurantLoaded && Boolean(restaurantId) && canUseWebsite;
    document.title = isPublicWebsite ? t("seoMenuTitle", { name }) : name;
    upsertMeta(
      "name",
      "description",
      isPublicWebsite ? t("seoWebsiteDesc", { name }) : t("seoDineInDesc", { name })
    );
    upsertMeta("name", "robots", isPublicWebsite ? "index, follow" : "noindex, nofollow");
    upsertCanonical(
      isPublicWebsite && restaurantRef
        ? `${window.location.origin}/site/${String(restaurantRef).toLowerCase()}`
        : null
    );
    document.documentElement.lang = language;
  }, [
    canUseWebsite,
    isDineIn,
    language,
    restaurantId,
    restaurantLoaded,
    restaurantName,
    restaurantRef,
    t,
  ]);

  const selectWebsiteScreen = (next) => {
    setWebsiteScreen(next);
    setOrderError("");
    setReservationConfirm(null);
    if (next === "reserve") {
      setShowCart(false);
      setShowCheckoutModal(false);
    }
  };

  const openWebsiteCheckout = (fulfillment) => {
    setWebsiteFulfillment(fulfillment);
    setOrderError("");
    setShowCheckoutModal(true);
  };

  const closeWebsiteCheckout = () => {
    setShowCheckoutModal(false);
    setOrderError("");
  };

  const addMinutesToTimeValue = (timeValue, minutesToAdd) => {
    const [hours, minutes] = String(timeValue || "00:00")
      .split(":")
      .map((part) => Number(part));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "00:00";
    const total = (((hours * 60 + minutes + minutesToAdd) % (24 * 60)) + 24 * 60) % (24 * 60);
    const nextH = Math.floor(total / 60);
    const nextM = total % 60;
    return `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`;
  };

  const getReserveDurationLabel = (startTime, endTime) => {
    const [sh, sm] = String(startTime || "00:00").split(":").map(Number);
    const [eh, em] = String(endTime || "00:00").split(":").map(Number);
    if (![sh, sm, eh, em].every(Number.isFinite)) return "";
    const mins = eh * 60 + em - (sh * 60 + sm);
    if (mins <= 0) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  };

  const reserveDurationLabel = useMemo(
    () => getReserveDurationLabel(reserveTime, reserveEndTime),
    [reserveTime, reserveEndTime]
  );

  const submitReservation = async () => {
    if (!restaurantId || isDineIn) return;
    const fullName = `${reserveFirstName.trim()} ${reserveSurname.trim()}`.trim();
    if (
      !fullName ||
      !reservePhone.trim() ||
      !reserveGuests ||
      !reserveDate ||
      !reserveTime ||
      !reserveEndTime
    ) {
      setOrderError(t("webRequired"));
      return;
    }
    if (!isValidPhone(reservePhone)) {
      setOrderError(t("webInvalidPhone"));
      return;
    }
    const guestCount = Number(reserveGuests);
    if (!Number.isFinite(guestCount) || guestCount < 1 || guestCount > 100) {
      setOrderError(t("webRequired"));
      return;
    }

    const start = new Date(`${reserveDate}T${reserveTime}:00`);
    const end = new Date(`${reserveDate}T${reserveEndTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setOrderError(t("webRequired"));
      return;
    }
    if (end <= start) {
      setOrderError(t("webReserveTimeInvalid"));
      return;
    }

    setSubmitting(true);
    setOrderError("");
    const reservationId = createUuid();
    const payload = {
      id: reservationId,
      restaurant_id: restaurantId,
      table_id: null,
      customer_name: fullName,
      phone_number: reservePhone.trim(),
      guest_count: guestCount,
      reservation_date: start.toISOString(),
      reservation_time: start.toISOString(),
      reservation_end_time: end.toISOString(),
      notes: reserveNotes.trim() || null,
      status: "booked",
      source: "website"
    };
    let { error } = await supabase.from("reservations").insert(payload);
    if (error && /source|schema cache|column/i.test(String(error.message || ""))) {
      const { source: _source, ...fallbackPayload } = payload;
      ({ error } = await supabase.from("reservations").insert(fallbackPayload));
    }
    setSubmitting(false);
    if (error) {
      setOrderError(error.message);
      return;
    }
    setReservationConfirm({
      id: reservationId,
      restaurantName: restaurantProfile.name || restaurantName || "",
      customerName: fullName,
      phone: reservePhone.trim(),
      guests: guestCount,
      date: reserveDate,
      time: reserveTime,
      endTime: reserveEndTime,
      notes: reserveNotes.trim(),
      createdAt: new Date().toISOString()
    });
    setReserveFirstName("");
    setReserveSurname("");
    setReservePhone("");
    setReserveGuests("2");
    setReserveDate("");
    setReserveTime("");
    setReserveEndTime("");
    setReserveNotes("");
  };

  const formatConfirmDate = (dateValue) => {
    if (!dateValue) return "—";
    const parsed = new Date(`${dateValue}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateValue;
    return parsed.toLocaleDateString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const buildReservationTicketBlob = useCallback(async () => {
    if (!reservationConfirm) return null;
    const qrCanvas = reservationQrRef.current?.querySelector("canvas");
    const canvas = document.createElement("canvas");
    const width = 720;
    const height = reservationConfirm.notes ? 980 : 900;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 36, 36, width - 72, height - 72, 28);
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    roundRect(ctx, 36, 36, width - 72, height - 72, 28);
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 28px Outfit, Segoe UI, sans-serif";
    ctx.fillText(t("webReservationTicketTitle"), 72, 110);

    ctx.fillStyle = "#64748b";
    ctx.font = "500 18px Outfit, Segoe UI, sans-serif";
    ctx.fillText(reservationConfirm.restaurantName || t("menuFallback"), 72, 144);

    const rows = [
      [t("webCustomerName"), reservationConfirm.customerName],
      [t("webPhone"), reservationConfirm.phone],
      [t("webPeopleSize"), String(reservationConfirm.guests)],
      [t("webDate"), formatConfirmDate(reservationConfirm.date)],
      [
        t("webStartTime"),
        `${reservationConfirm.time || "—"}${
          reservationConfirm.endTime ? ` – ${reservationConfirm.endTime}` : ""
        }`
      ]
    ];
    if (reservationConfirm.notes) {
      rows.push([t("webReservationNotes"), reservationConfirm.notes]);
    }

    let y = 200;
    rows.forEach(([label, value]) => {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "650 14px Outfit, Segoe UI, sans-serif";
      ctx.fillText(String(label).toUpperCase(), 72, y);
      ctx.fillStyle = "#0f172a";
      ctx.font = "600 22px Outfit, Segoe UI, sans-serif";
      const lines = wrapCanvasText(ctx, String(value || "—"), width - 144);
      lines.forEach((line, index) => {
        ctx.fillText(line, 72, y + 28 + index * 28);
      });
      y += 36 + lines.length * 28;
    });

    if (qrCanvas) {
      const qrSize = 180;
      const qrX = (width - qrSize) / 2;
      const qrY = height - 280;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24);
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = "#64748b";
      ctx.font = "500 14px Outfit, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t("webReservationShowQr"), width / 2, qrY + qrSize + 36);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 12px Outfit, Segoe UI, sans-serif";
      ctx.fillText(
        `#${String(reservationConfirm.id).slice(0, 8).toUpperCase()}`,
        width / 2,
        qrY + qrSize + 58
      );
      ctx.textAlign = "left";
    }

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }, [reservationConfirm, locale, t]);

  useEffect(() => {
    if (!reservationConfirm) {
      setTicketPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const blob = await buildReservationTicketBlob();
      if (cancelled || !blob) return;
      const url = URL.createObjectURL(blob);
      setTicketPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reservationConfirm, buildReservationTicketBlob]);

  const downloadReservationTicket = async () => {
    if (!reservationConfirm || savingTicketPhoto) return;
    setSavingTicketPhoto(true);
    try {
      const blob = await buildReservationTicketBlob();
      if (!blob) return;

      const fileName = `reservation-${String(reservationConfirm.id).slice(0, 8)}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      // Mobile: share sheet lets the user save the photo to Gallery / Photos.
      if (typeof navigator !== "undefined" && typeof navigator.canShare === "function") {
        try {
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: t("webReservationTicketTitle"),
              text: t("webReservationTicketHint")
            });
            return;
          }
        } catch (err) {
          if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
            return;
          }
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      setSavingTicketPhoto(false);
    }
  };

  const printReservationTicket = () => {
    window.print();
  };

  const submitOrder = async () => {
    if (!cart.length || !restaurantId) return;
    setOrderError("");

    if (!isDineIn) {
      if (websiteFulfillment !== "delivery" && websiteFulfillment !== "pickup") {
        setOrderError(t("webChooseFulfillment"));
        return;
      }
      if (!customerName.trim() || !customerPhone.trim()) {
        setOrderError(t("webRequired"));
        return;
      }
      if (!isValidPhone(customerPhone)) {
        setOrderError(t("webInvalidPhone"));
        return;
      }
      if (websiteFulfillment === "delivery" && !deliveryAddress.trim()) {
        setOrderError(t("webRequired"));
        return;
      }
    }

    setSubmitting(true);
    const orderPayload = cart.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price
    }));

    const { data, error } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        items: orderPayload,
        comment: comment.trim() || null,
        status: "pending",
        source: isDineIn ? "qr" : "website",
        order_type: isDineIn ? "dine_in" : websiteFulfillment,
        customer_name: isDineIn ? null : customerName.trim(),
        customer_phone: isDineIn ? null : customerPhone.trim(),
        delivery_address:
          !isDineIn && websiteFulfillment === "delivery"
            ? deliveryAddress.trim()
            : null
      })
      .select("id, order_number, status, accepted_at, created_at, payment_status")
      .single();

    if (error) {
      setOrderError(error.message);
      setSubmitting(false);
      return;
    }

    const actualStatus = data.status ?? "pending";
    const acceptedAtMs = data.accepted_at
      ? new Date(data.accepted_at).getTime()
      : actualStatus === "accepted"
        ? Date.now()
        : null;
    const createdAtMs = data.created_at
      ? new Date(data.created_at).getTime()
      : Date.now();

    const newOrder = {
      orderId: data.id,
      orderNumber: data.order_number,
      status: actualStatus,
      displayStatus: actualStatus === "accepted" ? "accepted" : actualStatus,
      acceptedAt: acceptedAtMs,
      createdAt: createdAtMs,
      paymentStatus: data.payment_status ?? null,
      items: orderPayload,
      comment: comment.trim() || "",
      orderType: isDineIn ? "dine_in" : websiteFulfillment
    };
    rememberPlacedOrder(deviceId, data.id);
    updateOrders((prev) => [...prev, newOrder]);
    if (actualStatus === "pending") {
      setFocusedPendingOrderId(newOrder.orderId);
    } else {
      setFocusedPendingOrderId(null);
    }
    setShowCheckoutModal(false);
    setStatusLoading(true);
    setShowCart(false);
    setTimeout(() => {
      setStatusLoading(false);
      setShowStatus(true);
      if (sessionKey) {
        localStorage.setItem(`qrmenu_view_${sessionKey}`, "status");
      }
    }, 1400);
    setComment("");
    setCart([]);
    setWebsiteFulfillment("delivery");
    setSubmitting(false);
  };

  const callWaiter = async () => {
    if (!restaurantId || callingWaiter || Date.now() < waiterCooldownUntil) return;
    const tableLabel = isDineIn
      ? tableName?.trim()
        ? tableName.trim()
        : tableNumber != null
          ? `Table ${tableNumber}`
          : t("unknownTable")
      : restaurantProfile.name || restaurantName || "Website";
    const waiterMessage = isDineIn
      ? `${tableLabel} is calling the waiter`
      : `${tableLabel} (website) is calling for assistance`;
    const waiterItem = {
      id: "waiter_call",
      name: "Call waiter",
      quantity: 1,
      price: 0,
      type: "waiter_call"
    };

    setCallingWaiter(true);
    setOrderError("");
    setWaiterNotice("");
    const { data, error } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        items: [waiterItem],
        comment: waiterMessage,
        status: "pending",
        source: isDineIn ? "qr" : "website",
        order_type: isDineIn ? "dine_in" : null
      })
      .select("id, order_number, status, accepted_at, created_at, payment_status")
      .single();

    if (error) {
      setOrderError(error.message);
      setCallingWaiter(false);
      return;
    }

    const actualStatus = data.status ?? "pending";
    const acceptedAtMs = data.accepted_at
      ? new Date(data.accepted_at).getTime()
      : actualStatus === "accepted"
        ? Date.now()
        : null;
    const createdAtMs = data.created_at
      ? new Date(data.created_at).getTime()
      : Date.now();

    updateOrders((prev) => [
      ...prev,
      {
        orderId: data.id,
        orderNumber: data.order_number,
        status: actualStatus,
        displayStatus: actualStatus === "accepted" ? "accepted" : actualStatus,
        acceptedAt: acceptedAtMs,
        createdAt: createdAtMs,
        paymentStatus: data.payment_status ?? null,
        items: [waiterItem],
        comment: waiterMessage
      }
    ]);
    setWaiterNotice(t("waiterNotice"));
    setWaiterCooldownUntil(Date.now() + 120_000);
    setCallingWaiter(false);
  };

  const waiterCooldownSecs = Math.max(0, Math.ceil((waiterCooldownUntil - Date.now()) / 1000));
  const waiterCooldownLabel = `${Math.floor(waiterCooldownSecs / 60)
    .toString()
    .padStart(2, "0")}:${(waiterCooldownSecs % 60).toString().padStart(2, "0")}`;

  useEffect(() => {
    if (!waiterNotice || !waiterCooldownUntil) return;
    if (Date.now() >= waiterCooldownUntil) {
      setWaiterNotice("");
    }
  }, [timerTick, waiterNotice, waiterCooldownUntil]);

  useEffect(() => {
    if (!waiterCooldownUntil || Date.now() >= waiterCooldownUntil) return;
    setWaiterNotice(t("waiterNotice"));
  }, [language, t, waiterCooldownUntil]);

  useEffect(() => {
    if (!restaurantId || !sessionKey) return;

    const applyStatusUpdate = (orderId, status, acceptedAt) => {
      if (status === "finish") {
        const existing = activeOrdersRef.current.find((order) => order.orderId === orderId);
        if (existing) {
          openFeedbackPromptRef.current(existing);
        } else if (didThisDevicePlaceOrder(deviceId, orderId)) {
          // Order may already have been dropped from local state; still prompt.
          openFeedbackPromptRef.current({
            orderId,
            orderNumber: null,
            items: [],
          });
        }
      }
      updateOrders((prev) =>
        prev
          .map((order) => {
            if (order.orderId !== orderId) return order;
            if (status === "accepted") {
              return {
                ...order,
                status,
                displayStatus: "accepted",
                acceptedAt: acceptedAt ?? Date.now(),
                createdAt: order.createdAt ?? Date.now()
              };
            }
            return {
              ...order,
              status,
              displayStatus: status,
              acceptedAt: order.acceptedAt ?? null
            };
          })
          .filter((order) => order.status !== "finish")
      );
    };

    // Must match admin/mobile topic ("order-status") or finish broadcasts never arrive.
    // Guest RLS also hides finished rows, so postgres_changes often won't fire for finish.
    const channel = supabase
      .channel("order-status")
      .on(
        "broadcast",
        { event: "status" },
        (payload) => {
          const { orderId: updatedId, status, tableId: payloadTableId } = payload.payload ?? {};
          if (!updatedId) return;
          if (tableId) {
            if (payloadTableId && payloadTableId !== tableId) return;
          } else if (
            !didThisDevicePlaceOrder(deviceId, updatedId) &&
            !activeOrdersRef.current.some((order) => order.orderId === updatedId)
          ) {
            return;
          }
          applyStatusUpdate(updatedId, status, payload.payload?.acceptedAt ?? Date.now());
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: tableId
            ? `table_id=eq.${tableId}`
            : `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          const { id, status, accepted_at, payment_status, table_id: rowTableId } = payload.new ?? {};
          if (!id) return;
          if (!tableId && rowTableId) return;
          const acceptedAtMs = accepted_at
            ? new Date(accepted_at).getTime()
            : status === "accepted"
              ? Date.now()
              : null;
          if (status === "finish") {
            const existing = activeOrdersRef.current.find((order) => order.orderId === id);
            if (existing) openFeedbackPromptRef.current(existing);
            else if (didThisDevicePlaceOrder(deviceId, id)) {
              openFeedbackPromptRef.current({ orderId: id, orderNumber: null, items: [] });
            }
          }
          updateOrders((prev) => {
            if (!tableId && !prev.some((order) => order.orderId === id)) {
              return prev;
            }
            return prev
              .map((order) => {
                if (order.orderId !== id) return order;
                const next = { ...order, paymentStatus: payment_status ?? order.paymentStatus };
                if (status === "accepted") {
                  return { ...next, status, displayStatus: "accepted", acceptedAt: acceptedAtMs ?? Date.now(), createdAt: order.createdAt ?? Date.now() };
                }
                return { ...next, status, displayStatus: status, acceptedAt: order.acceptedAt ?? null };
              })
              .filter((order) => order.orderId !== id || order.status !== "finish");
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, tableId, sessionKey, deviceId]);

  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  const hasCartBar =
    !showStatus &&
    !showCart &&
    cart.length > 0 &&
    (isDineIn || websiteScreen !== "reserve");
  // Hide View orders while cart bar is showing, and on the website Reserve tab.
  const hasOrdersBar =
    !showStatus &&
    !showCart &&
    activeOrders.length > 0 &&
    cart.length === 0 &&
    (isDineIn || websiteScreen !== "reserve");

  const currentYear = new Date().getFullYear();

  const renderMenuItem = (item) => {
    const soldOut = asSoldOut(item.sold_out);
    const cartEntry = cart.find((entry) => entry.id === item.id);
    return (
      <ItemCard key={item.id} $soldOut={soldOut}>
        <ItemContentButton type="button" onClick={() => setSelectedItem(item)}>
          <ItemTitleRow>
            <h3>{item.name}</h3>
            {soldOut ? <SoldOutPill>{t("soldOut")}</SoldOutPill> : null}
          </ItemTitleRow>
          {item.description ? <p>{item.description}</p> : null}
          <strong>{money(Number(item.price))}</strong>
        </ItemContentButton>
        <ItemActions>
          <ItemMedia>
            <ItemImageButton type="button" onClick={() => setSelectedItem(item)} aria-label={t("viewItem", { name: item.name })}>
              {item.image_url ? (
                <ItemImage src={item.image_url} alt="" $soldOut={soldOut} />
              ) : (
                <ItemImagePlaceholder aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 7h16v12H4z" />
                    <path d="m8 14 2.5-3 2 2.5L16 10l4 6" />
                    <circle cx="9" cy="10" r="1.2" />
                  </svg>
                </ItemImagePlaceholder>
              )}
            </ItemImageButton>
            {!soldOut && !cartEntry && (
              <QuickAddBadge
                type="button"
                aria-label={t("orderItem", { name: item.name })}
                onClick={() => addToCart(item)}
              >
                {t("order")}
              </QuickAddBadge>
            )}
            {!soldOut && cartEntry ? (
              <MenuItemControls>
                <MenuItemControlButton type="button" onClick={() => removeFromCart(item.id)} aria-label={t("decreaseQty")}>
                  −
                </MenuItemControlButton>
                <span>{cartEntry.quantity ?? 0}</span>
                <MenuItemControlButton type="button" onClick={() => addToCart(item)} aria-label={t("increaseQty")}>
                  +
                </MenuItemControlButton>
              </MenuItemControls>
            ) : null}
          </ItemMedia>
          {soldOut ? (
            <SoldOutAction type="button" disabled>
              {t("soldOut")}
            </SoldOutAction>
          ) : null}
        </ItemActions>
      </ItemCard>
    );
  };

  if (!isDineIn && restaurantLoaded && restaurantId && !canUseWebsite) {
    return (
      <Shell>
        <div style={{ maxWidth: 420, margin: "80px auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>{t("planWebsiteLockedTitle")}</h1>
          <p style={{ margin: 0, opacity: 0.72 }}>{t("planWebsiteLockedBody")}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell $hasCart={hasCartBar || hasOrdersBar}>
      {!showCart && !showStatus && (
        <TopChrome ref={topChromeRef}>
          <Header>
            {searchOpen ? (
              <SearchRow>
                <SearchInput
                  type="search"
                  placeholder={t("searchPlaceholder")}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  autoFocus
                />
                <IconButton
                  type="button"
                  aria-label={t("closeSearch")}
                  onClick={() => {
                    setSearchTerm("");
                    setSearchOpen(false);
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </IconButton>
              </SearchRow>
            ) : (
              <>
                <BrandBlock>
                  <Title>{restaurantName}</Title>
                </BrandBlock>
                <HeaderActions>
                  {isDineIn ? (
                    <TablePill aria-label={formatTableLabel()}>
                      {formatTableLabel()}
                    </TablePill>
                  ) : null}
                  <LanguageSelect
                    value={language}
                    onChange={(event) => setLanguage(normalizeLang(event.target.value))}
                    aria-label={t("language")}
                  >
                    <option value="en">EN</option>
                    <option value="ru">RU</option>
                    <option value="uz">UZ</option>
                  </LanguageSelect>
                  {(isDineIn || websiteScreen !== "reserve") && (
                    <IconButton
                      type="button"
                      aria-label={t("openSearch")}
                      onClick={() => setSearchOpen(true)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="11" cy="11" r="6" />
                        <path d="M16 16l5 5" />
                      </svg>
                    </IconButton>
                  )}
                  <MenuWrapper>
                    <IconButton
                      type="button"
                      aria-label={t("openMenu")}
                      onClick={() => setMenuOpen(true)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </IconButton>
                  </MenuWrapper>
                </HeaderActions>
              </>
            )}
          </Header>
          {!isDineIn && !searchOpen && canReserve && (
            <WebsiteModeTabs>
              <WebsiteModeTab
                type="button"
                $active={websiteScreen === "menu"}
                onClick={() => selectWebsiteScreen("menu")}
              >
                {t("menuFallback")}
              </WebsiteModeTab>
              <WebsiteModeTab
                type="button"
                $active={websiteScreen === "reserve"}
                onClick={() => selectWebsiteScreen("reserve")}
              >
                {t("webReserve")}
              </WebsiteModeTab>
            </WebsiteModeTabs>
          )}
          {!searchOpen && (isDineIn || websiteScreen !== "reserve") && (
            <CategoryCarousel>
              {categoryFilters.map((category) => (
                <CategoryChip
                  key={category.id}
                  type="button"
                  $active={activeCategory === category.id}
                  ref={(node) => {
                    if (node) chipRefs.current[category.id] = node;
                    else delete chipRefs.current[category.id];
                  }}
                  onClick={() => scrollToCategory(category.id)}
                >
                  {category.name}
                </CategoryChip>
              ))}
            </CategoryCarousel>
          )}
        </TopChrome>
      )}

      {menuOpen && (
        <SidebarOverlay
          onClick={() => setMenuOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenuOpen(false);
          }}
          role="presentation"
        >
          <Sidebar
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label={t("menuFallback")}
          >
            <SidebarHeader>
              <SidebarBrand>
                {isDineIn ? <SidebarEyebrow>{formatTableLabel()}</SidebarEyebrow> : null}
                <SidebarTitle>{restaurantProfile.name || restaurantName}</SidebarTitle>
              </SidebarBrand>
              <SidebarClose type="button" onClick={() => setMenuOpen(false)} aria-label={t("closeMenu")}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </SidebarClose>
            </SidebarHeader>

            <SidebarSection>
              <SidebarSectionTitle>{t("navigate")}</SidebarSectionTitle>
              <SidebarList>
                <SidebarRow
                  type="button"
                  onClick={() => {
                    setShowCart(false);
                    setShowStatus(false);
                    setFocusedPendingOrderId(null);
                    setAcceptanceNotice(null);
                    setMenuOpen(false);
                  }}
                >
                  <SidebarRowLeft>
                    <SidebarIconWrap>
                      <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 12h16M4 6h16M4 18h16" />
                      </SidebarIcon>
                    </SidebarIconWrap>
                    <SidebarRowText>{t("home")}</SidebarRowText>
                  </SidebarRowLeft>
                  <SidebarArrow>›</SidebarArrow>
                </SidebarRow>
                {activeOrders.length > 0 && (
                  <SidebarRow
                    type="button"
                    onClick={() => {
                      setShowCart(false);
                      openAllOrders();
                      setMenuOpen(false);
                    }}
                  >
                    <SidebarRowLeft>
                      <SidebarIconWrap>
                        <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 4h14v16H5z" />
                          <path d="M8 8h8M8 12h8M8 16h5" />
                        </SidebarIcon>
                      </SidebarIconWrap>
                      <SidebarRowText>{t("myOrders")}</SidebarRowText>
                    </SidebarRowLeft>
                    <SidebarBadge>{activeOrders.length}</SidebarBadge>
                  </SidebarRow>
                )}
                {cart.length > 0 && (
                  <SidebarRow
                    type="button"
                    onClick={() => {
                      setShowCart(true);
                      setMenuOpen(false);
                    }}
                  >
                    <SidebarRowLeft>
                      <SidebarIconWrap>
                        <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="9" cy="20" r="1.6" />
                          <circle cx="17" cy="20" r="1.6" />
                          <path d="M3 4h2l2.5 10h10l2-7H7.2" />
                        </SidebarIcon>
                      </SidebarIconWrap>
                      <SidebarRowText>{t("cart")}</SidebarRowText>
                    </SidebarRowLeft>
                    <SidebarBadge>
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </SidebarBadge>
                  </SidebarRow>
                )}
                <SidebarRow
                  type="button"
                  onClick={() => {
                    callWaiter();
                  }}
                  disabled={callingWaiter || waiterCooldownSecs > 0}
                >
                  <SidebarRowLeft>
                    <SidebarIconWrap>
                      <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
                        <path d="M4 20a8 8 0 0 1 16 0" />
                      </SidebarIcon>
                    </SidebarIconWrap>
                    <SidebarHoursCopy>
                      <SidebarRowText>
                        {callingWaiter ? t("callingWaiter") : waiterCooldownSecs > 0 ? t("waiterNotified") : t("callWaiter")}
                      </SidebarRowText>
                      {waiterCooldownSecs > 0 && (
                        <SidebarHoursHint>{waiterCooldownLabel}</SidebarHoursHint>
                      )}
                    </SidebarHoursCopy>
                  </SidebarRowLeft>
                  <SidebarArrow>›</SidebarArrow>
                </SidebarRow>
              </SidebarList>
              {waiterNotice && <CallWaiterNotice>{waiterNotice}</CallWaiterNotice>}
            </SidebarSection>

            {(restaurantProfile.address ||
              restaurantProfile.phone ||
              restaurantProfile.email ||
              restaurantProfile.instagram ||
              restaurantProfile.facebook) && (
              <SidebarSection>
                <SidebarSectionTitle>{t("contact")}</SidebarSectionTitle>
                <SidebarList>
                  {restaurantProfile.address && (
                    <SidebarRow as="div" $static>
                      <SidebarRowLeft>
                        <SidebarIconWrap>
                          <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
                            <circle cx="12" cy="10" r="2.5" />
                          </SidebarIcon>
                        </SidebarIconWrap>
                        <SidebarRowText>{restaurantProfile.address}</SidebarRowText>
                      </SidebarRowLeft>
                    </SidebarRow>
                  )}
                  {restaurantProfile.phone && (
                    <SidebarRow as="a" href={`tel:${restaurantProfile.phone}`}>
                      <SidebarRowLeft>
                        <SidebarIconWrap>
                          <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4c0 1-1 2-2 2A16 16 0 0 1 5 6c0-1 1-2 2-2Z" />
                          </SidebarIcon>
                        </SidebarIconWrap>
                        <SidebarRowText>{restaurantProfile.phone}</SidebarRowText>
                      </SidebarRowLeft>
                      <SidebarArrow>›</SidebarArrow>
                    </SidebarRow>
                  )}
                  {restaurantProfile.email && (
                    <SidebarRow as="a" href={`mailto:${restaurantProfile.email}`}>
                      <SidebarRowLeft>
                        <SidebarIconWrap>
                          <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 6h16v12H4z" />
                            <path d="m4 7 8 6 8-6" />
                          </SidebarIcon>
                        </SidebarIconWrap>
                        <SidebarRowText>{restaurantProfile.email}</SidebarRowText>
                      </SidebarRowLeft>
                      <SidebarArrow>›</SidebarArrow>
                    </SidebarRow>
                  )}
                  {restaurantProfile.instagram && (
                    <SidebarRow
                      as="a"
                      href={`https://instagram.com/${restaurantProfile.instagram.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <SidebarRowLeft>
                        <SidebarIconWrap>
                          <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="4" y="4" width="16" height="16" rx="5" />
                            <circle cx="12" cy="12" r="4" />
                            <circle cx="17" cy="7" r="1.2" />
                          </SidebarIcon>
                        </SidebarIconWrap>
                        <SidebarRowText>
                          @{restaurantProfile.instagram.replace(/^@/, "")}
                        </SidebarRowText>
                      </SidebarRowLeft>
                      <SidebarArrow>›</SidebarArrow>
                    </SidebarRow>
                  )}
                  {restaurantProfile.facebook && (
                    <SidebarRow
                      as="a"
                      href={
                        restaurantProfile.facebook.startsWith("http")
                          ? restaurantProfile.facebook
                          : `https://${restaurantProfile.facebook}`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <SidebarRowLeft>
                        <SidebarIconWrap>
                          <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M14 8h3V5h-3c-2.2 0-4 1.8-4 4v2H7v3h3v5h3v-5h3l1-3h-4V9c0-.6.4-1 1-1Z" />
                          </SidebarIcon>
                        </SidebarIconWrap>
                        <SidebarRowText>{t("facebook")}</SidebarRowText>
                      </SidebarRowLeft>
                      <SidebarArrow>›</SidebarArrow>
                    </SidebarRow>
                  )}
                </SidebarList>
              </SidebarSection>
            )}

            <SidebarSection>
              <SidebarHoursToggle
                type="button"
                $open={hoursOpen}
                onClick={() => setHoursOpen((prev) => !prev)}
                aria-expanded={hoursOpen}
              >
                <SidebarRowLeft>
                  <SidebarIconWrap>
                    <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="8" />
                      <path d="M12 8v4l3 2" />
                    </SidebarIcon>
                  </SidebarIconWrap>
                  <SidebarHoursCopy>
                    <SidebarRowText>{t("businessHours")}</SidebarRowText>
                    <SidebarHoursHint>
                      {restaurantHours.length ? t("tapToViewSchedule") : t("hoursNotSet")}
                    </SidebarHoursHint>
                  </SidebarHoursCopy>
                </SidebarRowLeft>
                <SidebarHoursChevron $open={hoursOpen}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </SidebarHoursChevron>
              </SidebarHoursToggle>
              <SidebarHoursPanel $open={hoursOpen}>
                {restaurantHours.length ? (
                  restaurantHours.map((entry) => (
                    <SidebarHoursRow key={entry.day_of_week}>
                      <span>{dayLabels[entry.day_of_week] || "-"}</span>
                      <strong>
                        {entry.closed
                          ? t("closed")
                          : `${(entry.open_time ?? "").slice(0, 5)} - ${(
                              entry.close_time ?? ""
                            ).slice(0, 5)}`}
                      </strong>
                    </SidebarHoursRow>
                  ))
                ) : (
                  <SidebarHoursEmpty>{t("hoursNotSetPeriod")}</SidebarHoursEmpty>
                )}
              </SidebarHoursPanel>
            </SidebarSection>

            <SidebarFooterNote>{t("poweredBy")}</SidebarFooterNote>
          </Sidebar>
        </SidebarOverlay>
      )}

      {!showStatus ? (
        <>
          {showCart ? (
            <CartScreen>
              <CartTopBar>
                <CartBackButton type="button" onClick={() => setShowCart(false)} aria-label={t("backToMenu")}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                  <span>{t("menuFallback")}</span>
                </CartBackButton>
                <CartTitleBlock>
                  <CartTitle>{t("cart")}</CartTitle>
                  {cart.length > 0 ? (
                    <CartSubtitle>
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                      {cart.reduce((sum, item) => sum + item.quantity, 0) === 1
                        ? t("item")
                        : t("items")}
                    </CartSubtitle>
                  ) : null}
                </CartTitleBlock>
                {isDineIn ? (
                  <CartMeta>{formatTableLabel()}</CartMeta>
                ) : (
                  <CartMetaSpacer aria-hidden="true" />
                )}
              </CartTopBar>
              <CartBody $empty={cart.length === 0}>
                {cart.length === 0 ? (
                  <EmptyState>
                    <EmptyTitle>{t("cartEmptyTitle")}</EmptyTitle>
                    <EmptyText>{t("cartEmptyText")}</EmptyText>
                    <PrimaryButton type="button" onClick={() => setShowCart(false)}>
                      {t("browseMenu")}
                    </PrimaryButton>
                  </EmptyState>
                ) : (
                  <CartList>
                    {cart.map((item) => (
                      <CartRow key={item.id}>
                        {item.image_url ? (
                          <CartImage src={item.image_url} alt={item.name} />
                        ) : (
                          <CartImagePlaceholder aria-hidden="true" />
                        )}
                        <CartInfo>
                          <span>{item.name}</span>
                          {item.description && <SmallText>{item.description}</SmallText>}
                          <SmallText>
                            {money(Number(item.price || 0))}
                          </SmallText>
                        </CartInfo>
                        <CartControls>
                          <LineTotal>
                            {money(Number(item.price || 0) * item.quantity)}
                          </LineTotal>
                          <QuantityControls>
                            <SmallButton type="button" onClick={() => removeFromCart(item.id)}>
                              −
                            </SmallButton>
                            <span>{item.quantity}</span>
                            <SmallButton type="button" onClick={() => addToCart(item)}>
                              +
                            </SmallButton>
                          </QuantityControls>
                        </CartControls>
                      </CartRow>
                    ))}
                  </CartList>
                )}
              </CartBody>
              {cart.length > 0 && (
                <CartFooter>
                  <CommentField
                    placeholder={t("notePlaceholder")}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                  <TotalRow>
                    <span>{t("total")}</span>
                    <strong>{money(total)}</strong>
                  </TotalRow>
                  {orderError && !showCheckoutModal && <ErrorText>{orderError}</ErrorText>}
                  {isDineIn ? (
                    <CartPrimaryButton
                      type="button"
                      onClick={submitOrder}
                      disabled={!cart.length || submitting}
                    >
                      {submitting ? t("submitting") : t("placeOrder")}
                    </CartPrimaryButton>
                  ) : (
                    <WebsiteFulfillmentBlock>
                      <WebsiteFulfillmentLabel>{t("webChooseFulfillment")}</WebsiteFulfillmentLabel>
                      <FulfillmentSwitch role="group" aria-label={t("webChooseFulfillment")}>
                        <FulfillmentSwitchOption
                          type="button"
                          $active={websiteFulfillment === "delivery"}
                          aria-pressed={websiteFulfillment === "delivery"}
                          onClick={() => {
                            setWebsiteFulfillment("delivery");
                            setOrderError("");
                          }}
                        >
                          {t("webDelivery")}
                        </FulfillmentSwitchOption>
                        <FulfillmentSwitchOption
                          type="button"
                          $active={websiteFulfillment === "pickup"}
                          aria-pressed={websiteFulfillment === "pickup"}
                          onClick={() => {
                            setWebsiteFulfillment("pickup");
                            setOrderError("");
                          }}
                        >
                          {t("webPickup")}
                        </FulfillmentSwitchOption>
                      </FulfillmentSwitch>
                      <CartPrimaryButton
                        type="button"
                        onClick={() => {
                          if (
                            websiteFulfillment !== "delivery" &&
                            websiteFulfillment !== "pickup"
                          ) {
                            setOrderError(t("webChooseFulfillment"));
                            return;
                          }
                          openWebsiteCheckout(websiteFulfillment);
                        }}
                        disabled={!cart.length || submitting}
                      >
                        {t("webContinueOrder")}
                      </CartPrimaryButton>
                    </WebsiteFulfillmentBlock>
                  )}
                </CartFooter>
              )}
            </CartScreen>
          ) : (
            <>
              {!isDineIn && websiteScreen === "reserve" ? (
            <ReservationScreen>
              {reservationConfirm ? (
                <ReservationConfirmWrap>
                  <ReservationSuccess>
                    <ReservationSuccessIcon viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12.5l2.5 2.5L16 9.5" />
                    </ReservationSuccessIcon>
                    <h2>{t("webReservationSent")}</h2>
                    <p>{t("webReservationTicketHint")}</p>
                  </ReservationSuccess>

                  <ReservationTicket ref={reservationTicketRef} id="reservation-ticket">
                    <ReservationTicketHeader>
                      <div>
                        <ReservationTicketEyebrow>{t("webReservationTicketTitle")}</ReservationTicketEyebrow>
                        <ReservationTicketRestaurant>
                          {reservationConfirm.restaurantName || restaurantName}
                        </ReservationTicketRestaurant>
                      </div>
                      <ReservationTicketCode>
                        #{String(reservationConfirm.id).slice(0, 8).toUpperCase()}
                      </ReservationTicketCode>
                    </ReservationTicketHeader>

                    <ReservationTicketGrid>
                      <ReservationTicketRow>
                        <span>{t("webCustomerName")}</span>
                        <strong>{reservationConfirm.customerName}</strong>
                      </ReservationTicketRow>
                      <ReservationTicketRow>
                        <span>{t("webPhone")}</span>
                        <strong>{reservationConfirm.phone}</strong>
                      </ReservationTicketRow>
                      <ReservationTicketRow>
                        <span>{t("webPeopleSize")}</span>
                        <strong>{reservationConfirm.guests}</strong>
                      </ReservationTicketRow>
                      <ReservationTicketRow>
                        <span>{t("webDate")}</span>
                        <strong>{formatConfirmDate(reservationConfirm.date)}</strong>
                      </ReservationTicketRow>
                      <ReservationTicketRow>
                        <span>{t("webStartTime")}</span>
                        <strong>
                          {reservationConfirm.time || "—"}
                          {reservationConfirm.endTime ? ` – ${reservationConfirm.endTime}` : ""}
                        </strong>
                      </ReservationTicketRow>
                      {reservationConfirm.notes ? (
                        <ReservationTicketRow $full>
                          <span>{t("webReservationNotes")}</span>
                          <strong>{reservationConfirm.notes}</strong>
                        </ReservationTicketRow>
                      ) : null}
                    </ReservationTicketGrid>

                    <ReservationTicketQr>
                      <div ref={reservationQrRef}>
                        <QRCodeCanvas
                          value={JSON.stringify({
                            type: "reservation",
                            id: reservationConfirm.id,
                            restaurant_id: restaurantId
                          })}
                          size={148}
                          includeMargin
                          bgColor="#ffffff"
                          fgColor="#0f172a"
                        />
                      </div>
                      <ReservationTicketQrHint>{t("webReservationShowQr")}</ReservationTicketQrHint>
                    </ReservationTicketQr>
                  </ReservationTicket>

                  {ticketPhotoUrl ? (
                    <ReservationPhotoPreview>
                      <img
                        src={ticketPhotoUrl}
                        alt={t("webReservationTicketTitle")}
                      />
                      <p>{t("webReservationLongPress")}</p>
                    </ReservationPhotoPreview>
                  ) : null}

                  <ReservationTicketActions>
                    <CartPrimaryButton
                      type="button"
                      onClick={downloadReservationTicket}
                      disabled={savingTicketPhoto}
                    >
                      {savingTicketPhoto
                        ? t("submitting")
                        : t("webReservationDownload")}
                    </CartPrimaryButton>
                    <GhostButton type="button" onClick={printReservationTicket}>
                      {t("webReservationPrint")}
                    </GhostButton>
                    <GhostButton
                      type="button"
                      onClick={() => {
                        setReservationConfirm(null);
                        selectWebsiteScreen("menu");
                      }}
                    >
                      {t("browseMenu")}
                    </GhostButton>
                  </ReservationTicketActions>
                </ReservationConfirmWrap>
              ) : (
                <>
                  <ReservationHero>
                    <ReservationTitle>{t("webReserveTitle")}</ReservationTitle>
                    <ReservationIntro>{t("webReserveIntro")}</ReservationIntro>
                  </ReservationHero>

                  <ReservationSection>
                    <ReservationSectionTitle>{t("webReserveDetails")}</ReservationSectionTitle>
                    <ReservationFields>
                      <ReservationRow>
                        <CheckoutField>
                          <label htmlFor="web-res-name">{t("webFirstName")}</label>
                          <input
                            id="web-res-name"
                            value={reserveFirstName}
                            onChange={(event) => setReserveFirstName(event.target.value)}
                            autoComplete="given-name"
                            placeholder={t("webFirstName")}
                          />
                        </CheckoutField>
                        <CheckoutField>
                          <label htmlFor="web-res-surname">{t("webSurname")}</label>
                          <input
                            id="web-res-surname"
                            value={reserveSurname}
                            onChange={(event) => setReserveSurname(event.target.value)}
                            autoComplete="family-name"
                            placeholder={t("webSurname")}
                          />
                        </CheckoutField>
                      </ReservationRow>
                      <CheckoutField>
                        <label htmlFor="web-res-phone">{t("webPhone")}</label>
                        <input
                          id="web-res-phone"
                          type="tel"
                          value={reservePhone}
                          onChange={(event) => setReservePhone(event.target.value)}
                          autoComplete="tel"
                          placeholder="+998 …"
                          inputMode="tel"
                        />
                      </CheckoutField>
                      <GuestField>
                        <GuestFieldCopy>
                          <span>{t("webPeopleSize")}</span>
                          <small>{t("webPeopleHint")}</small>
                        </GuestFieldCopy>
                        <GuestStepper>
                          <GuestStepButton
                            type="button"
                            aria-label={t("decreaseQty")}
                            disabled={Number(reserveGuests) <= 1}
                            onClick={() =>
                              setReserveGuests((prev) =>
                                String(Math.max(1, Number(prev || 1) - 1))
                              )
                            }
                          >
                            −
                          </GuestStepButton>
                          <GuestStepValue aria-live="polite">{reserveGuests}</GuestStepValue>
                          <GuestStepButton
                            type="button"
                            aria-label={t("increaseQty")}
                            disabled={Number(reserveGuests) >= 100}
                            onClick={() =>
                              setReserveGuests((prev) =>
                                String(Math.min(100, Number(prev || 1) + 1))
                              )
                            }
                          >
                            +
                          </GuestStepButton>
                        </GuestStepper>
                      </GuestField>
                    </ReservationFields>
                  </ReservationSection>

                  <ReservationSection>
                    <ReservationSectionTitle>{t("webReserveWhen")}</ReservationSectionTitle>
                    <ReservationFields>
                      <CheckoutField>
                        <label htmlFor="web-res-date">{t("webDate")}</label>
                        <DateTimeControl $empty={!reserveDate}>
                          {!reserveDate ? (
                            <DateTimePlaceholder>{t("webDatePlaceholder")}</DateTimePlaceholder>
                          ) : null}
                          <input
                            id="web-res-date"
                            type="date"
                            value={reserveDate}
                            min={new Date().toISOString().slice(0, 10)}
                            aria-label={t("webDate")}
                            onClick={(event) => {
                              try {
                                event.currentTarget.showPicker?.();
                              } catch {
                                /* ignore unsupported picker */
                              }
                            }}
                            onChange={(event) => setReserveDate(event.target.value)}
                          />
                        </DateTimeControl>
                      </CheckoutField>
                      <ReservationRow>
                        <CheckoutField>
                          <label htmlFor="web-res-time">{t("webStartTime")}</label>
                          <DateTimeControl $empty={!reserveTime}>
                            {!reserveTime ? (
                              <DateTimePlaceholder>
                                {t("webStartTimePlaceholder")}
                              </DateTimePlaceholder>
                            ) : null}
                            <input
                              id="web-res-time"
                              type="time"
                              value={reserveTime}
                              aria-label={t("webStartTime")}
                              onClick={(event) => {
                                try {
                                  event.currentTarget.showPicker?.();
                                } catch {
                                  /* ignore unsupported picker */
                                }
                              }}
                              onChange={(event) => {
                                const nextStart = event.target.value;
                                setReserveTime(nextStart);
                                setReserveEndTime((prevEnd) => {
                                  if (!nextStart) return prevEnd;
                                  if (!prevEnd || prevEnd <= nextStart) {
                                    return addMinutesToTimeValue(nextStart, 120);
                                  }
                                  return prevEnd;
                                });
                              }}
                            />
                          </DateTimeControl>
                        </CheckoutField>
                        <CheckoutField>
                          <ReservationFinishLabel>
                            <label htmlFor="web-res-end">{t("webFinishTime")}</label>
                            {reserveDurationLabel ? (
                              <ReservationDuration>{reserveDurationLabel}</ReservationDuration>
                            ) : null}
                          </ReservationFinishLabel>
                          <DateTimeControl $empty={!reserveEndTime}>
                            {!reserveEndTime ? (
                              <DateTimePlaceholder>
                                {t("webFinishTimePlaceholder")}
                              </DateTimePlaceholder>
                            ) : null}
                            <input
                              id="web-res-end"
                              type="time"
                              value={reserveEndTime}
                              aria-label={t("webFinishTime")}
                              onClick={(event) => {
                                try {
                                  event.currentTarget.showPicker?.();
                                } catch {
                                  /* ignore unsupported picker */
                                }
                              }}
                              onChange={(event) => setReserveEndTime(event.target.value)}
                            />
                          </DateTimeControl>
                        </CheckoutField>
                      </ReservationRow>
                    </ReservationFields>
                  </ReservationSection>

                  <ReservationSection>
                    <ReservationSectionTitle>{t("webReservationNotes")}</ReservationSectionTitle>
                    <ReservationFields>
                      <CheckoutField>
                        <textarea
                          id="web-res-notes"
                          rows={3}
                          value={reserveNotes}
                          onChange={(event) => setReserveNotes(event.target.value)}
                          placeholder={t("webReservationNotesPlaceholder")}
                          aria-label={t("webReservationNotes")}
                        />
                      </CheckoutField>
                    </ReservationFields>
                  </ReservationSection>

                  {orderError && <ErrorText>{orderError}</ErrorText>}
                  <ReservationFooter>
                    <CartPrimaryButton
                      type="button"
                      onClick={submitReservation}
                      disabled={submitting}
                    >
                      {submitting ? t("submitting") : t("webSubmitReservation")}
                    </CartPrimaryButton>
                  </ReservationFooter>
                </>
              )}
            </ReservationScreen>
              ) : (
            <>
              {searchTerm.trim() ? (
                <Section>
                  {filteredItems.length ? (
                    <Items>{filteredItems.map((item) => renderMenuItem(item))}</Items>
                  ) : (
                    <EmptyState>
                      <EmptyTitle>{t("noMatchesTitle")}</EmptyTitle>
                      <EmptyText>{t("noMatchesText")}</EmptyText>
                    </EmptyState>
                  )}
                </Section>
              ) : (
                <>
                  {categories.map((category) => (
                    <Section
                      key={category.id}
                      ref={(node) => {
                        if (node) sectionRefs.current[category.id] = node;
                        else delete sectionRefs.current[category.id];
                      }}
                    >
                      <CategoryHeader
                        $collapsed={!expandedCategories[category.id]}
                        onClick={() => toggleCategory(category.id)}
                      >
                        <h2>{category.name}</h2>
                        <StatusGroup>
                          {!expandedCategories[category.id] && (
                            <ExploreBadge>{t("explore")}</ExploreBadge>
                          )}
                          <Chevron $expanded={expandedCategories[category.id]}>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </Chevron>
                        </StatusGroup>
                      </CategoryHeader>
                      <CategoryContent $expanded={expandedCategories[category.id]}>
                        <Items>
                          {(groupedItems[category.id] || []).map((item) =>
                            renderMenuItem(item)
                          )}
                        </Items>
                      </CategoryContent>
                    </Section>
                  ))}

                  {groupedItems.uncategorized && (
                    <Section
                      ref={(node) => {
                        if (node) sectionRefs.current.uncategorized = node;
                        else delete sectionRefs.current.uncategorized;
                      }}
                    >
                      <CategoryHeader
                        $collapsed={!expandedCategories.uncategorized}
                        onClick={() => toggleCategory("uncategorized")}
                      >
                        <h2>{t("more")}</h2>
                        <StatusGroup>
                          {!expandedCategories.uncategorized && (
                            <ExploreBadge>{t("explore")}</ExploreBadge>
                          )}
                          <Chevron $expanded={expandedCategories.uncategorized}>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </Chevron>
                        </StatusGroup>
                      </CategoryHeader>
                      <CategoryContent $expanded={expandedCategories.uncategorized}>
                        <Items>
                          {groupedItems.uncategorized.map((item) => renderMenuItem(item))}
                        </Items>
                      </CategoryContent>
                    </Section>
                  )}
                </>
              )}
              </>
              )}

              {hasOrdersBar && (
                <OrdersBar $aboveCart={hasCartBar}>
                  <SummaryText>{t("activeOrders")} · {activeOrders.length}</SummaryText>
                  <OrderButton type="button" onClick={openAllOrders}>
                    {t("viewOrders")}
                  </OrderButton>
                </OrdersBar>
              )}
              {hasCartBar && (
                <StickyCart>
                  <CartSummary>
                    <CartSummaryLeft>
                      <CartBadge>
                        {cart.reduce((sum, item) => sum + item.quantity, 0)}
                      </CartBadge>
                      <SummaryText>
                        {money(total)}
                      </SummaryText>
                    </CartSummaryLeft>
                    <OrderButton type="button" onClick={() => setShowCart(true)}>
                      {t("submitTheOrder")}
                    </OrderButton>
                  </CartSummary>
                </StickyCart>
              )}
              {!showCart && !showStatus && (isDineIn || websiteScreen !== "reserve") && (
                <Footer ref={footerRef}>
                  <FooterTop>
                    <FooterBrandBlock>
                      <FooterLogo>{restaurantProfile.name || restaurantName}</FooterLogo>
                      <FooterTagline>{t("thanksDining")}</FooterTagline>
                    </FooterBrandBlock>
                    <CallWaiterButton
                      type="button"
                      onClick={callWaiter}
                      disabled={callingWaiter || waiterCooldownSecs > 0}
                    >
                      {callingWaiter ? (
                        t("callingWaiter")
                      ) : waiterCooldownSecs > 0 ? (
                        <CallWaiterButtonRow>
                          <span>{t("waiterNotified")}</span>
                          <CallWaiterTimer>{waiterCooldownLabel}</CallWaiterTimer>
                        </CallWaiterButtonRow>
                      ) : (
                        <>
                          <WaiterIcon viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
                            <path d="M4 20a8 8 0 0 1 16 0" />
                          </WaiterIcon>
                          {t("callWaiterShort")}
                        </>
                      )}
                    </CallWaiterButton>
                    {waiterNotice && <CallWaiterNotice>{waiterNotice}</CallWaiterNotice>}
                  </FooterTop>

                  {(restaurantProfile.address ||
                    restaurantProfile.phone ||
                    restaurantProfile.email) && (
                    <FooterSection>
                      <FooterTitle>{t("contact")}</FooterTitle>
                      <FooterContactList>
                        {restaurantProfile.address && (
                          <FooterItem>
                            <FooterIcon viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
                              <circle cx="12" cy="10" r="2.5" />
                            </FooterIcon>
                            <FooterText>{restaurantProfile.address}</FooterText>
                          </FooterItem>
                        )}
                        {restaurantProfile.phone && (
                          <FooterItem
                            as="a"
                            href={`tel:${restaurantProfile.phone}`}
                          >
                            <FooterIcon viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4c0 1-1 2-2 2A16 16 0 0 1 5 6c0-1 1-2 2-2Z" />
                            </FooterIcon>
                            <FooterText>{restaurantProfile.phone}</FooterText>
                          </FooterItem>
                        )}
                        {restaurantProfile.email && (
                          <FooterItem
                            as="a"
                            href={`mailto:${restaurantProfile.email}`}
                          >
                            <FooterIcon viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M4 6h16v12H4z" />
                              <path d="m4 7 8 6 8-6" />
                            </FooterIcon>
                            <FooterText>{restaurantProfile.email}</FooterText>
                          </FooterItem>
                        )}
                      </FooterContactList>
                    </FooterSection>
                  )}

                  <FooterSection>
                    <FooterTitle>{t("businessHours")}</FooterTitle>
                    {restaurantHours.length ? (
                      <HoursList>
                        {restaurantHours.map((entry) => (
                          <HoursRow key={entry.day_of_week}>
                            <HoursDay>{dayLabels[entry.day_of_week] || "-"}</HoursDay>
                            <strong>
                              {entry.closed
                                ? t("closed")
                                : `${(entry.open_time ?? "").slice(0, 5)} - ${(
                                    entry.close_time ?? ""
                                  ).slice(0, 5)}`}
                            </strong>
                          </HoursRow>
                        ))}
                      </HoursList>
                    ) : (
                      <FooterText>{t("hoursNotSetPeriod")}</FooterText>
                    )}
                  </FooterSection>

                  {(restaurantProfile.instagram || restaurantProfile.facebook) && (
                    <FooterSection>
                      <FooterTitle>{t("followUs")}</FooterTitle>
                      <FooterLinks>
                        {restaurantProfile.instagram && (
                          <FooterLink
                            href={`https://instagram.com/${restaurantProfile.instagram.replace(
                              /^@/,
                              ""
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FooterLinkIcon viewBox="0 0 24 24" aria-hidden="true">
                              <rect x="4" y="4" width="16" height="16" rx="5" />
                              <circle cx="12" cy="12" r="4" />
                              <circle cx="17" cy="7" r="1.2" />
                            </FooterLinkIcon>
                            Instagram
                          </FooterLink>
                        )}
                        {restaurantProfile.facebook && (
                          <FooterLink
                            href={
                              restaurantProfile.facebook.startsWith("http")
                                ? restaurantProfile.facebook
                                : `https://${restaurantProfile.facebook}`
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FooterLinkIcon viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M14 8h3V5h-3c-2.2 0-4 1.8-4 4v2H7v3h3v5h3v-5h3l1-3h-4V9c0-.6.4-1 1-1Z" />
                            </FooterLinkIcon>
                            Facebook
                          </FooterLink>
                        )}
                      </FooterLinks>
                    </FooterSection>
                  )}

                  <FooterBottom>
                    <span>{t("poweredBy")}</span>
                    <span>
                      © {currentYear} {restaurantProfile.name || restaurantName}
                    </span>
                  </FooterBottom>
                </Footer>
              )}
            </>
          )}
        </>
      ) : (
        <StatusCard>
          <StatusHeaderBlock>
            <StatusTopBar>
              <StatusBackButton type="button" onClick={() => setView(false)} aria-label={t("backToMenu")}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
                <span>{t("menuFallback")}</span>
              </StatusBackButton>
              <StatusTitleWrap>
                <StatusTitle>
                  {isPendingFocus ? t("orderSent") : t("yourOrders")}
                </StatusTitle>
                <StatusSubtitle>{t("liveUpdates")}</StatusSubtitle>
              </StatusTitleWrap>
              {isDineIn ? (
                <StatusTablePill>{formatTableLabel()}</StatusTablePill>
              ) : (
                <StatusTablePill aria-hidden="true" style={{ visibility: "hidden" }}>
                  —
                </StatusTablePill>
              )}
            </StatusTopBar>
            <StatusInfoText>{statusInfoText}</StatusInfoText>
          </StatusHeaderBlock>

          {orderError && <ErrorText style={{ marginBottom: 4 }}>{orderError}</ErrorText>}

          {!visibleOrders.length ? (
            <EmptyState>
              <EmptyTitle>{t("noActiveOrdersTitle")}</EmptyTitle>
              <EmptyText>{t("noActiveOrdersText")}</EmptyText>
              <PrimaryButton type="button" onClick={() => setView(false)}>
                {t("browseMenu")}
              </PrimaryButton>
            </EmptyState>
          ) : (
            <OrdersList>
              {[...visibleOrders].reverse().map((order, index) => {
                const orderTotal = order.items.reduce(
                  (sum, item) =>
                    sum + Number(item.price || 0) * Number(item.quantity || 0),
                  0
                );
                const itemCount = order.items.reduce(
                  (sum, item) => sum + Number(item.quantity || 0),
                  0
                );
                const isExpanded = !!expandedOrders[order.orderId];
                const statusKey = String(
                  order.displayStatus ?? order.status ?? "pending"
                ).toLowerCase();
                const orderStatusLabel = statusLabel(language, statusKey);
                const showProcessLine =
                  statusKey === "accepted" || statusKey === "preparing";
                const processProgress = (() => {
                  if (!showProcessLine) return 0;
                  const startMs = order.createdAt ?? order.acceptedAt ?? 0;
                  const prepMins = Number(restaurantProfile.prepTime);
                  if (!startMs || !Number.isFinite(prepMins) || prepMins <= 0) return 0.45;
                  const ratio = (Date.now() - Number(startMs)) / (prepMins * 60 * 1000);
                  return Math.min(0.92, Math.max(0.12, ratio));
                })();

                return (
                  <OrderCard
                    key={order.orderId}
                    role="button"
                    tabIndex={0}
                    $tone={statusKey}
                    $expanded={isExpanded}
                    $primary={index === 0}
                    onClick={() => toggleOrder(order.orderId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleOrder(order.orderId);
                      }
                    }}
                  >
                    <OrderBanner $tone={statusKey}>
                      <OrderBannerSide $tone={statusKey}>
                        <OrderBannerEyebrow>
                          #{order.orderNumber ?? "---"}
                        </OrderBannerEyebrow>
                      </OrderBannerSide>
                      <OrderBannerCenter>
                        <OrderBannerStatus $tone={statusKey}>{orderStatusLabel}</OrderBannerStatus>
                        {showProcessLine && (
                          <OrderProcessTrack aria-hidden="true">
                            <OrderProcessBar $progress={processProgress} />
                          </OrderProcessTrack>
                        )}
                      </OrderBannerCenter>
                      <OrderBannerSide $tone={statusKey} $end>
                        <PrepTimerDisplay
                          order={order}
                          prepTimeMins={Number(restaurantProfile.prepTime) || 15}
                          language={language}
                          tick={timerTick}
                        />
                        <OrderChevron $tone={statusKey} $open={isExpanded} aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </OrderChevron>
                      </OrderBannerSide>
                    </OrderBanner>

                    <OrderBody>
                      {!isExpanded ? (
                        <OrderCompactRow>
                          <OrderCompactMeta>
                            <span>
                              {itemCount} {itemCount === 1 ? t("item") : t("items")}
                            </span>
                            <OrderDot aria-hidden="true" />
                            <strong>
                              {money(orderTotal)}
                            </strong>
                          </OrderCompactMeta>
                        </OrderCompactRow>
                      ) : (
                        <OrderDetails>
                          {order.comment && (
                            <OrderComment>
                              <strong>{t("note")}</strong>
                              <span>{order.comment}</span>
                            </OrderComment>
                          )}
                          <OrderItems>
                            {order.items.map((item) => (
                              <OrderRow key={`${order.orderId}-${item.id}`}>
                                <OrderItemLeft>
                                  <OrderQty>{item.quantity}</OrderQty>
                                  <span>{item.name}</span>
                                </OrderItemLeft>
                                <strong>
                                  {money(Number(item.price || 0) * Number(item.quantity || 0))}
                                </strong>
                              </OrderRow>
                            ))}
                          </OrderItems>
                          <OrderTotalRow>
                            <span>{t("total")}</span>
                            <strong>
                              {money(orderTotal)}
                            </strong>
                          </OrderTotalRow>
                          {restaurantProfile.stripeEnabled &&
                            (order.status === "accepted" || order.status === "ready") &&
                            order.paymentStatus !== "paid" &&
                            orderTotal > 0 && (
                              <PayButton
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openPayModal(order);
                                }}
                                disabled={paymentLoading === order.orderId}
                              >
                                {paymentLoading === order.orderId
                                  ? t("loading")
                                  : t("payOnline")}
                              </PayButton>
                            )}
                        </OrderDetails>
                      )}
                    </OrderBody>
                  </OrderCard>
                );
              })}
            </OrdersList>
          )}
        </StatusCard>
      )}
      {statusLoading && (
        <StatusLoading>
          <Spinner />
          <span>{t("sendingOrder")}</span>
        </StatusLoading>
      )}
      {acceptanceNotice && (
        <AcceptanceOverlay>
          <AcceptanceCard>
            <AcceptanceIcon viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12.5l2.5 2.5L16 9.5" />
            </AcceptanceIcon>
            <AcceptanceTitle>{t("orderAccepted")}</AcceptanceTitle>
            <AcceptanceText>
              {acceptanceNotice.orderNumber ? t("orderAcceptedNamed", { number: acceptanceNotice.orderNumber }) : t("orderAcceptedGeneric")}
            </AcceptanceText>
            <AcceptanceButton type="button" onClick={continueAfterAcceptance}>
              {t("viewOrders")}
            </AcceptanceButton>
          </AcceptanceCard>
        </AcceptanceOverlay>
      )}
      {feedbackNotice && (
        <AcceptanceOverlay>
          <FeedbackCard>
            {feedbackThanks ? (
              <>
                <AcceptanceIcon viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12.5l2.5 2.5L16 9.5" />
                </AcceptanceIcon>
                <AcceptanceTitle>{t("feedbackThanksTitle")}</AcceptanceTitle>
                <AcceptanceText>{t("feedbackThanksText")}</AcceptanceText>
                <AcceptanceButton type="button" onClick={dismissFeedback}>
                  {t("close")}
                </AcceptanceButton>
              </>
            ) : (
              <>
                <AcceptanceTitle>{t("feedbackTitle")}</AcceptanceTitle>
                <AcceptanceText>
                  {feedbackNotice.orderNumber
                    ? t("feedbackSubtitleNamed", { number: feedbackNotice.orderNumber })
                    : t("feedbackSubtitle")}
                </AcceptanceText>

                <FeedbackRatingBlock>
                  <FeedbackRatingLabel>{t("feedbackFood")}</FeedbackRatingLabel>
                  <StarRow role="radiogroup" aria-label={t("feedbackFood")}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <StarButton
                        key={`food-${value}`}
                        type="button"
                        $active={foodRating >= value}
                        aria-label={t("feedbackStarAria", { value })}
                        aria-checked={foodRating === value}
                        role="radio"
                        onClick={() => setFoodRating(value)}
                      >
                        ★
                      </StarButton>
                    ))}
                  </StarRow>
                </FeedbackRatingBlock>

                <FeedbackRatingBlock>
                  <FeedbackRatingLabel>{t("feedbackService")}</FeedbackRatingLabel>
                  <StarRow role="radiogroup" aria-label={t("feedbackService")}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <StarButton
                        key={`service-${value}`}
                        type="button"
                        $active={serviceRating >= value}
                        aria-label={t("feedbackStarAria", { value })}
                        aria-checked={serviceRating === value}
                        role="radio"
                        onClick={() => setServiceRating(value)}
                      >
                        ★
                      </StarButton>
                    ))}
                  </StarRow>
                </FeedbackRatingBlock>

                <FeedbackComment
                  value={feedbackComment}
                  onChange={(event) => setFeedbackComment(event.target.value)}
                  placeholder={t("feedbackCommentPlaceholder")}
                  rows={3}
                  maxLength={500}
                />
                {feedbackError ? <FeedbackError>{feedbackError}</FeedbackError> : null}
                <AcceptanceButton
                  type="button"
                  onClick={submitFeedback}
                  disabled={feedbackSubmitting}
                >
                  {feedbackSubmitting ? t("feedbackSubmitting") : t("feedbackSubmit")}
                </AcceptanceButton>
                <FeedbackSkip type="button" onClick={dismissFeedback}>
                  {t("feedbackSkip")}
                </FeedbackSkip>
              </>
            )}
          </FeedbackCard>
        </AcceptanceOverlay>
      )}
      {selectedItem && (
          <ModalOverlay
            onClick={() => {
              setSheetOpen(false);
              setTimeout(() => setSelectedItem(null), 500);
            }}
          >
          <ModalSheet
            $open={sheetOpen}
            $offset={sheetOffset}
            $dragging={isDraggingSheet}
            onClick={(event) => event.stopPropagation()}
            ref={sheetRef}
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerUp}
            onPointerCancel={handleSheetPointerUp}
          >
            <ModalClose
              type="button"
              aria-label={t("close")}
              onClick={() => {
                setSheetOpen(false);
                setTimeout(() => setSelectedItem(null), 500);
              }}
            >
              ✕
            </ModalClose>
            <ModalHandle />
            {selectedItem.image_url && (
              <ModalImage src={selectedItem.image_url} alt={selectedItem.name} />
            )}
            <ModalContent>
              <ItemTitleRow>
                <h2>{selectedItem.name}</h2>
                {asSoldOut(selectedItem.sold_out) ? <SoldOutPill>{t("soldOut")}</SoldOutPill> : null}
              </ItemTitleRow>
              {selectedItem.description && <p>{selectedItem.description}</p>}
              <ModalPrice>{money(Number(selectedItem.price))}</ModalPrice>
            </ModalContent>
            <ModalActions>
              {asSoldOut(selectedItem.sold_out) ? (
                <SoldOutAction type="button" disabled style={{ width: "100%" }}>
                  {t("soldOut")}
                </SoldOutAction>
              ) : (
                <>
              <ModalControls>
                <ItemControlButton
                  type="button"
                  onClick={() => setModalQuantity((qty) => Math.max(1, qty - 1))}
                >
                  -
                </ItemControlButton>
                <span>{modalQuantity}</span>
                <ItemControlButton
                  type="button"
                  onClick={() => setModalQuantity((qty) => qty + 1)}
                >
                  +
                </ItemControlButton>
              </ModalControls>
              <ModalAddButton
                type="button"
                onClick={() => {
                  if (!selectedItem || asSoldOut(selectedItem.sold_out)) return;
                  setCart((prev) => {
                    const existing = prev.find((entry) => entry.id === selectedItem.id);
                    if (existing) {
                      return prev.map((entry) =>
                        entry.id === selectedItem.id
                          ? { ...entry, quantity: modalQuantity }
                          : entry
                      );
                    }
                    return [
                      ...prev,
                      {
                        id: selectedItem.id,
                        name: selectedItem.name,
                        description: selectedItem.description,
                        price: selectedItem.price,
                        image_url: selectedItem.image_url,
                        quantity: modalQuantity
                      }
                    ];
                  });
                  setSheetOpen(false);
                  setTimeout(() => setSelectedItem(null), 320);
                }}
              >
                {t("addToCart")}
              </ModalAddButton>
                </>
              )}
            </ModalActions>
          </ModalSheet>
        </ModalOverlay>
      )}
      {showCheckoutModal && !isDineIn && (
        <CheckoutModalOverlay onClick={closeWebsiteCheckout}>
          <CheckoutModalContent onClick={(event) => event.stopPropagation()}>
            <CheckoutModalHeader>
              <div>
                <CheckoutModalEyebrow>{t("webCheckout")}</CheckoutModalEyebrow>
                <CheckoutModalTitle>
                  {websiteFulfillment === "pickup"
                    ? t("webPickup")
                    : t("webDelivery")}
                </CheckoutModalTitle>
              </div>
              <CheckoutModalClose
                type="button"
                aria-label={t("close")}
                onClick={closeWebsiteCheckout}
              >
                ✕
              </CheckoutModalClose>
            </CheckoutModalHeader>
            <WebsiteCheckoutFields>
              <CheckoutField>
                <label htmlFor="web-modal-name">{t("webCustomerName")}</label>
                <input
                  id="web-modal-name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  autoComplete="name"
                />
              </CheckoutField>
              <CheckoutField>
                <label htmlFor="web-modal-phone">{t("webPhone")}</label>
                <input
                  id="web-modal-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  autoComplete="tel"
                />
              </CheckoutField>
              {websiteFulfillment === "delivery" && (
                <CheckoutField>
                  <label htmlFor="web-modal-address">{t("webAddress")}</label>
                  <textarea
                    id="web-modal-address"
                    rows={3}
                    placeholder={t("webAddressPlaceholder")}
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                  />
                </CheckoutField>
              )}
            </WebsiteCheckoutFields>
            <CheckoutModalTotal>
              <span>{t("total")}</span>
              <strong>{money(total)}</strong>
            </CheckoutModalTotal>
            {orderError && <ErrorText>{orderError}</ErrorText>}
            <CartPrimaryButton
              type="button"
              onClick={submitOrder}
              disabled={!cart.length || submitting}
            >
              {submitting ? t("submitting") : t("placeOrder")}
            </CartPrimaryButton>
          </CheckoutModalContent>
        </CheckoutModalOverlay>
      )}
      {showPayModal && payOrderForModal && (
        <PayModalOverlay onClick={closePayModal}>
          <PayModalContent onClick={(e) => e.stopPropagation()}>
            <PayModalTitle>{t("receiptByEmail")}</PayModalTitle>
            <PayModalText>{t("receiptByEmailText")}</PayModalText>
            <PayModalButtons>
              <PrimaryButton
                type="button"
                onClick={() => handlePayOrder(payOrderForModal, null)}
                disabled={!!paymentLoading}
              >
                {t("noThanksPayNow")}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setReceiptWanted(true)}>
                {t("yesEmailBill")}
              </GhostButton>
            </PayModalButtons>
            {receiptWanted && (
              <PayModalEmail>
                <label htmlFor="pay-receipt-email">{t("emailAddress")}</label>
                <input
                  id="pay-receipt-email"
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  value={receiptEmail}
                  onChange={(e) => setReceiptEmail(e.target.value)}
                  autoComplete="email"
                />
              </PayModalEmail>
            )}
            <PayModalActions>
              <GhostButton type="button" onClick={closePayModal}>
                {t("cancel")}
              </GhostButton>
              <PrimaryButton
                type="button"
                onClick={() =>
                  handlePayOrder(
                    payOrderForModal,
                    receiptWanted ? receiptEmail : null
                  )
                }
                disabled={receiptWanted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail)}
              >
                {t("continueToPayment")}
              </PrimaryButton>
            </PayModalActions>
          </PayModalContent>
        </PayModalOverlay>
      )}
    </Shell>
  );
};

const Shell = styled.div`
  padding: 0 16px
    ${({ $hasCart }) => ($hasCart ? "calc(120px + var(--safe-bottom))" : "calc(40px + var(--safe-bottom))")};
  max-width: 720px;
  margin: 0 auto;
  min-height: 100dvh;
  background: transparent;
`;

const TopChrome = styled.div`
  position: sticky;
  top: 0;
  z-index: 20;
  margin: 0 -16px 16px;
  padding: calc(10px + var(--safe-top)) 0 0;
  background: var(--color-page);
  border-bottom: 1px solid var(--color-border-soft);
`;

const WebsiteModeTabs = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 0 16px 12px;
`;

const WebsiteModeTab = styled.button`
  border: 1px solid
    ${({ $active }) => ($active ? "transparent" : "var(--color-border-soft)")};
  background: ${({ $active }) =>
    $active ? "var(--color-primary)" : "var(--color-surface)"};
  color: ${({ $active }) => ($active ? "#fff" : "var(--color-ink-muted)")};
  border-radius: var(--radius-pill);
  padding: 10px 8px;
  font-weight: ${({ $active }) => ($active ? 700 : 600)};
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
`;

const WebsiteCheckoutFields = styled.div`
  display: grid;
  gap: 12px;
  margin-bottom: 4px;
`;

const WebsiteFulfillmentBlock = styled.div`
  display: grid;
  gap: 12px;
`;

const WebsiteFulfillmentLabel = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 650;
  color: var(--color-ink-muted);
`;

const FulfillmentSwitch = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border-soft);
`;

const FulfillmentSwitchOption = styled.button`
  border: none;
  border-radius: var(--radius-pill);
  padding: 11px 12px;
  font-size: 14px;
  font-weight: ${({ $active }) => ($active ? 750 : 600)};
  cursor: pointer;
  background: ${({ $active }) => ($active ? "var(--color-primary)" : "transparent")};
  color: ${({ $active }) => ($active ? "#fff" : "var(--color-ink-muted)")};
  transition: background 0.15s ease, color 0.15s ease, transform 0.12s ease;

  &:active {
    transform: scale(0.98);
  }
`;

const CheckoutModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 2200;
  padding: 16px;
  padding-bottom: calc(16px + var(--safe-bottom));

  @media (min-width: 560px) {
    align-items: center;
  }
`;

const CheckoutModalContent = styled.div`
  background: #fff;
  border-radius: 20px;
  padding: 18px;
  width: min(420px, 100%);
  display: grid;
  gap: 14px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.22);
  max-height: min(88dvh, 720px);
  overflow: auto;
`;

const CheckoutModalHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const CheckoutModalEyebrow = styled.span`
  display: block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-ink-faint);
  margin-bottom: 4px;
`;

const CheckoutModalTitle = styled.h3`
  margin: 0;
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 1.15;
`;

const CheckoutModalClose = styled.button`
  border: none;
  background: var(--color-surface-muted);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  color: var(--color-ink-muted);
  flex-shrink: 0;
`;

const CheckoutModalTotal = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  padding-top: 4px;
`;

const CheckoutField = styled.div`
  display: grid;
  gap: 6px;
  min-width: 0;
  width: 100%;

  label {
    font-size: 13px;
    font-weight: 650;
    color: var(--color-ink-muted);
  }

  input,
  textarea {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 13px 14px;
    font-size: 16px;
    background: var(--color-page);
    color: var(--color-ink);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder {
      color: var(--color-ink-faint);
      opacity: 1;
    }

    &:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px var(--color-primary-soft);
    }
  }

  textarea {
    resize: vertical;
    min-height: 88px;
    line-height: 1.4;
  }
`;

const DateTimeControl = styled.div`
  position: relative;
  width: 100%;
  min-width: 0;

  input[type="date"],
  input[type="time"] {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 13px 42px 13px 14px;
    font-size: 16px;
    line-height: 1.25;
    background: var(--color-page);
    color: ${({ $empty }) => ($empty ? "transparent" : "var(--color-ink)")};
    color-scheme: light;
    cursor: pointer;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    -webkit-appearance: none;
    appearance: none;

    ${({ $empty }) =>
      $empty
        ? `
      &::-webkit-datetime-edit,
      &::-webkit-datetime-edit-fields-wrapper,
      &::-webkit-datetime-edit-text,
      &::-webkit-datetime-edit-month-field,
      &::-webkit-datetime-edit-day-field,
      &::-webkit-datetime-edit-year-field,
      &::-webkit-datetime-edit-hour-field,
      &::-webkit-datetime-edit-minute-field,
      &::-webkit-datetime-edit-second-field,
      &::-webkit-datetime-edit-ampm-field {
        color: transparent;
      }
    `
        : ""}

    &:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px var(--color-primary-soft);
    }

    &::-webkit-calendar-picker-indicator {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      cursor: pointer;
      opacity: 0.72;
      padding: 0;
      margin: 0;
    }
  }

  &:focus-within input {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-soft);
  }
`;

const DateTimePlaceholder = styled.span`
  position: absolute;
  left: 14px;
  right: 42px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--color-ink-faint);
  font-size: 16px;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 1;
`;

const ReservationScreen = styled.div`
  display: grid;
  gap: 18px;
  min-width: 0;
  padding-bottom: calc(88px + var(--safe-bottom));
`;

const ReservationHero = styled.div`
  display: grid;
  gap: 6px;
  padding: 4px 2px 2px;
`;

const ReservationTitle = styled.h1`
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.55rem, 4.5vw, 1.9rem);
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--color-ink);
`;

const ReservationIntro = styled.p`
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 14px;
  line-height: 1.45;
`;

const ReservationSection = styled.section`
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
`;

const ReservationSectionTitle = styled.h2`
  margin: 0;
  font-size: 13px;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-ink-faint);
`;

const ReservationFields = styled.div`
  display: grid;
  gap: 14px;
  min-width: 0;
`;

const ReservationRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  min-width: 0;

  @media (min-width: 420px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
`;

const ReservationFinishLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  label {
    margin: 0;
  }
`;

const ReservationDuration = styled.span`
  font-size: 12px;
  font-weight: 750;
  color: var(--color-primary-hover);
  background: var(--color-primary-soft);
  border-radius: var(--radius-pill);
  padding: 3px 8px;
`;

const GuestField = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-page);
`;

const GuestFieldCopy = styled.div`
  display: grid;
  gap: 2px;
  min-width: 0;

  span {
    font-size: 14px;
    font-weight: 650;
    color: var(--color-ink);
  }

  small {
    font-size: 12px;
    color: var(--color-ink-muted);
  }
`;

const GuestStepper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
`;

const GuestStepButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary-hover);
  }
`;

const GuestStepValue = styled.span`
  min-width: 28px;
  text-align: center;
  font-size: 16px;
  font-weight: 750;
  color: var(--color-ink);
`;

const ReservationFooter = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 25;
  padding: 12px 16px calc(12px + var(--safe-bottom));
  background: linear-gradient(
    to top,
    var(--color-page) 55%,
    rgba(250, 251, 252, 0.92) 80%,
    transparent
  );

  & > * {
    max-width: 720px;
    margin: 0 auto;
  }
`;

const ReservationSuccess = styled.div`
  text-align: center;
  padding: 8px 4px 4px;
  display: grid;
  gap: 8px;
  justify-items: center;

  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.55rem;
    font-weight: 650;
  }

  p {
    margin: 0;
    color: var(--color-ink-muted);
    max-width: 34ch;
    line-height: 1.45;
  }
`;

const ReservationSuccessIcon = styled.svg`
  width: 48px;
  height: 48px;
  stroke: var(--color-success);
  stroke-width: 1.8;
  fill: none;
`;

const ReservationConfirmWrap = styled.div`
  display: grid;
  gap: 16px;
  padding-bottom: 12px;
`;

const ReservationTicket = styled.article`
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 18px 16px 20px;
  display: grid;
  gap: 18px;
  overflow: hidden;
  position: relative;

  &::before,
  &::after {
    content: "";
    position: absolute;
    top: 58%;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-page);
  }

  &::before {
    left: -9px;
    box-shadow: inset -1px 0 0 var(--color-border-soft);
  }

  &::after {
    right: -9px;
    box-shadow: inset 1px 0 0 var(--color-border-soft);
  }
`;

const ReservationTicketHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px dashed var(--color-border);
`;

const ReservationTicketEyebrow = styled.div`
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-ink-faint);
  margin-bottom: 4px;
`;

const ReservationTicketRestaurant = styled.h3`
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 650;
  line-height: 1.2;
`;

const ReservationTicketCode = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.04em;
  color: var(--color-primary-hover);
  background: var(--color-primary-soft);
  border-radius: var(--radius-pill);
  padding: 6px 10px;
`;

const ReservationTicketGrid = styled.div`
  display: grid;
  gap: 12px;
`;

const ReservationTicketRow = styled.div`
  display: grid;
  gap: 2px;
  ${({ $full }) => ($full ? "grid-column: 1 / -1;" : "")}

  span {
    font-size: 12px;
    font-weight: 650;
    color: var(--color-ink-faint);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  strong {
    font-size: 15px;
    font-weight: 650;
    color: var(--color-ink);
    word-break: break-word;
  }
`;

const ReservationTicketQr = styled.div`
  display: grid;
  justify-items: center;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px dashed var(--color-border);

  canvas {
    display: block;
    border-radius: 12px;
  }
`;

const ReservationTicketQrHint = styled.p`
  margin: 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-ink-muted);
  max-width: 28ch;
  line-height: 1.4;
`;

const ReservationPhotoPreview = styled.div`
  display: grid;
  gap: 8px;
  justify-items: center;

  img {
    width: min(100%, 360px);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-soft);
    box-shadow: var(--shadow-sm);
    background: #fff;
  }

  p {
    margin: 0;
    text-align: center;
    font-size: 13px;
    color: var(--color-ink-muted);
    max-width: 34ch;
    line-height: 1.4;
  }
`;

const ReservationTicketActions = styled.div`
  display: grid;
  gap: 10px;

  & > button {
    width: 100%;
    min-height: 48px;
  }
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 0 16px;
`;

const BrandBlock = styled.div`
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
`;

const TablePill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  max-width: 96px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-primary-soft);
  background: var(--color-primary-soft);
  color: var(--color-primary-hover);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CallWaiterCard = styled.div`
  display: none;
`;

const CallWaiterButton = styled.button`
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: #fff;
  color: var(--color-ink);
  font-weight: 700;
  font-size: 15px;
  padding: 13px 14px;
  cursor: pointer;
  transition: 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: none;

  &:hover:not(:disabled) {
    border-color: #fdba74;
    background: #fff7ed;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const WaiterIcon = styled.svg`
  width: 18px;
  height: 18px;
  stroke: var(--color-primary);
  stroke-width: 1.8;
  fill: none;
`;

const CallWaiterButtonRow = styled.span`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const CallWaiterTimer = styled.span`
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.04em;
  color: var(--color-ink-muted);
`;

const CallWaiterNotice = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: #166534;
  font-weight: 600;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-left: 4px solid #22c55e;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
`;

const Title = styled.h1`
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(26px, 6.2vw, 32px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--color-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
`;

const SearchInput = styled.input`
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  width: 100%;
  font-size: 16px;
  box-shadow: var(--shadow-sm);

  &:focus {
    outline: none;
    border-color: #fdba74;
    box-shadow: 0 0 0 3px var(--color-primary-soft);
  }
`;

const LanguageSelect = styled.select`
  padding: 10px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-ink);
  min-width: 52px;
`;

const IconButton = styled.button`
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: none;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:active {
    background: var(--color-surface-muted);
  }

  svg {
    width: 20px;
    height: 20px;
    stroke: var(--color-ink);
    stroke-width: 2;
    stroke-linecap: round;
    fill: none;
  }
`;

const MenuWrapper = styled.div`
  position: relative;
`;

const SidebarOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  z-index: 60;
  display: flex;
  justify-content: flex-start;
  overscroll-behavior: contain;
  backdrop-filter: blur(3px);
`;

const Sidebar = styled.div`
  width: min(340px, 86vw);
  height: 100%;
  background: #fff;
  padding: 18px 16px calc(20px + var(--safe-bottom));
  padding-top: calc(16px + var(--safe-top));
  display: grid;
  gap: 18px;
  align-content: start;
  box-shadow: 12px 0 40px rgba(15, 23, 42, 0.12);
  animation: slideIn 0.25s ease;
  overflow-y: auto;
  overscroll-behavior: contain;

  @keyframes slideIn {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
    }
  }
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-border-soft);
`;

const SidebarBrand = styled.div`
  display: grid;
  gap: 4px;
  min-width: 0;
`;

const SidebarEyebrow = styled.span`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-primary-hover);
`;

const SidebarTitle = styled.h3`
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--color-ink);
`;

const SidebarClose = styled.button`
  border: 1px solid var(--color-border);
  background: #fff;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;

  svg {
    width: 16px;
    height: 16px;
    stroke: var(--color-ink);
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
  }
`;

const SidebarSection = styled.div`
  display: grid;
  gap: 10px;
`;

const SidebarSectionTitle = styled.h4`
  margin: 0;
  font-size: 11px;
  color: var(--color-ink-faint);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
`;

const SidebarList = styled.div`
  display: grid;
  gap: 8px;
`;

const SidebarRow = styled.button`
  border: 1px solid var(--color-border-soft);
  background: var(--color-page);
  text-align: left;
  padding: 12px;
  border-radius: 14px;
  cursor: ${({ $static }) => ($static ? "default" : "pointer")};
  color: var(--color-ink);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  text-decoration: none;

  &:disabled {
    opacity: 0.72;
    cursor: not-allowed;
  }
`;

const SidebarRowLeft = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const SidebarIconWrap = styled.span`
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid var(--color-border-soft);
  display: grid;
  place-items: center;
  flex-shrink: 0;
`;

const SidebarRowText = styled.span`
  font-weight: 650;
  line-height: 1.35;
  word-break: break-word;
`;

const SidebarRowMeta = styled.span`
  color: var(--color-ink-muted);
  font-size: 12px;
  white-space: nowrap;
`;

const SidebarArrow = styled.span`
  color: #cbd5e1;
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
`;

const SidebarBadge = styled.span`
  min-width: 24px;
  height: 24px;
  padding: 0 7px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary-hover);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
`;

const SidebarIcon = styled.svg`
  width: 16px;
  height: 16px;
  stroke: var(--color-primary);
  stroke-width: 1.7;
  fill: none;
`;

const SidebarHoursToggle = styled.button`
  width: 100%;
  border: 1px solid var(--color-border-soft);
  background: var(--color-page);
  text-align: left;
  padding: 12px;
  border-radius: 14px;
  cursor: pointer;
  color: var(--color-ink);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  border-bottom-left-radius: ${({ $open }) => ($open ? "0" : "14px")};
  border-bottom-right-radius: ${({ $open }) => ($open ? "0" : "14px")};
`;

const SidebarHoursCopy = styled.span`
  display: grid;
  gap: 2px;
  min-width: 0;
`;

const SidebarHoursHint = styled.span`
  font-size: 12px;
  color: var(--color-ink-muted);
  font-weight: 500;
`;

const SidebarHoursChevron = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid var(--color-border);
  display: grid;
  place-items: center;
  flex-shrink: 0;

  svg {
    width: 16px;
    height: 16px;
    stroke: var(--color-ink);
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    transform: rotate(${({ $open }) => ($open ? "180deg" : "0deg")});
    transition: transform 0.2s ease;
  }
`;

const SidebarHoursPanel = styled.div`
  display: ${({ $open }) => ($open ? "grid" : "none")};
  gap: 8px;
  padding: 4px 12px 12px;
  background: var(--color-page);
  border: 1px solid var(--color-border-soft);
  border-top: none;
  border-radius: 0 0 14px 14px;
  margin-top: -10px;
`;

const SidebarHoursRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fff;
  font-size: 13px;
  color: var(--color-ink-muted);

  strong {
    color: var(--color-ink);
    font-weight: 700;
  }
`;

const SidebarHoursEmpty = styled.p`
  margin: 0;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--color-ink-muted);
`;

const SidebarFooterNote = styled.p`
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--color-ink-faint);
  text-align: center;
`;

const SearchRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
`;

const CategoryCarousel = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 0 14px;
  margin: 0;
  scroll-snap-type: x proximity;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 12px,
    #000 calc(100% - 28px),
    transparent 100%
  );

  &::-webkit-scrollbar {
    display: none;
  }
`;

const CategoryChip = styled.button`
  position: relative;
  border: 1px solid
    ${({ $active }) => ($active ? "transparent" : "var(--color-border-soft)")};
  background: ${({ $active }) =>
    $active ? "var(--color-primary)" : "var(--color-surface)"};
  color: ${({ $active }) => ($active ? "#fff" : "var(--color-ink-muted)")};
  padding: 10px 16px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  white-space: nowrap;
  scroll-snap-align: center;
  font-size: 13.5px;
  font-weight: ${({ $active }) => ($active ? 700 : 550)};
  letter-spacing: ${({ $active }) => ($active ? "0.01em" : "0")};
  line-height: 1;
  box-shadow: none;
  flex-shrink: 0;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease,
    transform 0.15s ease;

  &:first-child {
    margin-left: 16px;
  }

  &:last-child {
    margin-right: 16px;
  }

  &:hover {
    color: ${({ $active }) => ($active ? "#fff" : "var(--color-ink)")};
    border-color: ${({ $active }) =>
      $active ? "transparent" : "var(--color-border)"};
  }

  &:active {
    transform: scale(0.96);
  }
`;

const Section = styled.section`
  margin-bottom: 22px;
  scroll-margin-top: 140px;

  h2 {
    margin-bottom: 12px;
  }
`;

const CategoryHeader = styled.button`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: ${({ $collapsed }) => ($collapsed ? "var(--color-surface)" : "transparent")};
  border: ${({ $collapsed }) => ($collapsed ? "1px solid var(--color-border)" : "none")};
  border-radius: var(--radius-md);
  padding: ${({ $collapsed }) => ($collapsed ? "14px 14px" : "0 2px")};
  margin-bottom: ${({ $collapsed }) => ($collapsed ? "0" : "12px")};
  cursor: pointer;
  box-shadow: ${({ $collapsed }) => ($collapsed ? "var(--shadow-sm)" : "none")};
  transition: box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease,
    padding 0.2s ease;

  h2 {
    margin: 0;
    color: var(--color-ink);
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
`;

const Chevron = styled.span`
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: rotate(${({ $expanded }) => ($expanded ? "0deg" : "-90deg")});
  transition: transform 0.45s ease;

  svg {
    width: 18px;
    height: 18px;
    stroke: var(--color-ink);
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const ExploreBadge = styled.span`
  display: inline-block;
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  background: #fff7ed;
  color: #9a3412;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
`;

const CategoryContent = styled.div`
  overflow: hidden;
  max-height: ${({ $expanded }) => ($expanded ? "2400px" : "0")};
  opacity: ${({ $expanded }) => ($expanded ? 1 : 0)};
  transform: translateY(${({ $expanded }) => ($expanded ? "0" : "-10px")});
  transform-origin: top;
  transition: max-height 0.35s ease, opacity 0.2s ease, transform 0.25s ease;

  ${({ $expanded }) =>
    $expanded &&
    `
    transition: max-height 1.1s ease, opacity 0.75s ease 0.16s,
      transform 0.95s ease;
  `}
`;

const Items = styled.div`
  display: grid;
  gap: 10px;
`;

const ItemCard = styled.div`
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: stretch;
  border: 1px solid var(--color-border-soft);
  box-shadow: var(--shadow-sm);
  opacity: ${(props) => (props.$soldOut ? 0.72 : 1)};
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:active {
    transform: scale(0.995);
  }

  h3 {
    margin: 0;
  }

  p {
    margin: 0;
    color: var(--color-ink-muted);
    font-size: 15px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

const ItemTitleRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 2px;

  h2,
  h3 {
    margin: 0;
  }
`;

const SoldOutPill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: rgba(220, 38, 38, 0.1);
  color: var(--color-danger);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

const SoldOutAction = styled.button`
  background: var(--color-surface-muted);
  color: var(--color-ink-faint);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 8px 14px;
  font-weight: 700;
  font-size: 12px;
  cursor: not-allowed;
  width: 100%;
`;

const ItemContentButton = styled.button`
  border: none;
  background: transparent;
  text-align: left;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  cursor: pointer;

  h3,
  strong {
    color: var(--color-ink);
  }

  h3 {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.25;
  }

  strong {
    margin-top: auto;
    padding-top: 6px;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-primary-hover);
  }
`;

const ItemActions = styled.div`
  display: grid;
  gap: 8px;
  justify-items: end;
  align-content: start;
  width: 120px;
`;

const ItemMedia = styled.div`
  position: relative;
  width: 120px;
`;

const ItemImage = styled.img`
  width: 120px;
  height: 120px;
  border-radius: 12px;
  object-fit: contain;
  background: #fff;
  display: block;
  filter: ${(props) => (props.$soldOut ? "grayscale(0.85)" : "none")};
  opacity: ${(props) => (props.$soldOut ? 0.85 : 1)};
`;

const ItemImagePlaceholder = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 12px;
  background: linear-gradient(145deg, #f8fafc, #e2e8f0);
  display: grid;
  place-items: center;

  svg {
    width: 30px;
    height: 30px;
    stroke: #94a3b8;
    stroke-width: 1.5;
    fill: none;
  }
`;

const ItemImageButton = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: block;
  border-radius: 12px;
  overflow: hidden;
`;

const QuickAddBadge = styled.button`
  position: absolute;
  right: -6px;
  left: auto;
  bottom: -10px;
  transform: none;
  min-width: 72px;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  border: 2px solid #fff;
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: none;
`;

const MenuItemControls = styled.div`
  position: absolute;
  right: -6px;
  left: auto;
  bottom: -10px;
  transform: none;
  width: calc(100% - 8px);
  max-width: 112px;
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  height: 34px;
  justify-content: space-between;
  padding: 0 4px;
  background: #fff;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
`;

const ItemControlButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  font-size: 18px;
  font-weight: 700;
`;

const MenuItemControlButton = styled.button`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  font-weight: 700;
  display: grid;
  place-items: center;
`;

const EmptyState = styled.div`
  display: grid;
  gap: 8px;
  justify-items: center;
  text-align: center;
  padding: 36px 16px;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
`;

const EmptyTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  color: var(--color-ink);
`;

const EmptyText = styled.p`
  margin: 0 0 8px;
  color: var(--color-ink-muted);
  font-size: 14px;
`;

const CartSummaryLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CartBadge = styled.span`
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
`;

const CartImagePlaceholder = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 10px;
  background: linear-gradient(145deg, #f8fafc, #e2e8f0);
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  align-items: end;
  z-index: 50;
  overscroll-behavior: contain;
  backdrop-filter: blur(2px);
`;

const ModalSheet = styled.div`
  background: var(--color-surface);
  border-radius: 22px 22px 0 0;
  padding: 16px 16px calc(16px + var(--safe-bottom));
  display: grid;
  gap: 12px;
  max-height: 88vh;
  overflow-y: auto;
  transform: translateY(${({ $open, $offset }) => ($open ? $offset : 1000)}px);
  transition: ${({ $dragging }) => ($dragging ? "none" : "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)")};
  touch-action: pan-y;
  position: relative;
  overscroll-behavior: contain;
  box-shadow: 0 -12px 40px rgba(15, 23, 42, 0.18);
`;

const ModalHandle = styled.div`
  width: 42px;
  height: 4px;
  border-radius: var(--radius-pill);
  background: #cbd5e1;
  margin: 0 auto;
  cursor: grab;
`;

const ModalClose = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  border: none;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  font-size: 16px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  cursor: pointer;
  z-index: 2;
`;

const ModalImage = styled.img`
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  background: #fff;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-soft);
`;

const ModalContent = styled.div`
  display: grid;
  gap: 6px;

  h2 {
    margin: 0;
    font-size: 22px;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    color: var(--color-ink-muted);
    line-height: 1.45;
    font-size: 15px;
  }
`;

const ModalPrice = styled.span`
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary-hover);
`;

const ModalActions = styled.div`
  display: grid;
  grid-template-columns: 42% 1fr;
  gap: 12px;
  align-items: center;
  width: 100%;
`;

const ModalControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  height: 50px;
  padding: 0 10px;
  width: 100%;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 700;
  background: var(--color-surface-muted);
`;

const ModalAddButton = styled.button`
  background: var(--color-primary);
  color: #fff;
  border: none;
  height: 50px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  width: 100%;
  font-size: 16px;
  font-weight: 700;
  box-shadow: none;
`;

const Cart = styled.div`
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: grid;
  gap: 12px;
`;

const StickyCart = styled(Cart)`
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(12px + var(--safe-bottom));
  max-width: 720px;
  margin: 0 auto;
  padding: 10px 10px 10px 14px;
  border-radius: 18px;
  background: #0f172a;
  color: #fff;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
  z-index: 10;
  border: 1px solid rgba(255, 255, 255, 0.06);
`;

const OrdersBar = styled(StickyCart)`
  bottom: ${({ $aboveCart }) =>
    $aboveCart ? "calc(84px + var(--safe-bottom))" : "calc(12px + var(--safe-bottom))"};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: var(--color-surface);
  color: var(--color-ink);
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
`;

const CartScreen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  width: min(720px, 100%);
  margin: 0 auto;
  left: 0;
  right: 0;
  background: var(--color-page);
  display: flex;
  flex-direction: column;
  padding: calc(12px + var(--safe-top)) 16px 0;
  overflow: hidden;
`;

const CartTopBar = styled.div`
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  background: var(--color-page);
  padding: 4px 0 14px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--color-border-soft);
`;

const CartBackButton = styled.button`
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--color-ink);
  padding: 8px 10px 8px 4px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 700;
  font-size: 15px;
  line-height: 1;

  svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:active {
    opacity: 0.7;
  }
`;

const BackButton = styled.button`
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-ink);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
`;

const CartTitleBlock = styled.div`
  display: grid;
  gap: 2px;
  justify-items: center;
  text-align: center;
`;

const CartTitle = styled.h2`
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
`;

const CartSubtitle = styled.span`
  font-size: 12px;
  font-weight: 650;
  color: var(--color-ink-muted);
`;

const CartMeta = styled.span`
  justify-self: end;
  font-size: 12px;
  color: var(--color-primary-hover);
  font-weight: 750;
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary-soft);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CartMetaSpacer = styled.span`
  justify-self: end;
  width: 72px;
  height: 1px;
`;

const CartList = styled.div`
  display: grid;
  gap: 0;
`;

const CartBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 8px 8px;
  display: flex;
  flex-direction: column;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  ${({ $empty }) =>
    $empty
      ? `
    justify-content: center;
    align-items: stretch;
  `
      : ""}
`;

const CartInfo = styled.div`
  display: grid;
  gap: 4px;
  min-width: 0;

  > span:first-child {
    font-weight: 700;
  }
`;

const SmallText = styled.span`
  font-size: 12px;
  color: var(--color-ink-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const LineTotal = styled.span`
  font-weight: 700;
`;

const CartControls = styled.div`
  display: grid;
  gap: 10px;
  justify-items: end;
  align-items: end;
`;

const CartSummary = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const SummaryText = styled.p`
  margin: 0;
  font-weight: 700;
  font-size: 15px;
`;

const OrderButton = styled.button`
  border: none;
  background: var(--color-primary);
  color: #fff;
  padding: 12px 18px;
  border-radius: 14px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 700;
  min-width: 118px;
  box-shadow: none;
`;

const CartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CartRow = styled.div`
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border-soft);
  background: transparent;
`;

const CartImage = styled.img`
  width: 64px;
  height: 64px;
  border-radius: 10px;
  object-fit: contain;
  background: #fff;
  border: 1px solid var(--color-border-soft);
`;

const QuantityControls = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  font-weight: 700;
`;

const SmallButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  font-weight: 700;
`;

const TotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  padding-top: 8px;
  border-top: 1px solid var(--color-border-soft);
  font-size: 16px;
`;

const CartFooter = styled.div`
  flex-shrink: 0;
  background: var(--color-page);
  padding: 12px 0 calc(12px + var(--safe-bottom));
  display: grid;
  gap: 10px;
  border-top: 1px solid var(--color-border-soft);
`;

const CommentField = styled.textarea`
  resize: none;
  min-height: 70px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-family: inherit;
  font-size: 16px;
  background: #fafbfc;

  &:focus {
    outline: none;
    border-color: #fdba74;
    box-shadow: 0 0 0 3px var(--color-primary-soft);
  }
`;

const PrimaryButton = styled.button`
  border: none;
  background: var(--color-primary);
  color: #fff;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  box-shadow: none;
  width: 80%;
  max-width: 420px;
  font-weight: 700;
  font-size: 15px;
`;

const CartPrimaryButton = styled(PrimaryButton)`
  width: 100%;
  max-width: none;
  border-radius: 14px;
  height: 50px;
`;

const StatusLoading = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.88);
  display: grid;
  place-items: center;
  gap: 8px;
  color: var(--color-ink);
  font-size: 14px;
  font-weight: 600;
  z-index: 60;
  backdrop-filter: blur(4px);
`;

const Spinner = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid #e2e8f0;
  border-top-color: var(--color-primary);
  animation: spin 0.9s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const AcceptanceOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  z-index: 70;
  padding: 20px;
  backdrop-filter: blur(4px);
`;

const AcceptanceCard = styled.div`
  width: min(360px, 100%);
  background: #fff;
  border-radius: 20px;
  padding: 28px 22px 20px;
  display: grid;
  gap: 10px;
  justify-items: center;
  text-align: center;
`;

const AcceptanceIcon = styled.svg`
  width: 56px;
  height: 56px;
  fill: none;
  stroke: #16a34a;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  margin-bottom: 4px;
`;

const AcceptanceTitle = styled.h3`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-ink);
`;

const AcceptanceText = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--color-ink-muted);
`;

const AcceptanceButton = styled.button`
  margin-top: 8px;
  width: 100%;
  border: none;
  border-radius: 14px;
  background: var(--color-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  height: 48px;
  cursor: pointer;

  &:disabled {
    opacity: 0.7;
    cursor: default;
  }
`;

const FeedbackCard = styled(AcceptanceCard)`
  gap: 12px;
  justify-items: stretch;
  text-align: left;

  ${AcceptanceTitle},
  ${AcceptanceText} {
    text-align: center;
  }

  ${AcceptanceIcon} {
    justify-self: center;
  }
`;

const FeedbackRatingBlock = styled.div`
  display: grid;
  gap: 6px;
`;

const FeedbackRatingLabel = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: var(--color-ink);
`;

const StarRow = styled.div`
  display: flex;
  gap: 4px;
  justify-content: center;
`;

const StarButton = styled.button`
  border: none;
  background: transparent;
  padding: 2px 4px;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  color: ${({ $active }) => ($active ? "#f59e0b" : "#d1d5db")};
  transition: color 0.12s ease, transform 0.12s ease;

  &:hover {
    transform: scale(1.08);
  }
`;

const FeedbackComment = styled.textarea`
  width: 100%;
  resize: vertical;
  min-height: 72px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  color: var(--color-ink);
  background: #fff;
`;

const FeedbackError = styled.p`
  margin: 0;
  color: var(--color-danger);
  font-size: 13px;
  text-align: center;
`;

const FeedbackSkip = styled.button`
  border: none;
  background: transparent;
  color: var(--color-ink-muted);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px;
`;

const GhostButton = styled.button`
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-ink);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 600;
`;

const ErrorText = styled.p`
  margin: 0;
  color: var(--color-danger);
  font-size: 14px;
`;

const StatusCard = styled.div`
  background: transparent;
  border-radius: 0;
  padding: var(--safe-top) 0 calc(28px + var(--safe-bottom));
  text-align: left;
  display: grid;
  gap: 14px;
`;

const StatusHeaderBlock = styled.div`
  position: sticky;
  top: 0;
  z-index: 8;
  background: var(--color-page);
  padding: 8px 0 12px;
  display: grid;
  gap: 10px;
`;

const StatusTopBar = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
`;

const StatusBackButton = styled.button`
  height: 42px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  padding: 0 12px 0 8px;
  justify-self: start;
  color: var(--color-ink);
  font-size: 14px;
  font-weight: 700;

  svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    stroke-width: 2.2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:active {
    background: var(--color-surface-muted);
  }
`;

const StatusTopCenter = styled.div`
  display: none;
`;

const StatusTitleWrap = styled.div`
  display: grid;
  gap: 2px;
  justify-items: center;
  text-align: center;
`;

const StatusTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: var(--color-ink);
  letter-spacing: -0.02em;
  line-height: 1.1;
  text-align: center;
`;

const StatusTablePill = styled.span`
  justify-self: end;
  max-width: 130px;
  padding: 8px 10px;
  border-radius: var(--radius-pill);
  background: #fff;
  border: 1px solid var(--color-border);
  color: var(--color-ink);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatusInfoText = styled.p`
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid var(--color-border-soft);
  color: var(--color-ink-muted);
  font-size: 13px;
  line-height: 1.45;
  text-align: center;
`;

const StatusSubtitle = styled.p`
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-ink-muted);
  letter-spacing: 0.02em;
`;

const StatusCountPill = styled.span`
  display: none;
`;

const OrdersList = styled.div`
  display: grid;
  gap: 12px;
`;

const StatusBadge = styled.span`
  display: none;
`;

const OrderItems = styled.div`
  display: grid;
  gap: 8px;
`;

const OrderComment = styled.div`
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 247, 237, 0.95);
  color: #9a3412;

  strong {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  span {
    font-size: 14px;
    line-height: 1.4;
  }
`;

const OrderRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  font-size: 14px;
  padding: 0;

  strong {
    font-weight: 700;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
`;

const OrderItemLeft = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const OrderQty = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--color-surface-muted);
  color: var(--color-ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
`;

const OrderCard = styled.div`
  background: var(--color-surface);
  border-radius: 20px;
  overflow: hidden;
  border: 1.5px solid
    ${({ $tone }) =>
      $tone === "accepted" || $tone === "preparing"
        ? "var(--color-primary)"
        : "var(--color-border-soft)"};
  cursor: pointer;
  display: grid;
`;

const OrderBanner = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: ${({ $tone }) =>
    $tone === "accepted" || $tone === "preparing" ? "#0f172a" : "#fff"};
  background: ${({ $tone }) =>
    $tone === "ready" || $tone === "finish"
      ? "linear-gradient(135deg, #166534 0%, #22c55e 100%)"
      : $tone === "accepted" || $tone === "preparing"
        ? "#ffffff"
        : "linear-gradient(135deg, #334155 0%, #475569 100%)"};
  border-bottom: ${({ $tone }) =>
    $tone === "accepted" || $tone === "preparing"
      ? "1px solid rgba(249, 115, 22, 0.18)"
      : "none"};
`;

const OrderBannerSide = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  justify-content: ${({ $end }) => ($end ? "flex-end" : "flex-start")};

  & > div {
    background: ${({ $tone }) =>
      $tone === "accepted" || $tone === "preparing"
        ? "rgba(249, 115, 22, 0.08)"
        : "rgba(255, 255, 255, 0.18)"};
    border: 1px solid
      ${({ $tone }) =>
        $tone === "accepted" || $tone === "preparing"
          ? "rgba(249, 115, 22, 0.28)"
          : "rgba(255, 255, 255, 0.28)"};
  }

  span {
    color: ${({ $tone }) =>
      $tone === "accepted" || $tone === "preparing" ? "#0f172a" : "#fff"} !important;
  }
`;

const OrderBannerCenter = styled.div`
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 8px;
  min-width: 110px;
`;

const OrderBannerLeft = styled.div`
  display: none;
`;

const OrderBannerEyebrow = styled.span`
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  opacity: 0.85;
`;

const OrderBannerStatus = styled.span`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  text-align: center;
  color: ${({ $tone }) =>
    $tone === "accepted" || $tone === "preparing" ? "#0f172a" : "inherit"};
`;

const OrderProcessTrack = styled.div`
  width: 84px;
  height: 4px;
  border-radius: 999px;
  background: rgba(249, 115, 22, 0.16);
  overflow: hidden;
  position: relative;
`;

const OrderProcessBar = styled.div`
  height: 100%;
  width: ${({ $progress }) => `${Math.round(($progress ?? 0.2) * 100)}%`};
  border-radius: 999px;
  background: linear-gradient(90deg, #fb923c 0%, #f97316 55%, #ea580c 100%);
  box-shadow: 0 0 10px rgba(249, 115, 22, 0.45);
  transition: width 0.6s ease;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.55) 50%,
      transparent 100%
    );
    animation: processShine 1.4s ease-in-out infinite;
  }

  @keyframes processShine {
    0% {
      transform: translateX(-120%);
    }
    100% {
      transform: translateX(120%);
    }
  }
`;

const OrderBannerTimer = styled.div`
  display: none;
`;

const OrderChevron = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${({ $tone }) =>
    $tone === "accepted" || $tone === "preparing" ? "#fff" : "rgba(255, 255, 255, 0.18)"};
  border: 1px solid
    ${({ $tone }) =>
      $tone === "accepted" || $tone === "preparing"
        ? "var(--color-primary)"
        : "rgba(255, 255, 255, 0.28)"};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    width: 16px;
    height: 16px;
    stroke: ${({ $tone }) =>
      $tone === "accepted" || $tone === "preparing" ? "#0f172a" : "#fff"};
    stroke-width: 2.2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    transform: rotate(${({ $open }) => ($open ? "180deg" : "0deg")});
    transition: transform 0.2s ease;
  }
`;

const OrderBody = styled.div`
  padding: 14px 16px 16px;
  background: #fff;
`;

const OrderCompactRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const OrderCompactMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--color-ink-muted);

  strong {
    color: var(--color-ink);
    font-weight: 700;
  }
`;

const OrderDot = styled.span`
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #cbd5e1;
`;

const OrderExpandHint = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary-hover);
`;

const OrderDetails = styled.div`
  display: grid;
  gap: 12px;
`;

const OrderTicketTop = styled.div`
  display: none;
`;

const OrderTicketLabel = styled.span`
  display: none;
`;

const OrderStatusHero = styled.div`
  display: none;
`;

const OrderStatusWord = styled.h3`
  display: none;
`;

const OrderStatusHint = styled.p`
  display: none;
`;

const OrderTicketDivider = styled.div`
  display: none;
`;

const OrderSummaryRow = styled.div`
  display: none;
`;

const OrderCollapsedHint = styled.p`
  display: none;
`;

const OrderProgress = styled.div`
  display: none;
`;

const OrderProgressStep = styled.div`
  display: none;
`;

const OrderProgressDot = styled.div`
  display: none;
`;

const StatusGroup = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--color-surface-muted);
  padding: 6px 10px;
  border-radius: var(--radius-pill);
`;

const ToggleButton = styled.button`
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  width: 34px;
  height: 34px;
  cursor: pointer;
  color: var(--color-ink);
  display: grid;
  place-items: center;
  border-radius: 50%;
  box-shadow: none;
  flex-shrink: 0;

  svg {
    width: 18px;
    height: 18px;
    stroke: var(--color-ink);
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.2s ease;
  }
`;

const PayModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px;
`;

const PayModalContent = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  max-width: 360px;
  width: 100%;
  display: grid;
  gap: 16px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);

  label {
    font-size: 14px;
    font-weight: 500;
    color: #334155;
  }
  input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    font-size: 16px;
    margin-top: 6px;
  }
`;

const PayModalTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  color: #0f172a;
`;

const PayModalText = styled.p`
  margin: 0;
  font-size: 15px;
  color: #64748b;
`;

const PayModalButtons = styled.div`
  display: flex;
  gap: 10px;
`;

const PayModalEmail = styled.div`
  display: grid;
  gap: 4px;
`;

const PayModalActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 8px;

  button:last-child {
    flex: 1;
  }
`;

const PayButton = styled.button`
  margin-top: 4px;
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  border: none;
  background: #16a34a;
  color: white;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  box-shadow: none;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const OrderTotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-soft);
  font-size: 15px;

  strong {
    color: var(--color-ink);
    font-size: 16px;
    font-variant-numeric: tabular-nums;
  }
`;

const OrderHeader = styled.div`
  display: none;
`;

const OrderHeaderMain = styled.div`
  display: none;
`;

const OrderHeaderRight = styled.div`
  display: none;
`;

const OrderMetaRow = styled.div`
  display: none;
`;

const OrderNumber = styled.span`
  display: none;
`;

const timerPulse = keyframes`
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.2); }
  50% { opacity: 0.92; box-shadow: 0 0 0 4px rgba(34,197,94,0.08); }
`;
const overtimePulse = keyframes`
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(249,115,22,0.3); }
  50% { opacity: 0.95; box-shadow: 0 0 0 3px rgba(249,115,22,0.15); }
`;
const over15Pulse = keyframes`
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
  50% { opacity: 0.9; box-shadow: 0 0 0 3px rgba(239,68,68,0.2); }
`;

const TimerBadge = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  background: ${({ $state }) =>
    $state === "ready" ? "rgba(34,197,94,0.12)" :
    $state === "overtime" ? "rgba(249,115,22,0.12)" :
    $state === "over15" ? "rgba(239,68,68,0.12)" :
    "rgba(34,197,94,0.08)"};
  ${({ $state }) =>
    $state === "countdown" ? css`animation: ${timerPulse} 2s ease-in-out infinite;` :
    $state === "overtime" ? css`animation: ${overtimePulse} 1.5s ease-in-out infinite;` :
    $state === "over15" ? css`animation: ${over15Pulse} 1s ease-in-out infinite;` :
    css`animation: none;`}
`;

const TimerText = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ $ready }) => ($ready ? "#22c55e" : "inherit")};
`;

const TimerFinishedWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
`;

const TimerLabel = styled.span`
  font-size: 9px;
  font-weight: 600;
  color: #22c55e;
`;

const TimerCheckmark = styled.svg`
  width: 16px;
  height: 16px;
  color: #22c55e;
`;

const Footer = styled.footer`
  margin-top: 28px;
  border-radius: 24px;
  background: #fff;
  border: 1px solid var(--color-border-soft);
  color: var(--color-ink);
  padding: 20px 16px 16px;
  display: grid;
  gap: 18px;
`;

const FooterTop = styled.div`
  display: grid;
  gap: 12px;
`;

const FooterBrandBlock = styled.div`
  display: grid;
  gap: 4px;
  text-align: center;
`;

const FooterInner = styled.div`
  display: none;
`;

const FooterBrand = styled.div`
  display: none;
`;

const FooterLogo = styled.h3`
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-ink);
`;

const FooterTagline = styled.p`
  margin: 0;
  font-size: 13px;
  color: var(--color-ink-muted);
`;

const FooterColumn = styled.div`
  display: none;
`;

const FooterSection = styled.section`
  display: grid;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border-soft);
`;

const FooterTitle = styled.h4`
  margin: 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-ink-faint);
  font-weight: 700;
`;

const FooterContactList = styled.div`
  display: grid;
  gap: 8px;
`;

const FooterText = styled.p`
  margin: 0;
  font-size: 14px;
  color: var(--color-ink);
  line-height: 1.4;
`;

const FooterItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--color-page);
  text-decoration: none;
  color: inherit;
`;

const FooterIcon = styled.svg`
  width: 18px;
  height: 18px;
  stroke: var(--color-primary);
  stroke-width: 1.7;
  fill: none;
  flex-shrink: 0;
  margin-top: 1px;
`;

const FooterLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const FooterLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-ink);
  text-decoration: none;
  padding: 8px 12px;
  border-radius: var(--radius-pill);
  background: var(--color-page);
  border: 1px solid var(--color-border-soft);
`;

const FooterLinkIcon = styled.svg`
  width: 14px;
  height: 14px;
  stroke: var(--color-primary);
  stroke-width: 1.6;
  fill: none;
`;

const FooterBottom = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  color: var(--color-ink-faint);
  border-top: 1px solid var(--color-border-soft);
  padding-top: 12px;
  flex-wrap: wrap;
`;

const HoursList = styled.div`
  display: grid;
  gap: 6px;
`;

const HoursRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--color-ink-muted);
  gap: 12px;
  padding: 4px 0;

  strong {
    color: var(--color-ink);
    font-weight: 600;
  }
`;

const HoursDay = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--color-ink);
`;

export default CustomerMenu;
