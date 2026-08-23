import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  Pressable,
  Linking,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import styled from "styled-components/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { supabase } from "@/src/services/supabase";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlanGate } from "@/src/components/PlanGate";

type SlideToActionProps = {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  accent: string;
  labelColor: string;
  trackBg: string;
  trackBorder: string;
  thumbBg: string;
  disabled?: boolean;
  large?: boolean;
  onConfirm: () => void;
};

function SlideToAction({
  label,
  icon,
  accent,
  labelColor,
  trackBg,
  trackBorder,
  thumbBg,
  disabled,
  large = false,
  onConfirm,
}: SlideToActionProps) {
  const THUMB = large ? 40 : 34;
  const PAD = 3;
  const trackW = useRef(0);
  const triggered = useRef(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const disabledRef = useRef(disabled);
  const onConfirmRef = useRef(onConfirm);
  disabledRef.current = disabled;
  onConfirmRef.current = onConfirm;

  const maxTravel = () => Math.max(0, trackW.current - THUMB - PAD * 2);

  const reset = (animated = true) => {
    triggered.current = false;
    if (animated) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: false,
        bounciness: 6,
        speed: 18,
      }).start();
    } else {
      translateX.setValue(0);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: (_, g) =>
        !disabledRef.current && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        triggered.current = false;
        translateX.stopAnimation();
        translateX.setValue(0);
      },
      onPanResponderMove: (_, g) => {
        translateX.setValue(Math.min(maxTravel(), Math.max(0, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const max = maxTravel();
        const current = Math.min(max, Math.max(0, g.dx));
        if (max > 0 && current >= max * 0.72 && !triggered.current) {
          triggered.current = true;
          Animated.timing(translateX, {
            toValue: max,
            duration: 90,
            useNativeDriver: false,
          }).start(() => {
            onConfirmRef.current();
            setTimeout(() => reset(true), 220);
          });
        } else {
          reset(true);
        }
      },
      onPanResponderTerminate: () => reset(true),
    })
  ).current;

  const labelOpacity = translateX.interpolate({
    inputRange: [0, 56],
    outputRange: [1, 0.12],
    extrapolate: "clamp",
  });

  return (
    <SlideTrack
      onLayout={(e: LayoutChangeEvent) => {
        trackW.current = e.nativeEvent.layout.width;
      }}
      style={{
        backgroundColor: trackBg,
        borderColor: trackBorder,
        opacity: disabled ? 0.5 : 1,
        height: large ? 50 : 42,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
          opacity: labelOpacity,
        }}
      >
        <SlideHint style={{ paddingLeft: large ? 48 : 40 }}>
          <Ionicons name="chevron-forward" size={large ? 14 : 12} color={accent} />
          <SlideHintText
            style={{ color: labelColor, fontSize: large ? 14 : 11 }}
            numberOfLines={1}
          >
            {label}
          </SlideHintText>
        </SlideHint>
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          left: PAD,
          top: PAD,
          bottom: PAD,
          width: THUMB,
          transform: [{ translateX }],
          zIndex: 2,
        }}
        {...(disabled ? {} : panResponder.panHandlers)}
      >
        <SlideThumb style={{ backgroundColor: thumbBg, borderColor: trackBorder }}>
          <Ionicons name={icon} size={large ? 18 : 16} color={accent} />
        </SlideThumb>
      </Animated.View>
    </SlideTrack>
  );
}

type Reservation = {
  id: string;
  customer_name: string | null;
  phone_number: string | null;
  guest_count: number | null;
  reservation_date: string | null;
  reservation_time: string | null;
  reservation_end_time?: string | null;
  notes?: string | null;
  table_id?: string | null;
  source?: string | null;
  reservation_tables?: Array<{
    table_id?: string | null;
    tables?: { table_number?: number | null } | null;
  }> | null;
  status: "booked" | "seated" | "cancelled" | "completed" | string | null;
};

type TableOption = {
  id: string;
  table_number: number | null;
  table_name?: string | null;
};

type ReservationFormData = {
  name: string;
  phone: string;
  guests: string;
  day: string;
  time: string;
  durationMins: string;
  notes: string;
  tableIds: string[];
};

function getMissingReservationRequiredFields(
  f: ReservationFormData,
  t: (key: string) => string
): string[] {
  const out: string[] = [];
  if (!f.name?.trim()) out.push(t("reservationsFieldName"));
  const g = Number(f.guests);
  if (!f.guests?.toString().trim() || !Number.isFinite(g) || g < 1 || g > 100) out.push(t("reservationsPickerGuests"));
  if (!f.day?.trim()) out.push(t("reservationsFieldDay"));
  if (!f.time?.trim()) out.push(t("reservationsFieldTime"));
  return out;
}

function getDayBounds(baseDate: Date) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function formatFilterDayMonth(date: Date, locale?: string) {
  return date.toLocaleDateString(locale || undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}

function getDayOffsetForDate(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const picked = new Date(date);
  picked.setHours(0, 0, 0, 0);
  return Math.round((picked.getTime() - today.getTime()) / 86400000);
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getTimeGroupKey(item: Reservation) {
  const raw = item.reservation_time ?? item.reservation_date ?? null;
  if (!raw) return -1;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return -2;
  return d.getHours() * 60 + d.getMinutes();
}

function formatTimeRange(item: Reservation) {
  const start = formatTime(item.reservation_time ?? item.reservation_date);
  const end = formatTime(item.reservation_end_time);
  if (!item.reservation_end_time || end === "—") return start;
  return `${start} - ${end}`;
}

function toInputDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildReservationIso(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map((n) => Number(n || 0));
  const [h, m] = timeValue.split(":").map((n) => Number(n || 0));
  const d = new Date(year, Math.max(0, month - 1), day, h, m, 0, 0);
  return d.toISOString();
}

function addMinutesToTimeValue(timeValue: string, deltaMinutes: number) {
  const [h, m] = String(timeValue || "00:00").split(":");
  const total = (Number(h || 0) * 60 + Number(m || 0) + deltaMinutes + 24 * 60) % (24 * 60);
  const nextH = String(Math.floor(total / 60)).padStart(2, "0");
  const nextM = String(total % 60).padStart(2, "0");
  return `${nextH}:${nextM}`;
}

function formatDurationLabel(totalMinutes: number) {
  const mins = Math.max(15, Math.floor(totalMinutes / 15) * 15);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function addDaysToDateValue(dateValue: string, deltaDays: number) {
  const [year, month, day] = dateValue.split("-").map((n) => Number(n || 0));
  const d = new Date(year, Math.max(0, month - 1), day || 1);
  d.setDate(d.getDate() + deltaDays);
  return toInputDateValue(d);
}

const MONTH_KEYS = [
  "monthJan",
  "monthFeb",
  "monthMar",
  "monthApr",
  "monthMay",
  "monthJun",
  "monthJul",
  "monthAug",
  "monthSep",
  "monthOct",
  "monthNov",
  "monthDec",
] as const;

function toDisplayDayDmy(dateValue: string, t?: (key: string) => string) {
  const [year, month, day] = String(dateValue || "").split("-").map((n) => Number(n || 0));
  if (!year || !month || !day) return dateValue;
  const idx = Math.max(0, Math.min(11, month - 1));
  const monthLabel = t ? t(MONTH_KEYS[idx]) : MONTH_KEYS[idx];
  return `${String(day).padStart(2, "0")} ${monthLabel}`;
}

function toDisplayFormDay(dateValue: string, locale?: string) {
  const [year, month, day] = String(dateValue || "").split("-").map((n) => Number(n || 0));
  if (!year || !month || !day) return dateValue;
  return new Date(year, month - 1, day).toLocaleDateString(locale || undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function buildDayOptions(anchorValue: string, radius = 45) {
  const anchor = addDaysToDateValue(anchorValue || toInputDateValue(new Date()), 0);
  const out: string[] = [];
  for (let i = -radius; i <= radius; i += 1) {
    out.push(addDaysToDateValue(anchor, i));
  }
  return out;
}

function buildTimeOptions(step = 15) {
  const out: string[] = [];
  for (let mins = 0; mins < 24 * 60; mins += step) {
    const h = String(Math.floor(mins / 60)).padStart(2, "0");
    const m = String(mins % 60).padStart(2, "0");
    out.push(`${h}:${m}`);
  }
  return out;
}

function isoToTimeValue(iso: string | null | undefined) {
  if (!iso) return "00:00";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "00:00";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function timeValueToDate(timeValue: string, dayValue?: string) {
  const base = dayValue
    ? (() => {
        const [Y, M, D] = String(dayValue).split("-").map((n) => Number(n || 0));
        return Y && M && D ? new Date(Y, M - 1, D, 12, 0, 0, 0) : new Date();
      })()
    : new Date();
  const [h, m] = String(timeValue || "00:00").split(":").map((n) => Number(n || 0));
  base.setHours(h || 0, m || 0, 0, 0);
  return base;
}

function dateValueToDate(dateValue: string) {
  const [Y, M, D] = String(dateValue || "").split("-").map((n) => Number(n || 0));
  if (Y && M && D) return new Date(Y, M - 1, D, 12, 0, 0, 0);
  return new Date();
}

function dateToQuarterTimeValue(date: Date) {
  const total = date.getHours() * 60 + date.getMinutes();
  const rounded = Math.round(total / 15) * 15;
  const normalized = ((rounded % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getDurationFromIso(startIso: string | null | undefined, endIso: string | null | undefined) {
  if (!startIso || !endIso) return 120;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 120;
  const diff = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
  return Math.max(15, Math.min(360, diff));
}

const RESERVATION_LIST_SELECT =
  "id, customer_name, phone_number, guest_count, reservation_date, reservation_time, reservation_end_time, notes, table_id, status, source, reservation_tables(table_id, tables(table_number))";
const RESERVATION_LIST_SELECT_FALLBACK =
  "id, customer_name, phone_number, guest_count, reservation_date, reservation_time, reservation_end_time, notes, table_id, status, reservation_tables(table_id, tables(table_number))";

const RESERVATION_ACTIVE_STATUS = new Set(["booked", "seated"]);

function getDayBoundsForDateString(dateValue: string) {
  const [Y, M, D] = String(dateValue || "").split("-").map((n) => Number(n || 0));
  if (!Y || !M || !D) {
    return getDayBounds(new Date());
  }
  return getDayBounds(new Date(Y, M - 1, D, 12, 0, 0, 0));
}

function getReservationTimeBoundsMs(r: Reservation): { start: number; end: number } | null {
  const startIso = r.reservation_time ?? r.reservation_date;
  if (!startIso) return null;
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return null;
  let end: number;
  if (r.reservation_end_time) {
    const e = new Date(r.reservation_end_time).getTime();
    end = Number.isNaN(e) ? start + 120 * 60 * 1000 : e;
  } else {
    end = start + 120 * 60 * 1000;
  }
  if (end <= start) {
    end = start + 15 * 60 * 1000;
  }
  return { start, end };
}

function getCandidateTimeBoundsFromForm(f: Pick<ReservationFormData, "day" | "time" | "durationMins">): { start: number; end: number } | null {
  if (!f.day?.trim() || !f.time?.trim()) return null;
  try {
    const start = new Date(buildReservationIso(f.day, f.time)).getTime();
    if (Number.isNaN(start)) return null;
    const d = Math.max(15, Number(f.durationMins || 120) || 120);
    return { start, end: start + d * 60 * 1000 };
  } catch {
    return null;
  }
}

/**
 * Returns table IDs that already have a booked/seated reservation overlapping the given time window.
 * `excludeReservationId` skips that reservation (used when editing).
 */
function getBookedTableIdsForTimeWindow(
  list: Reservation[],
  window: { start: number; end: number } | null,
  excludeReservationId: string | null
): Set<string> {
  const out = new Set<string>();
  if (!window || window.end <= window.start) return out;
  for (const r of list) {
    if (excludeReservationId && r.id === excludeReservationId) continue;
    if (!r.status) continue;
    if (!RESERVATION_ACTIVE_STATUS.has(String(r.status))) continue;
    const b = getReservationTimeBoundsMs(r);
    if (!b) continue;
    if (!(b.start < window.end && window.start < b.end)) continue;
    for (const tid of getReservationTableIds(r)) {
      if (tid) out.add(tid);
    }
  }
  return out;
}

function getReservationTableIds(item: Reservation) {
  const relation = (item.reservation_tables ?? [])
    .map((row) => row?.table_id)
    .filter((id): id is string => Boolean(id));
  if (relation.length > 0) return relation;
  return item.table_id ? [item.table_id] : [];
}

function getNearestQuarterTimeValue(base = new Date()) {
  const total = base.getHours() * 60 + base.getMinutes();
  const rounded = Math.round(total / 15) * 15;
  const normalized = ((rounded % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getReservationTableLabel(item: Reservation, tableNumberById: Record<string, number>) {
  const relationNumbers = (item.reservation_tables ?? [])
    .map((row) => row?.tables?.table_number)
    .filter((n): n is number => typeof n === "number");
  if (relationNumbers.length > 0) {
    return relationNumbers.join(", ");
  }
  if (item.table_id && tableNumberById[item.table_id] != null) {
    return String(tableNumberById[item.table_id]);
  }
  return "—";
}

function ReservationsScreen() {
  const navigation = useNavigation();
  const { restaurant } = useRestaurant();
  const { t, locale } = useLanguage();
  const { colors, theme } = useTheme();
  const isLight = theme === "light";
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;
  const filterBorder = colors.containerBorderSubtle ?? colors.ordersContainerBorder;
  const silverBorder = isLight ? "rgba(148, 163, 184, 0.55)" : "rgba(168, 162, 158, 0.35)";
  const noShadow = {
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  };
  const insets = useSafeAreaInsets();
  const [dayOffset, setDayOffset] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    waiting: true,
    arrived: true,
    completed: false,
    canceled: false,
  });
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [tableNumberById, setTableNumberById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showFilterDayPicker, setShowFilterDayPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showGuestsPicker, setShowGuestsPicker] = useState(false);
  const [formData, setFormData] = useState<ReservationFormData>({
    day: toInputDateValue(new Date()),
    name: "",
    phone: "",
    guests: "2",
    time: "19:00",
    durationMins: "120",
    notes: "",
    tableIds: [] as string[],
  });
  const [reservationFormErrors, setReservationFormErrors] = useState<string[]>([]);
  const [reservationsOnFormDay, setReservationsOnFormDay] = useState<Reservation[]>([]);

  const selectedDate = useMemo(() => {
    const next = new Date();
    next.setDate(next.getDate() + dayOffset);
    return next;
  }, [dayOffset]);

  const filterDayLabel = useMemo(() => formatFilterDayMonth(selectedDate, locale), [selectedDate, locale]);

  const onFilterDateValueChange = (_event: unknown, date: Date) => {
    setDayOffset(getDayOffsetForDate(date));
    if (Platform.OS === "android") {
      setShowFilterDayPicker(false);
    }
  };

  const onFormDayValueChange = (_event: unknown, date: Date) => {
    setFormData((p) => ({ ...p, day: toInputDateValue(date) }));
    if (Platform.OS === "android") {
      setShowDayPicker(false);
    }
  };

  const onFormTimeValueChange = (_event: unknown, date: Date) => {
    setFormData((p) => ({ ...p, time: dateToQuarterTimeValue(date) }));
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
  };

  const openForm = () => {
    const nearestNow = getNearestQuarterTimeValue(new Date());
    setEditingReservationId(null);
    setFormData({
      day: toInputDateValue(selectedDate),
      name: "",
      phone: "",
      guests: "2",
      time: nearestNow,
      durationMins: "120",
      notes: "",
      tableIds: [],
    });
    setReservationFormErrors([]);
    setShowForm(true);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRightContainerStyle: {
        paddingRight: 6,
        paddingVertical: 2,
      },
      headerRight: () => (
        <HeaderAddButton onPress={openForm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add" size={20} color="#fff" style={{ marginLeft: 0, marginTop: 0 }} />
        </HeaderAddButton>
      ),
    });
  }, [navigation]);

  const closeForm = () => {
    if (submitting) return;
    setReservationFormErrors([]);
    setShowDayPicker(false);
    setShowTimePicker(false);
    setShowGuestsPicker(false);
    setShowForm(false);
  };

  const openEditForm = (item: Reservation) => {
    const startIso = item.reservation_time ?? item.reservation_date ?? null;
    const startDay = startIso ? new Date(startIso) : new Date();
    const day = toInputDateValue(startDay);
    const time = isoToTimeValue(startIso);
    const duration = getDurationFromIso(startIso, item.reservation_end_time);
    setEditingReservationId(item.id);
    setFormData({
      day,
      name: item.customer_name ?? "",
      phone: item.phone_number ?? "",
      guests: String(item.guest_count ?? 2),
      time,
      durationMins: String(duration),
      notes: item.notes ?? "",
      tableIds: getReservationTableIds(item),
    });
    setReservationFormErrors([]);
    setShowForm(true);
  };

  const loadReservationsOnFormDay = useCallback(
    async (dayValue: string) => {
      if (!restaurant?.id) return;
      try {
        const { start, end } = getDayBoundsForDateString(dayValue);
        const { data, error } = await supabase
          .from("reservations")
          .select(RESERVATION_LIST_SELECT)
          .eq("restaurant_id", restaurant.id)
          .gte("reservation_date", start.toISOString())
          .lt("reservation_date", end.toISOString())
          .order("reservation_date", { ascending: true });
        if (error) throw error;
        setReservationsOnFormDay((data ?? []) as Reservation[]);
      } catch {
        setReservationsOnFormDay([]);
      }
    },
    [restaurant?.id]
  );

  useEffect(() => {
    if (showForm && formData.day) {
      void loadReservationsOnFormDay(formData.day);
    } else {
      setReservationsOnFormDay([]);
    }
  }, [showForm, formData.day, loadReservationsOnFormDay]);

  const formTimeWindow = useMemo(
    () => getCandidateTimeBoundsFromForm(formData),
    [formData.day, formData.time, formData.durationMins]
  );

  const bookedTableIdsForSlot = useMemo(
    () => getBookedTableIdsForTimeWindow(reservationsOnFormDay, formTimeWindow, editingReservationId),
    [reservationsOnFormDay, formTimeWindow, editingReservationId]
  );

  useEffect(() => {
    if (!showForm) return;
    setFormData((p) => {
      const next = p.tableIds.filter((id) => !bookedTableIdsForSlot.has(id));
      if (next.length === p.tableIds.length) return p;
      return { ...p, tableIds: next };
    });
  }, [showForm, bookedTableIdsForSlot]);

  const loadReservations = useCallback(async () => {
    if (!restaurant?.id) return;
    setLoading(true);
    try {
      const { start, end } = getDayBounds(selectedDate);
      let { data, error } = await supabase
        .from("reservations")
        .select(RESERVATION_LIST_SELECT)
        .eq("restaurant_id", restaurant.id)
        .gte("reservation_date", start.toISOString())
        .lt("reservation_date", end.toISOString())
        .order("reservation_date", { ascending: true });
      if (error && /source|schema cache|column/i.test(String(error.message || ""))) {
        ({ data, error } = await supabase
          .from("reservations")
          .select(RESERVATION_LIST_SELECT_FALLBACK)
          .eq("restaurant_id", restaurant.id)
          .gte("reservation_date", start.toISOString())
          .lt("reservation_date", end.toISOString())
          .order("reservation_date", { ascending: true }));
      }
      if (error) throw error;
      setReservations((data ?? []) as Reservation[]);
      const { data: tableRows } = await supabase
        .from("tables")
        .select("id, table_number, table_name")
        .eq("restaurant_id", restaurant.id);
      const map: Record<string, number> = {};
      (tableRows ?? []).forEach((t) => {
        if (t?.id && typeof t.table_number === "number") {
          map[t.id] = t.table_number;
        }
      });
      setTableNumberById(map);
      setTables((tableRows ?? []) as TableOption[]);
    } catch (err) {
      Alert.alert(t("error"), err instanceof Error ? err.message : t("reservationsLoadFail"));
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [restaurant?.id, selectedDate]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    if (!restaurant?.id) return;
    const channel = supabase
      .channel(`reservations-mobile-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          loadReservations();
        }
      )
      .subscribe();
    const interval = setInterval(loadReservations, 15000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id, loadReservations]);

  useEffect(() => {
    setReservationFormErrors([]);
  }, [formData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReservations();
    if (showForm && formData.day) {
      void loadReservationsOnFormDay(formData.day);
    }
    setRefreshing(false);
  }, [loadReservations, showForm, formData.day, loadReservationsOnFormDay]);

  const updateStatus = async (id: string, status: "cancelled" | "seated" | "completed") => {
    if (updatingId) return;
    setUpdatingId(id);
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (error) {
      Alert.alert(t("reservationsUpdateFail"), error.message);
      setUpdatingId(null);
      return;
    }
    await loadReservations();
    if (showForm && formData.day) {
      void loadReservationsOnFormDay(formData.day);
    }
    setUpdatingId(null);
  };

  const removeReservation = (id: string) => {
    Alert.alert(t("reservationsRemoveTitle"), t("reservationsRemoveBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("reservationsRemove"),
        style: "destructive",
        onPress: async () => {
          if (updatingId) return;
          setUpdatingId(id);
          const { error } = await supabase.from("reservations").delete().eq("id", id);
          if (error) {
            Alert.alert(t("reservationsDeleteFail"), error.message);
            setUpdatingId(null);
            return;
          }
          await loadReservations();
          if (showForm && formData.day) {
            void loadReservationsOnFormDay(formData.day);
          }
          setUpdatingId(null);
        },
      },
    ]);
  };

  const submitReservation = async () => {
    if (!restaurant?.id) {
      Alert.alert(t("reservationsMissingRestaurant"), t("reservationsMissingRestaurant"));
      return;
    }
    const missing = getMissingReservationRequiredFields(formData, t);
    if (missing.length) {
      setReservationFormErrors(missing);
      return;
    }
    setReservationFormErrors([]);
    const name = formData.name.trim();
    const phone = formData.phone.trim();
    setSubmitting(true);
    try {
      if (formData.tableIds.length > 0) {
        const w = getCandidateTimeBoundsFromForm(formData);
        if (w) {
          const { start, end } = getDayBoundsForDateString(formData.day);
          const { data: dayRows, error: dayErr } = await supabase
            .from("reservations")
            .select(RESERVATION_LIST_SELECT)
            .eq("restaurant_id", restaurant.id)
            .gte("reservation_date", start.toISOString())
            .lt("reservation_date", end.toISOString());
          if (dayErr) throw dayErr;
          const taken = getBookedTableIdsForTimeWindow((dayRows ?? []) as Reservation[], w, editingReservationId);
          if (formData.tableIds.some((id) => taken.has(id))) {
            Alert.alert(
              t("reservationsTableUnavailable"),
              t("reservationsTableUnavailableBody")
            );
            return;
          }
        }
      }

      const reservationIso = buildReservationIso(formData.day, formData.time);
      const duration = Math.max(15, Number(formData.durationMins || 120));
      const reservationEndIso = buildReservationIso(
        formData.day,
        addMinutesToTimeValue(formData.time, duration)
      );
      const payload = {
        restaurant_id: restaurant.id,
        table_id: formData.tableIds[0] || null,
        customer_name: name,
        // DB column is NOT NULL; use "" when optional phone is left blank.
        phone_number: phone,
        guest_count: Math.min(100, Math.max(1, Number(formData.guests || 1))),
        reservation_date: reservationIso,
        reservation_time: reservationIso,
        reservation_end_time: reservationEndIso,
        notes: formData.notes.trim() || null,
        ...(editingReservationId ? {} : { source: "mobile" }),
      };
      let reservationId: string | null = null;
      if (editingReservationId) {
        const update = await supabase.from("reservations").update(payload).eq("id", editingReservationId);
        if (update.error && String(update.error.message || "").includes("reservation_end_time")) {
          const { reservation_end_time, ...fallbackPayload } = payload;
          const fallback = await supabase
            .from("reservations")
            .update(fallbackPayload)
            .eq("id", editingReservationId);
          if (fallback.error) throw fallback.error;
        } else if (update.error) {
          throw update.error;
        }
        reservationId = editingReservationId;
      } else {
        const insert = await supabase
          .from("reservations")
          .insert({ ...payload, status: "booked" })
          .select("id")
          .single();
        if (insert.error && String(insert.error.message || "").includes("reservation_end_time")) {
          const { reservation_end_time, ...fallbackPayload } = payload;
          const fallback = await supabase
            .from("reservations")
            .insert({ ...fallbackPayload, status: "booked" })
            .select("id")
            .single();
          if (fallback.error) throw fallback.error;
          reservationId = fallback.data?.id ?? null;
        } else if (insert.error && /source|schema cache|column/i.test(String(insert.error.message || ""))) {
          const { source: _source, ...fallbackPayload } = payload;
          const fallback = await supabase
            .from("reservations")
            .insert({ ...fallbackPayload, status: "booked" })
            .select("id")
            .single();
          if (fallback.error) throw fallback.error;
          reservationId = fallback.data?.id ?? null;
        } else if (insert.error) {
          throw insert.error;
        } else {
          reservationId = insert.data?.id ?? null;
        }
      }

      if (reservationId) {
        await supabase.from("reservation_tables").delete().eq("reservation_id", reservationId);
      }
      if (reservationId && formData.tableIds.length > 0) {
        const joinRows = formData.tableIds.map((tableId) => ({
          reservation_id: reservationId,
          table_id: tableId,
        }));
        const { error: joinError } = await supabase.from("reservation_tables").insert(joinRows);
        if (joinError) throw joinError;
      }
      setShowForm(false);
      setEditingReservationId(null);
      setReservationFormErrors([]);
      setFormData({
        day: toInputDateValue(selectedDate),
        name: "",
        phone: "",
        guests: "2",
        time: "19:00",
        durationMins: "120",
        notes: "",
        tableIds: [],
      });
      await loadReservations();
    } catch (err) {
      Alert.alert(t("reservationsSaveFail"), err instanceof Error ? err.message : t("reservationsSaveFail"));
    } finally {
      setSubmitting(false);
    }
  };

  const openDayPicker = () => setShowDayPicker(true);
  const openTimePicker = () => setShowTimePicker(true);
  const openGuestsPicker = () => setShowGuestsPicker(true);

  const reservationSections = useMemo(() => {
    const sortByTime = (a: Reservation, b: Reservation) => {
      const ta = new Date(a.reservation_time ?? a.reservation_date ?? 0).getTime();
      const tb = new Date(b.reservation_time ?? b.reservation_date ?? 0).getTime();
      return ta - tb;
    };

    const sections = [
      { id: "waiting", title: t("reservationsWaiting"), match: (s: string) => s === "booked" },
      { id: "arrived", title: t("reservationsArrived"), match: (s: string) => s === "seated" },
      { id: "completed", title: t("reservationsCompleted"), match: (s: string) => s === "completed" },
      { id: "canceled", title: t("reservationsCanceled"), match: (s: string) => s === "cancelled" },
    ] as const;

    return sections
      .map((section) => {
        const items = reservations
          .filter((item) => {
            const s = item.status ?? "booked";
            return section.match(s);
          })
          .sort(sortByTime);
        return { id: section.id, title: section.title, items };
      })
      .filter((section) => section.items.length > 0);
  }, [reservations, t]);

  const visibleCount = useMemo(
    () => reservationSections.reduce((sum, section) => sum + section.items.length, 0),
    [reservationSections]
  );

  return (
    <Container style={{ backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? <EmptyText style={{ color: colors.textMuted }}>{t("reservationsLoading")}</EmptyText> : null}
        {!loading && visibleCount === 0 ? (
          <EmptyText style={{ color: colors.textMuted }}>{t("reservationsEmptyDay")}</EmptyText>
        ) : null}

        <List>
          {reservationSections.map((section) => {
            const isOpen = expandedSections[section.id] ?? true;
            return (
            <SectionBlock
              key={section.id}
              style={{
                backgroundColor: colors.surface,
                borderColor: silverBorder,
                ...noShadow,
              }}
            >
              <SectionHeader
                onPress={() =>
                  setExpandedSections((prev) => ({
                    ...prev,
                    [section.id]: !isOpen,
                  }))
                }
                activeOpacity={0.75}
                style={{
                  borderBottomWidth: isOpen ? 1 : 0,
                  borderBottomColor: isLight ? "rgba(28, 25, 23, 0.06)" : "rgba(255,255,255,0.08)",
                }}
              >
                <SectionHeaderLeft>
                  <SectionTitle style={{ color: colors.text, fontSize: isTablet ? 18 : 15 }}>
                    {section.title}
                  </SectionTitle>
                  <SectionCount
                    style={{
                      color: colors.textMuted,
                      backgroundColor: isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)",
                      borderColor: silverBorder,
                      fontSize: isTablet ? 13 : 12,
                    }}
                  >
                    {section.items.length}
                  </SectionCount>
                </SectionHeaderLeft>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textMuted}
                />
              </SectionHeader>
              {isOpen ? (
              <SectionCards>
                {section.items.map((item, index) => {
                  const prev = index > 0 ? section.items[index - 1] : null;
                  const groupKey = getTimeGroupKey(item);
                  const prevGroupKey = prev ? getTimeGroupKey(prev) : null;
                  const showGroupDivider = index > 0 && groupKey !== prevGroupKey;
                  const status = item.status ?? "booked";
                  return (
              <GroupWrap key={item.id}>
                {showGroupDivider ? <GroupDivider style={{ backgroundColor: colors.ordersContainerBorder }} /> : null}
                <TimelineRow>
                  {(() => {
                    const isActiveReservation = status === "booked" || status === "seated";
                    const guestName = item.customer_name || t("reservationsGuest");
                    const phone = item.phone_number?.trim() || "";
                    const canCall = Boolean(phone);
                    const nameColor =
                      status === "booked" ? colors.text : colors.textMuted;
                    const nameWeight = status === "booked" ? "800" : "600";
                    return (
                      <ReservationCard
                        style={{
                          backgroundColor: colors.surface,
                          borderColor: silverBorder,
                          ...noShadow,
                        }}
                      >
                        <CallButton
                          disabled={!canCall}
                          activeOpacity={0.85}
                          onPress={() => {
                            if (!canCall) return;
                            const dial = phone.replace(/[^\d+]/g, "");
                            Linking.openURL(`tel:${dial}`);
                          }}
                          style={{
                            backgroundColor: canCall
                              ? isLight
                                ? "#fff"
                                : colors.surface2
                              : isLight
                                ? "rgba(28, 25, 23, 0.03)"
                                : "rgba(255,255,255,0.04)",
                            borderColor: canCall
                              ? isLight
                                ? "rgba(2, 132, 199, 0.22)"
                                : "rgba(56, 189, 248, 0.35)"
                              : filterBorder,
                            opacity: canCall ? 1 : 0.4,
                            ...noShadow,
                          }}
                          accessibilityLabel={canCall ? `Call ${phone}` : t("reservationsNoPhone")}
                        >
                          <CallIconWrap
                            style={{
                              backgroundColor: canCall
                                ? isLight
                                  ? "rgba(2, 132, 199, 0.1)"
                                  : "rgba(2, 132, 199, 0.18)"
                                : "transparent",
                            }}
                          >
                            <Ionicons
                              name="call"
                              size={17}
                              color={canCall ? (isLight ? "#0284c7" : "#38bdf8") : colors.textMuted}
                            />
                          </CallIconWrap>
                        </CallButton>
                        <CardMain>
                          <InfoCol>
                            <CardHeader>
                              <Pressable
                                onPress={() => {
                                  if (!isActiveReservation) return;
                                  openEditForm(item);
                                }}
                                style={({ pressed }) => ({
                                  flex: 1,
                                  minWidth: 0,
                                  paddingRight: isTablet ? 52 : 44,
                                  opacity: pressed && isActiveReservation ? 0.92 : 1,
                                })}
                              >
                                <GuestBlock>
                                  {isTablet ? (
                                    <>
                                      <GuestIdentity>
                                        <NamePhoneRow>
                                          <Name
                                            style={{
                                              color: nameColor,
                                              fontWeight: nameWeight,
                                              fontSize: 21,
                                              lineHeight: 26,
                                              flexShrink: 1,
                                            }}
                                            numberOfLines={1}
                                          >
                                            {guestName}
                                          </Name>
                                          <NamePhoneSep
                                            style={{
                                              color: isLight
                                                ? "rgba(28,25,23,0.22)"
                                                : "rgba(255,255,255,0.22)",
                                            }}
                                          >
                                            ·
                                          </NamePhoneSep>
                                          <PhoneText
                                            style={{
                                              color: colors.textMuted,
                                              fontSize: 15,
                                              lineHeight: 20,
                                              flexShrink: 1,
                                            }}
                                            numberOfLines={1}
                                          >
                                            {phone || t("reservationsNoPhone")}
                                          </PhoneText>
                                        </NamePhoneRow>

                                        <TabletMetaRail>
                                          <TabletMetaChip
                                            style={{
                                              backgroundColor: isLight
                                                ? "rgba(148, 163, 184, 0.1)"
                                                : "rgba(168, 162, 158, 0.12)",
                                              borderColor: silverBorder,
                                            }}
                                          >
                                            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                                            <MetaText
                                              style={{
                                                color: colors.text,
                                                fontSize: 15,
                                                lineHeight: 18,
                                                fontWeight: "700",
                                              }}
                                              numberOfLines={1}
                                            >
                                              {formatTimeRange(item)}
                                            </MetaText>
                                          </TabletMetaChip>
                                          <TabletMetaChip
                                            style={{
                                              backgroundColor: isLight
                                                ? "rgba(148, 163, 184, 0.1)"
                                                : "rgba(168, 162, 158, 0.12)",
                                              borderColor: silverBorder,
                                            }}
                                          >
                                            <Ionicons name="people-outline" size={16} color={colors.textMuted} />
                                            <MetaText
                                              style={{
                                                color: colors.text,
                                                fontSize: 15,
                                                lineHeight: 18,
                                                fontWeight: "700",
                                              }}
                                              numberOfLines={1}
                                            >
                                              {item.guest_count ?? 1}{" "}
                                              {(item.guest_count ?? 1) === 1 ? t("reservationsGuestSingular") : t("reservationsGuestPlural")}
                                            </MetaText>
                                          </TabletMetaChip>
                                          <TabletMetaChip
                                            style={{
                                              backgroundColor: isLight
                                                ? "rgba(148, 163, 184, 0.1)"
                                                : "rgba(168, 162, 158, 0.12)",
                                              borderColor: silverBorder,
                                            }}
                                          >
                                            <MaterialCommunityIcons
                                              name="table-furniture"
                                              size={17}
                                              color={colors.textMuted}
                                            />
                                            <MetaText
                                              style={{
                                                color: colors.text,
                                                fontSize: 15,
                                                lineHeight: 18,
                                                fontWeight: "700",
                                              }}
                                              numberOfLines={1}
                                            >
                                              {(() => {
                                                const tables = getReservationTableLabel(
                                                  item,
                                                  tableNumberById
                                                );
                                                if (!tables || tables === "—") return "—";
                                                return tables;
                                              })()}
                                            </MetaText>
                                          </TabletMetaChip>
                                          {item.source === "website" ? (
                                            <TabletMetaChip
                                              style={{
                                                backgroundColor: isLight
                                                  ? "rgba(249, 115, 22, 0.12)"
                                                  : "rgba(249, 115, 22, 0.18)",
                                                borderColor: isLight
                                                  ? "rgba(249, 115, 22, 0.28)"
                                                  : "rgba(249, 115, 22, 0.35)",
                                              }}
                                            >
                                              <Ionicons name="globe-outline" size={16} color={colors.primary} />
                                              <MetaText
                                                style={{
                                                  color: colors.primary,
                                                  fontSize: 15,
                                                  lineHeight: 18,
                                                  fontWeight: "700",
                                                }}
                                                numberOfLines={1}
                                              >
                                                {t("reservationsFromWebsite")}
                                              </MetaText>
                                            </TabletMetaChip>
                                          ) : null}
                                        </TabletMetaRail>
                                      </GuestIdentity>

                                      {item.notes?.trim() ? (
                                        <NotesLine
                                          style={{
                                            borderTopColor: isLight
                                              ? "rgba(28, 25, 23, 0.08)"
                                              : "rgba(255,255,255,0.1)",
                                            marginRight: -42,
                                          }}
                                        >
                                          <Ionicons
                                            name="document-text-outline"
                                            size={17}
                                            color={colors.textMuted}
                                          />
                                          <NotesText
                                            style={{
                                              color: colors.textMuted,
                                              fontSize: 15,
                                              lineHeight: 20,
                                            }}
                                            numberOfLines={3}
                                          >
                                            {item.notes.trim()}
                                          </NotesText>
                                        </NotesLine>
                                      ) : null}
                                    </>
                                  ) : (
                                    <>
                                      <Name
                                        style={{
                                          color: nameColor,
                                          fontWeight: nameWeight,
                                          fontSize: 17,
                                          lineHeight: 22,
                                        }}
                                        numberOfLines={1}
                                      >
                                        {guestName}
                                      </Name>
                                      <PhoneText
                                        style={{
                                          color: colors.textMuted,
                                          fontSize: 13,
                                          lineHeight: 18,
                                        }}
                                        numberOfLines={1}
                                      >
                                        {phone || t("reservationsNoPhone")}
                                      </PhoneText>
                                      <MetaLine>
                                        <MetaItem>
                                          <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                                          <MetaText style={{ color: colors.textMuted }}>
                                            {formatTimeRange(item)}
                                          </MetaText>
                                        </MetaItem>
                                        <MetaSep
                                          style={{
                                            color: isLight
                                              ? "rgba(28,25,23,0.22)"
                                              : "rgba(255,255,255,0.22)",
                                          }}
                                        >
                                          |
                                        </MetaSep>
                                        <MetaItem>
                                          <Ionicons name="people-outline" size={15} color={colors.textMuted} />
                                          <MetaText style={{ color: colors.textMuted }}>
                                            {item.guest_count ?? 1}{" "}
                                            {(item.guest_count ?? 1) === 1 ? t("reservationsGuestSingular") : t("reservationsGuestPlural")}
                                          </MetaText>
                                        </MetaItem>
                                        <MetaSep
                                          style={{
                                            color: isLight
                                              ? "rgba(28,25,23,0.22)"
                                              : "rgba(255,255,255,0.22)",
                                          }}
                                        >
                                          |
                                        </MetaSep>
                                        <MetaItem>
                                          <MaterialCommunityIcons
                                            name="table-furniture"
                                            size={16}
                                            color={colors.textMuted}
                                          />
                                          <MetaText style={{ color: colors.textMuted }} numberOfLines={1}>
                                            {(() => {
                                              const tables = getReservationTableLabel(
                                                item,
                                                tableNumberById
                                              );
                                              if (!tables || tables === "—") return "—";
                                              return tables;
                                            })()}
                                          </MetaText>
                                        </MetaItem>
                                        {item.source === "website" ? (
                                          <>
                                            <MetaSep
                                              style={{
                                                color: isLight
                                                  ? "rgba(28,25,23,0.22)"
                                                  : "rgba(255,255,255,0.22)",
                                              }}
                                            >
                                              |
                                            </MetaSep>
                                            <MetaItem>
                                              <Ionicons name="globe-outline" size={15} color={colors.primary} />
                                              <MetaText style={{ color: colors.primary }}>
                                                {t("reservationsFromWebsite")}
                                              </MetaText>
                                            </MetaItem>
                                          </>
                                        ) : null}
                                      </MetaLine>
                                      {item.notes?.trim() ? (
                                        <NotesLine
                                          style={{
                                            borderTopColor: isLight
                                              ? "rgba(28, 25, 23, 0.08)"
                                              : "rgba(255,255,255,0.1)",
                                            marginRight: -42,
                                          }}
                                        >
                                          <Ionicons
                                            name="document-text-outline"
                                            size={15}
                                            color={colors.textMuted}
                                          />
                                          <NotesText
                                            style={{ color: colors.textMuted }}
                                            numberOfLines={3}
                                          >
                                            {item.notes.trim()}
                                          </NotesText>
                                        </NotesLine>
                                      ) : null}
                                    </>
                                  )}
                                </GuestBlock>
                              </Pressable>
                            </CardHeader>
                          </InfoCol>

                          {status === "booked" ? (
                            <ActionsRail style={{ borderTopColor: silverBorder }}>
                              <SlideSlot>
                                <SlideToAction
                                  label={t("reservationsSlideCancel")}
                                  icon="close"
                                  accent={isLight ? "rgba(220, 38, 38, 0.72)" : "rgba(248, 113, 113, 0.85)"}
                                  labelColor={colors.textMuted}
                                  trackBg={isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.04)"}
                                  trackBorder={silverBorder}
                                  thumbBg={isLight ? "rgba(220, 38, 38, 0.05)" : "rgba(220, 38, 38, 0.1)"}
                                  disabled={updatingId === item.id}
                                  large={isTablet}
                                  onConfirm={() => updateStatus(item.id, "cancelled")}
                                />
                              </SlideSlot>
                              <SlideSlot>
                                <SlideToAction
                                  label={t("reservationsSlideSeat")}
                                  icon="restaurant"
                                  accent={isLight ? "rgba(22, 163, 74, 0.72)" : "rgba(74, 222, 128, 0.85)"}
                                  labelColor={colors.textMuted}
                                  trackBg={isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.04)"}
                                  trackBorder={silverBorder}
                                  thumbBg={isLight ? "rgba(22, 163, 74, 0.05)" : "rgba(22, 163, 74, 0.1)"}
                                  disabled={updatingId === item.id}
                                  large={isTablet}
                                  onConfirm={() => updateStatus(item.id, "seated")}
                                />
                              </SlideSlot>
                            </ActionsRail>
                          ) : status === "seated" ? (
                            <ActionsRail style={{ borderTopColor: silverBorder }}>
                              <SlideSlot $full>
                                <SlideToAction
                                  label={t("reservationsSlideComplete")}
                                  icon="log-out-outline"
                                  accent={isLight ? "rgba(255, 102, 0, 0.72)" : "rgba(251, 146, 60, 0.85)"}
                                  labelColor={colors.textMuted}
                                  trackBg={isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.04)"}
                                  trackBorder={silverBorder}
                                  thumbBg={isLight ? "rgba(255, 102, 0, 0.05)" : "rgba(255, 102, 0, 0.1)"}
                                  disabled={updatingId === item.id}
                                  large={isTablet}
                                  onConfirm={() => updateStatus(item.id, "completed")}
                                />
                              </SlideSlot>
                            </ActionsRail>
                          ) : (
                            <ActionsRail style={{ borderTopColor: silverBorder }}>
                              <SlideSlot $full>
                                <SlideToAction
                                  label={t("reservationsSlideDelete")}
                                  icon="trash"
                                  accent={isLight ? "rgba(220, 38, 38, 0.72)" : "rgba(248, 113, 113, 0.85)"}
                                  labelColor={colors.textMuted}
                                  trackBg={isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.04)"}
                                  trackBorder={silverBorder}
                                  thumbBg={isLight ? "rgba(220, 38, 38, 0.05)" : "rgba(220, 38, 38, 0.1)"}
                                  disabled={updatingId === item.id}
                                  large={isTablet}
                                  onConfirm={() => removeReservation(item.id)}
                                />
                              </SlideSlot>
                            </ActionsRail>
                          )}
                        </CardMain>
                      </ReservationCard>
                    );
                  })()}
                </TimelineRow>
              </GroupWrap>
                  );
                })}
              </SectionCards>
              ) : null}
            </SectionBlock>
            );
          })}
        </List>
      </ScrollView>
      <BottomActionBar
        pointerEvents="box-none"
        style={{ paddingBottom: Math.max(insets.bottom, 10), paddingTop: 6 }}
      >
        <FilterDock
          pointerEvents="auto"
          style={{
            backgroundColor: colors.surface,
            borderColor: silverBorder,
            ...noShadow,
          }}
        >
          <FilterDockInset
            style={{
              backgroundColor: isLight ? "rgba(255, 102, 0, 0.04)" : "rgba(255,255,255,0.04)",
              borderColor: isLight ? "rgba(255, 102, 0, 0.1)" : "rgba(255,255,255,0.08)",
            }}
          >
            <HeaderActionRow>
          <DateFilterPill
            style={{
              backgroundColor: isLight ? colors.surface : colors.surface2,
              borderColor: filterBorder,
            }}
          >
            <DayStepButton
              onPress={() => setDayOffset((p) => p - 1)}
              activeOpacity={0.88}
              accessibilityLabel={t("reservationsPrevDay")}
              style={{
                backgroundColor: isLight ? "rgba(28, 25, 23, 0.05)" : colors.surface2,
                borderColor: filterBorder,
                ...noShadow,
              }}
            >
              <Ionicons name="chevron-back" size={16} color={colors.text} />
            </DayStepButton>
            <DateFilterCenter
              onPress={() => setShowFilterDayPicker(true)}
              activeOpacity={0.88}
              accessibilityLabel={`Selected date ${filterDayLabel}. Choose date`}
            >
              <FilterText style={{ color: colors.text }} numberOfLines={1}>
                {filterDayLabel}
              </FilterText>
            </DateFilterCenter>
            <DayStepButton
              onPress={() => setDayOffset((p) => p + 1)}
              activeOpacity={0.88}
              accessibilityLabel={t("reservationsNextDay")}
              style={{
                backgroundColor: isLight ? "rgba(28, 25, 23, 0.05)" : colors.surface2,
                borderColor: filterBorder,
                ...noShadow,
              }}
            >
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </DayStepButton>
          </DateFilterPill>
            </HeaderActionRow>
          </FilterDockInset>
        </FilterDock>
      </BottomActionBar>

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
        <ModalOverlay>
          <SheetKeyboardAvoid
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
          >
            <ModalCard
              style={{
                backgroundColor: colors.surface,
                borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
              }}
            >
              <ModalHandle
                style={{
                  backgroundColor: isLight ? "rgba(28, 25, 23, 0.18)" : "rgba(255,255,255,0.25)",
                }}
              />
              <ModalHeader>
                <ModalTitle style={{ color: colors.text }}>
                  {editingReservationId ? t("reservationsEdit") : t("reservationsAdd")}
                </ModalTitle>
                <CloseModalBtn
                  onPress={closeForm}
                  disabled={submitting}
                  style={{
                    backgroundColor: isLight ? "rgba(28, 25, 23, 0.04)" : "rgba(255,255,255,0.06)",
                    borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                  }}
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </CloseModalBtn>
              </ModalHeader>
              <ModalFormScroll
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 12 }}
                showsVerticalScrollIndicator={false}
              >
                {reservationFormErrors.length > 0 ? (
                  <ValidationCallout
                    style={{
                      borderColor:
                        theme === "dark" ? "rgba(234, 179, 8, 0.4)" : "rgba(202, 138, 4, 0.45)",
                      backgroundColor: theme === "dark" ? "rgba(234, 179, 8, 0.12)" : "rgba(250, 204, 21, 0.14)",
                    }}
                  >
                    <Ionicons name="alert-circle" size={22} color={colors.warning} style={{ marginTop: 0 }} />
                    <ValidationCalloutTextCol>
                      <ValidationCalloutTitle style={{ color: colors.text }}>
                        {t("reservationsCantSave")}
                      </ValidationCalloutTitle>
                      <ValidationCalloutSub style={{ color: colors.textMuted }}>
                        {t("reservationsMissingFields")}
                      </ValidationCalloutSub>
                      {reservationFormErrors.map((line) => (
                        <ValidationBulletRow key={line}>
                          <Text style={{ color: colors.warning, fontSize: 15, fontWeight: "900", lineHeight: 20 }}>
                            •
                          </Text>
                          <ValidationBulletText style={{ color: colors.text }}>{line}</ValidationBulletText>
                        </ValidationBulletRow>
                      ))}
                    </ValidationCalloutTextCol>
                  </ValidationCallout>
                ) : null}

                <FormGrid>
                  <FormSection>
                    <FieldBlock>
                      <FieldLabel style={{ color: colors.textMuted }}>{t("reservationsFieldName")}</FieldLabel>
                      <FieldInput
                        value={formData.name}
                        onChangeText={(v) => setFormData((p) => ({ ...p, name: v }))}
                        placeholder={t("reservationsPlaceholderName")}
                        placeholderTextColor={colors.textMuted}
                        style={{
                          color: colors.text,
                          borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                          backgroundColor: isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)",
                        }}
                      />
                    </FieldBlock>
                    <FieldBlock>
                      <FieldLabel style={{ color: colors.textMuted }}>{t("reservationsFieldPhone")}</FieldLabel>
                      <FieldInput
                        value={formData.phone}
                        onChangeText={(v) => setFormData((p) => ({ ...p, phone: v }))}
                        placeholder={t("reservationsPlaceholderPhone")}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="phone-pad"
                        style={{
                          color: colors.text,
                          borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                          backgroundColor: isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)",
                        }}
                      />
                    </FieldBlock>
                  </FormSection>

                  <FormSection>
                    <Row>
                      <Half>
                        <FieldLabel style={{ color: colors.textMuted }}>{t("reservationsFieldGuests")}</FieldLabel>
                        <InlineControl
                          style={{
                            borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                            backgroundColor: isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)",
                          }}
                        >
                          <InlineBtn
                            onPress={() =>
                              setFormData((p) => ({
                                ...p,
                                guests: String(Math.max(1, Number(p.guests || 2) - 1)),
                              }))
                            }
                            style={{
                              backgroundColor: isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)",
                              borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                            }}
                          >
                            <Ionicons name="remove" size={16} color={colors.text} />
                          </InlineBtn>
                          <InlineCenter>
                            <InlineTapTarget onPress={openGuestsPicker}>
                              <InlineValue style={{ color: colors.text }}>
                                {Math.max(1, Number(formData.guests || 2))}
                              </InlineValue>
                            </InlineTapTarget>
                          </InlineCenter>
                          <InlineBtn
                            onPress={() =>
                              setFormData((p) => ({
                                ...p,
                                guests: String(Math.min(100, Number(p.guests || 2) + 1)),
                              }))
                            }
                            style={{
                              backgroundColor: isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)",
                              borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                            }}
                          >
                            <Ionicons name="add" size={16} color={colors.text} />
                          </InlineBtn>
                        </InlineControl>
                      </Half>
                      <Half>
                        <FieldLabel style={{ color: colors.textMuted }}>{t("reservationsFieldDay")}</FieldLabel>
                        <InlineControl
                          style={{
                            borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                            backgroundColor: isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)",
                          }}
                        >
                          <InlineBtn
                            onPress={() =>
                              setFormData((p) => ({
                                ...p,
                                day: addDaysToDateValue(p.day || toInputDateValue(new Date()), -1),
                              }))
                            }
                            style={{
                              backgroundColor: isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)",
                              borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                            }}
                          >
                            <Ionicons name="chevron-back" size={16} color={colors.text} />
                          </InlineBtn>
                          <InlineCenter>
                            <InlineTapTarget onPress={openDayPicker}>
                              <InlineValue style={{ color: colors.text }} numberOfLines={1}>
                                {toDisplayFormDay(formData.day, locale)}
                              </InlineValue>
                            </InlineTapTarget>
                          </InlineCenter>
                          <InlineBtn
                            onPress={() =>
                              setFormData((p) => ({
                                ...p,
                                day: addDaysToDateValue(p.day || toInputDateValue(new Date()), 1),
                              }))
                            }
                            style={{
                              backgroundColor: isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)",
                              borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                            }}
                          >
                            <Ionicons name="chevron-forward" size={16} color={colors.text} />
                          </InlineBtn>
                        </InlineControl>
                      </Half>
                    </Row>

                    <Row>
                      <Half>
                        <FieldLabel style={{ color: colors.textMuted }}>{t("reservationsFieldTime")}</FieldLabel>
                        <InlineControl
                          style={{
                            borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                            backgroundColor: isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)",
                          }}
                        >
                          <InlineBtn
                            onPress={() =>
                              setFormData((p) => ({
                                ...p,
                                time: addMinutesToTimeValue(p.time || "19:00", -15),
                              }))
                            }
                            style={{
                              backgroundColor: isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)",
                              borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                            }}
                          >
                            <Ionicons name="remove" size={16} color={colors.text} />
                          </InlineBtn>
                          <InlineCenter>
                            <InlineTapTarget onPress={openTimePicker}>
                              <InlineValue style={{ color: colors.text }}>{formData.time}</InlineValue>
                            </InlineTapTarget>
                          </InlineCenter>
                          <InlineBtn
                            onPress={() =>
                              setFormData((p) => ({
                                ...p,
                                time: addMinutesToTimeValue(p.time || "19:00", 15),
                              }))
                            }
                            style={{
                              backgroundColor: isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)",
                              borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                            }}
                          >
                            <Ionicons name="add" size={16} color={colors.text} />
                          </InlineBtn>
                        </InlineControl>
                      </Half>
                      <Half>
                        <FieldLabel style={{ color: colors.textMuted }}>{t("reservationsFieldDuration")}</FieldLabel>
                        <InlineControl
                          style={{
                            borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                            backgroundColor: isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)",
                          }}
                        >
                          <InlineBtn
                            onPress={() =>
                              setFormData((p) => ({
                                ...p,
                                durationMins: String(Math.max(15, Number(p.durationMins || 120) - 15)),
                              }))
                            }
                            style={{
                              backgroundColor: isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)",
                              borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                            }}
                          >
                            <Ionicons name="remove" size={16} color={colors.text} />
                          </InlineBtn>
                          <InlineCenter>
                            <InlineValue style={{ color: colors.text }}>
                              {formatDurationLabel(Number(formData.durationMins || 120))}
                            </InlineValue>
                          </InlineCenter>
                          <InlineBtn
                            onPress={() =>
                              setFormData((p) => ({
                                ...p,
                                durationMins: String(Math.min(6 * 60, Number(p.durationMins || 120) + 15)),
                              }))
                            }
                            style={{
                              backgroundColor: isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)",
                              borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                            }}
                          >
                            <Ionicons name="add" size={16} color={colors.text} />
                          </InlineBtn>
                        </InlineControl>
                      </Half>
                    </Row>
                  </FormSection>

                  <FormSection>
                    <FieldBlock>
                      <FieldLabel style={{ color: colors.textMuted }}>{t("reservationsFieldNotes")}</FieldLabel>
                      <NotesInput
                        value={formData.notes}
                        onChangeText={(v) => setFormData((p) => ({ ...p, notes: v }))}
                        placeholder={t("reservationsPlaceholderNotes")}
                        placeholderTextColor={colors.textMuted}
                        multiline
                        textAlignVertical="top"
                        style={{
                          color: colors.text,
                          borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                          backgroundColor: isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)",
                        }}
                      />
                    </FieldBlock>
                  </FormSection>

                  <FormSection>
                    <FieldBlock>
                      <FieldLabel style={{ color: colors.textMuted }}>{t("reservationsFieldTables")}</FieldLabel>
                      <TableSelectorWrap>
                        <TableOptionChip
                          style={{
                            borderColor:
                              formData.tableIds.length === 0
                                ? colors.primary
                                : isLight
                                  ? "#c0c0c0"
                                  : "rgba(192, 192, 192, 0.35)",
                            backgroundColor:
                              formData.tableIds.length === 0
                                ? colors.primaryMuted
                                : isLight
                                  ? "rgba(28, 25, 23, 0.03)"
                                  : "rgba(255,255,255,0.05)",
                          }}
                          onPress={() => setFormData((p) => ({ ...p, tableIds: [] }))}
                        >
                          <TableOptionText style={{ color: colors.text }}>{t("reservationsNoTable")}</TableOptionText>
                        </TableOptionChip>
                        {tables.map((table) => {
                          const isActive = formData.tableIds.includes(table.id);
                          const isUnavailable = bookedTableIdsForSlot.has(table.id);
                          const label =
                            table.table_number != null
                              ? String(table.table_number)
                              : table.table_name || "—";
                          return (
                            <TableOptionChip
                              key={table.id}
                              disabled={isUnavailable}
                              style={{
                                borderColor: isUnavailable
                                  ? isLight
                                    ? "#d4d4d4"
                                    : "rgba(192, 192, 192, 0.25)"
                                  : isActive
                                    ? colors.primary
                                    : isLight
                                      ? "#c0c0c0"
                                      : "rgba(192, 192, 192, 0.35)",
                                backgroundColor: isUnavailable
                                  ? isLight
                                    ? "rgba(28, 25, 23, 0.04)"
                                    : "rgba(255,255,255,0.04)"
                                  : isActive
                                    ? colors.primaryMuted
                                    : isLight
                                      ? "rgba(28, 25, 23, 0.03)"
                                      : "rgba(255,255,255,0.05)",
                                opacity: isUnavailable ? 0.55 : 1,
                              }}
                              onPress={() => {
                                if (isUnavailable) {
                                  Alert.alert(
                                    t("reservationsNotAvailable"),
                                    t("reservationsNotAvailableBody")
                                  );
                                  return;
                                }
                                setFormData((p) => ({
                                  ...p,
                                  tableIds: isActive
                                    ? p.tableIds.filter((id) => id !== table.id)
                                    : [...p.tableIds, table.id],
                                }));
                              }}
                            >
                              <TableChipInner>
                                {isUnavailable ? (
                                  <Ionicons
                                    name="lock-closed"
                                    size={12}
                                    color={colors.textMuted}
                                    style={{ marginRight: 4 }}
                                  />
                                ) : (
                                  <MaterialCommunityIcons
                                    name="table-furniture"
                                    size={14}
                                    color={isActive ? colors.primary : colors.textMuted}
                                    style={{ marginRight: 4 }}
                                  />
                                )}
                                <TableOptionText
                                  style={{
                                    color: isUnavailable ? colors.textMuted : colors.text,
                                    flexShrink: 1,
                                  }}
                                  numberOfLines={1}
                                >
                                  {label}
                                </TableOptionText>
                              </TableChipInner>
                            </TableOptionChip>
                          );
                        })}
                      </TableSelectorWrap>
                    </FieldBlock>
                  </FormSection>
                </FormGrid>
              </ModalFormScroll>
              <FormActions
                style={{
                  borderTopColor: isLight ? "rgba(28, 25, 23, 0.08)" : "rgba(255,255,255,0.08)",
                }}
              >
                <GhostBtn
                  onPress={closeForm}
                  disabled={submitting}
                  style={{
                    borderColor: silverBorder,
                    backgroundColor: isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)",
                  }}
                >
                  <GhostBtnText style={{ color: colors.text, fontSize: isTablet ? 16 : 15 }}>{t("cancel")}</GhostBtnText>
                </GhostBtn>
                <PrimaryBtn
                  onPress={submitReservation}
                  disabled={submitting}
                  style={{ backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }}
                >
                  <PrimaryBtnText>{submitting ? t("saving") : t("save")}</PrimaryBtnText>
                </PrimaryBtn>
              </FormActions>
            </ModalCard>
          </SheetKeyboardAvoid>
          {showGuestsPicker ? (
            <View style={[StyleSheet.absoluteFillObject, { zIndex: 22 }]}>
              <PickerSheetOverlay>
                <Pressable style={{ flex: 1 }} onPress={() => setShowGuestsPicker(false)} />
                <PickerSheet
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                  }}
                >
                  <PickerSheetHeader>
                    <PickerSheetTitle style={{ color: colors.text }}>{t("reservationsPickerGuests")}</PickerSheetTitle>
                    <PickerSheetClose
                      onPress={() => setShowGuestsPicker(false)}
                      style={{
                        backgroundColor: isLight ? "rgba(28, 25, 23, 0.04)" : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </PickerSheetClose>
                  </PickerSheetHeader>
                  <PickerSheetScroll>
                    {Array.from({ length: 100 }, (_, i) => i + 1).map((count) => {
                      const active = Math.max(1, Number(formData.guests || 2)) === count;
                      return (
                        <PickerRowBtn
                          key={count}
                          onPress={() => {
                            setFormData((p) => ({ ...p, guests: String(count) }));
                            setShowGuestsPicker(false);
                          }}
                        >
                          <PickerRowText $active={active} style={{ color: colors.text }}>
                            {count} {count === 1 ? t("reservationsGuestSingular") : t("reservationsGuestPlural")}
                          </PickerRowText>
                        </PickerRowBtn>
                      );
                    })}
                  </PickerSheetScroll>
                </PickerSheet>
              </PickerSheetOverlay>
            </View>
          ) : null}
          {showDayPicker && Platform.OS === "ios" ? (
            <View style={[StyleSheet.absoluteFillObject, { zIndex: 20 }]}>
              <PickerSheetOverlay>
                <Pressable style={{ flex: 1 }} onPress={() => setShowDayPicker(false)} />
                <PickerSheet
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                  }}
                >
                  <PickerSheetHeader>
                    <PickerSheetTitle style={{ color: colors.text }}>{t("reservationsPickerDate")}</PickerSheetTitle>
                    <PickerSheetClose
                      onPress={() => setShowDayPicker(false)}
                      style={{
                        backgroundColor: isLight ? "rgba(28, 25, 23, 0.04)" : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </PickerSheetClose>
                  </PickerSheetHeader>
                  <View style={{ width: "100%", alignItems: "center", justifyContent: "center" }}>
                    <DateTimePicker
                      value={dateValueToDate(formData.day)}
                      mode="date"
                      display="inline"
                      themeVariant={theme === "dark" ? "dark" : "light"}
                      onValueChange={onFormDayValueChange}
                      style={{ alignSelf: "center", height: 340 }}
                    />
                  </View>
                  <FilterDateDoneBtn
                    onPress={() => setShowDayPicker(false)}
                    style={{ backgroundColor: colors.primary }}
                  >
                    <FilterDateDoneText>Done</FilterDateDoneText>
                  </FilterDateDoneBtn>
                </PickerSheet>
              </PickerSheetOverlay>
            </View>
          ) : null}
          {showTimePicker && Platform.OS === "ios" ? (
            <View style={[StyleSheet.absoluteFillObject, { zIndex: 21 }]}>
              <PickerSheetOverlay>
                <Pressable style={{ flex: 1 }} onPress={() => setShowTimePicker(false)} />
                <PickerSheet
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: isLight ? "#c0c0c0" : "rgba(192, 192, 192, 0.35)",
                  }}
                >
                  <PickerSheetHeader>
                    <PickerSheetTitle style={{ color: colors.text }}>{t("reservationsPickerTime")}</PickerSheetTitle>
                    <PickerSheetClose
                      onPress={() => setShowTimePicker(false)}
                      style={{
                        backgroundColor: isLight ? "rgba(28, 25, 23, 0.04)" : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </PickerSheetClose>
                  </PickerSheetHeader>
                  <View style={{ width: "100%", alignItems: "center", justifyContent: "center" }}>
                    <DateTimePicker
                      value={timeValueToDate(formData.time, formData.day)}
                      mode="time"
                      display="spinner"
                      minuteInterval={15}
                      themeVariant={theme === "dark" ? "dark" : "light"}
                      onValueChange={onFormTimeValueChange}
                      style={{ width: 260, alignSelf: "center" }}
                    />
                  </View>
                  <FilterDateDoneBtn
                    onPress={() => setShowTimePicker(false)}
                    style={{ backgroundColor: colors.primary }}
                  >
                    <FilterDateDoneText>Done</FilterDateDoneText>
                  </FilterDateDoneBtn>
                </PickerSheet>
              </PickerSheetOverlay>
            </View>
          ) : null}
        </ModalOverlay>
      </Modal>
      <Modal
        transparent
        visible={showFilterDayPicker && Platform.OS === "ios"}
        animationType="slide"
        onRequestClose={() => setShowFilterDayPicker(false)}
      >
        <PickerSheetOverlay>
          <Pressable style={{ flex: 1 }} onPress={() => setShowFilterDayPicker(false)} />
          <PickerSheet style={{ backgroundColor: colors.surface, borderColor: colors.containerBorder }}>
            <PickerSheetHeader>
              <PickerSheetTitle style={{ color: colors.text }}>{t("reservationsPickerDate")}</PickerSheetTitle>
              <PickerSheetClose onPress={() => setShowFilterDayPicker(false)}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </PickerSheetClose>
            </PickerSheetHeader>
            <View style={{ width: "100%", alignItems: "center", justifyContent: "center" }}>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="inline"
                themeVariant={theme === "dark" ? "dark" : "light"}
                onValueChange={onFilterDateValueChange}
                style={{ alignSelf: "center", height: 340 }}
              />
            </View>
            <FilterDateDoneBtn onPress={() => setShowFilterDayPicker(false)}>
              <FilterDateDoneText>Done</FilterDateDoneText>
            </FilterDateDoneBtn>
          </PickerSheet>
        </PickerSheetOverlay>
      </Modal>
      {showFilterDayPicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="calendar"
          onValueChange={onFilterDateValueChange}
          onDismiss={() => setShowFilterDayPicker(false)}
        />
      ) : null}
      {showDayPicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={dateValueToDate(formData.day)}
          mode="date"
          display="calendar"
          onValueChange={onFormDayValueChange}
          onDismiss={() => setShowDayPicker(false)}
        />
      ) : null}
      {showTimePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={timeValueToDate(formData.time, formData.day)}
          mode="time"
          display="clock"
          is24Hour
          onValueChange={onFormTimeValueChange}
          onDismiss={() => setShowTimePicker(false)}
        />
      ) : null}
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
`;

const DateFilterPill = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex: 1;
  min-width: 0;
  border-width: 1px;
  border-radius: 999px;
  height: 52px;
  padding: 0 8px;
`;

const DateFilterCenter = styled.TouchableOpacity`
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
`;

const DayStepButton = styled.TouchableOpacity`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const FilterText = styled.Text`
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
  flex-shrink: 1;
`;

const HeaderActionRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  width: 100%;
  flex-wrap: nowrap;
`;

const HeaderAddButton = styled.TouchableOpacity`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  align-items: center;
  justify-content: center;
  background: #f97316;
  padding: 0;
  margin-right: 0;
`;

const BottomActionBar = styled.View`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 14px 0;
`;

const FilterDock = styled.View`
  border-width: 1px;
  border-radius: 32px;
  padding: 6px;
`;

const FilterDockInset = styled.View`
  border-width: 1px;
  border-radius: 24px;
  padding: 4px;
`;

const List = styled.View`
  margin-top: 14px;
  gap: 14px;
`;

const SectionBlock = styled.View`
  border-width: 1px;
  border-radius: 20px;
  overflow: hidden;
`;

const SectionHeader = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 14px;
`;

const SectionHeaderLeft = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
`;

const SectionTitle = styled.Text`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const SectionCount = styled.Text`
  min-width: 24px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  border-width: 1px;
  border-radius: 999px;
  padding: 3px 8px;
  overflow: hidden;
`;

const SectionCards = styled.View`
  gap: 12px;
  padding: 12px;
`;

const GroupWrap = styled.View`
  gap: 10px;
`;

const GroupDivider = styled.View`
  height: 1px;
  margin: 2px 0 2px;
  opacity: 0.75;
`;

const TimelineRow = styled.View`
  flex-direction: row;
  align-items: stretch;
`;

const ReservationCard = styled.View`
  flex: 1;
  border-width: 1px;
  border-radius: 22px;
  overflow: hidden;
  position: relative;
`;

const CardMain = styled.View`
  flex: 1;
  min-width: 0;
`;

const InfoCol = styled.View`
  padding: 14px 14px 12px;
  min-width: 0;
`;

const CardHeader = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
`;

const GuestBlock = styled.View`
  gap: 3px;
  padding-top: 1px;
`;

const GuestIdentity = styled.View`
  min-width: 0;
  gap: 10px;
`;

const NamePhoneRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-right: 4px;
`;

const NamePhoneSep = styled.Text`
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
`;

const TabletMetaRail = styled.View`
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
`;

const TabletMetaChip = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  border-width: 1px;
  flex-shrink: 1;
`;

const CallButton = styled.TouchableOpacity`
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 3;
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
  padding: 3px;
`;

const CallIconWrap = styled.View`
  width: 100%;
  height: 100%;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;

const Name = styled.Text`
  font-size: 17px;
  letter-spacing: -0.35px;
  line-height: 22px;
`;

const PhoneText = styled.Text`
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.15px;
  line-height: 18px;
`;

const MetaLine = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  margin-top: 7px;
`;

const MetaItem = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  flex-shrink: 1;
`;

const MetaSep = styled.Text`
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
`;

const MetaText = styled.Text`
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.1px;
  line-height: 18px;
`;

const NotesLine = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 6px;
  margin-top: 10px;
  padding-top: 9px;
  border-top-width: 1px;
`;

const NotesText = styled.Text`
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.1px;
  line-height: 18px;
`;

const ActionsRail = styled.View`
  border-top-width: 1px;
  padding: 10px 12px;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const SlideSlot = styled.View<{ $full?: boolean }>`
  flex: ${({ $full }) => ($full ? 1 : 1)};
  min-width: 0;
`;

const SlideTrack = styled.View`
  height: 42px;
  border-radius: 999px;
  border-width: 1px;
  overflow: hidden;
  justify-content: center;
`;

const SlideHint = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 12px 0 40px;
`;

const SlideHintText = styled.Text`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.15px;
`;

const SlideThumb = styled.View`
  flex: 1;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const EmptyText = styled.Text`
  margin-top: 16px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
`;

const ModalOverlay = styled.View`
  flex: 1;
  background: rgba(15, 23, 42, 0.45);
  justify-content: flex-end;
`;

const SheetKeyboardAvoid = styled(KeyboardAvoidingView)`
  flex: 1;
  justify-content: flex-end;
`;

const ModalCard = styled.View`
  border-width: 1px;
  border-top-left-radius: 28px;
  border-top-right-radius: 28px;
  border-bottom-left-radius: 0px;
  border-bottom-right-radius: 0px;
  padding: 12px 16px 14px;
  gap: 12px;
  height: 94%;
  margin-bottom: 0px;
`;

const ModalHandle = styled.View`
  width: 44px;
  height: 5px;
  border-radius: 999px;
  align-self: center;
  margin-bottom: 6px;
`;

const ModalTitle = styled.Text`
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.3px;
`;

const ModalHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const CloseModalBtn = styled.TouchableOpacity`
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const ModalFormScroll = styled(ScrollView)`
  flex: 1;
  max-height: 78%;
`;

const FormGrid = styled.View`
  gap: 18px;
`;

const FormSection = styled.View`
  gap: 10px;
`;

const ValidationCallout = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  border-width: 1.5px;
  border-radius: 16px;
  padding: 12px 12px 12px 11px;
  margin-bottom: 4px;
`;
const ValidationCalloutTextCol = styled.View`
  flex: 1;
  gap: 4px;
`;
const ValidationCalloutTitle = styled.Text`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;
const ValidationCalloutSub = styled.Text`
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  margin-bottom: 2px;
`;
const ValidationBulletRow = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 7px;
  margin-top: 1px;
`;
const ValidationBulletText = styled.Text`
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  flex: 1;
`;

const FieldBlock = styled.View`
  gap: 6px;
`;

const FieldLabel = styled.Text`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.45px;
  text-transform: uppercase;
`;

const FieldInput = styled(TextInput)`
  border-width: 1px;
  border-radius: 16px;
  padding: 13px 14px;
  font-size: 15px;
  font-weight: 500;
`;

const NotesInput = styled(TextInput)`
  border-width: 1px;
  border-radius: 16px;
  padding: 13px 14px;
  font-size: 15px;
  font-weight: 500;
  min-height: 96px;
`;

const InlineControl = styled.View`
  border-width: 1px;
  border-radius: 999px;
  flex-direction: row;
  align-items: center;
  padding: 5px;
  min-height: 48px;
`;

const InlineBtn = styled.TouchableOpacity`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const InlineCenter = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  min-width: 0;
`;

const InlineTapTarget = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 6px;
`;

const InlineValue = styled.Text`
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
`;

const TableSelectorWrap = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
`;

const TableChipInner = styled.View`
  flex-direction: row;
  align-items: center;
  max-width: 100%;
`;

const TableOptionChip = styled.TouchableOpacity`
  border-width: 1px;
  border-radius: 999px;
  padding: 9px 12px;
`;

const TableOptionText = styled.Text`
  font-size: 13px;
  font-weight: 600;
`;

const Row = styled.View`
  flex-direction: row;
  gap: 10px;
`;

const Half = styled.View`
  flex: 1;
  gap: 6px;
  min-width: 0;
`;

const FormActions = styled.View`
  flex-direction: row;
  gap: 10px;
  padding-top: 12px;
  border-top-width: 1px;
`;

const GhostBtn = styled.TouchableOpacity`
  flex: 1;
  height: 48px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const GhostBtnText = styled.Text`
  font-size: 15px;
  font-weight: 700;
`;

const PrimaryBtn = styled.TouchableOpacity`
  flex: 1;
  height: 48px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;

const PrimaryBtnText = styled.Text`
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.2px;
`;

const PickerSheetOverlay = styled.View`
  flex: 1;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.35);
`;

const PickerSheet = styled.View`
  background: #ffffff;
  border-top-left-radius: 28px;
  border-top-right-radius: 28px;
  padding: 12px 16px 14px;
  max-height: 85%;
  border-width: 1px;
  border-bottom-width: 0;
`;

const FilterDateDoneBtn = styled.TouchableOpacity`
  align-self: stretch;
  margin-top: 8px;
  margin-bottom: 4px;
  height: 44px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  background: #ff6600;
`;

const FilterDateDoneText = styled.Text`
  color: #fff;
  font-size: 15px;
  font-weight: 700;
`;

const PickerSheetHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const PickerSheetTitle = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
`;

const PickerSheetClose = styled.TouchableOpacity`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  background: rgba(148, 163, 184, 0.12);
`;

const PickerSheetScroll = styled(ScrollView)`
  max-height: 100%;
`;

const PickerRowBtn = styled.TouchableOpacity`
  padding: 12px 10px;
  border-bottom-width: 1px;
  border-bottom-color: rgba(148, 163, 184, 0.2);
`;

const PickerRowText = styled.Text<{ $active?: boolean }>`
  font-size: 15px;
  font-weight: ${({ $active }) => ($active ? 800 : 600)};
  color: ${({ $active }) => ($active ? "#ff6600" : "#0f172a")};
`;

export default function GatedReservationsScreen() {
  return (
    <PlanGate feature="reservations">
      <ReservationsScreen />
    </PlanGate>
  );
}
