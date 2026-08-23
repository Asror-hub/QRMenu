import { Fragment, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";
import { supabase } from "../services/supabase";
import { useRestaurant } from "../context/RestaurantContext";
import { useLanguage } from "../context/LanguageContext";
import { TopBarSlotsContext } from "../components/Layout";
import { cardItem, cardItemHover, cardPanel, listSurface, pageShell } from "../styles/cards";

function getDayBounds(baseDate) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function formatDayLabel(date, locale) {
  return date.toLocaleDateString(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDayLabelShort(date, locale) {
  return date.toLocaleDateString(locale, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
}

function getStatusChangeLabel(status, t) {
  const map = {
    booked: "setBackToWaiting",
    seated: "markedArrived",
    completed: "markedCompleted",
    cancelled: "reservationCancelled"
  };
  return t(map[status] ?? "statusUpdated");
}

function buildReservationIso(date, timeValue) {
  const [hours, minutes] = String(timeValue).split(":");
  const next = new Date(date);
  next.setHours(Number(hours || 0), Number(minutes || 0), 0, 0);
  return next.toISOString();
}

function addMinutesToTimeValue(timeValue, deltaMinutes) {
  const [h, m] = String(timeValue || "00:00").split(":");
  const total = (Number(h || 0) * 60 + Number(m || 0) + deltaMinutes + 24 * 60) % (24 * 60);
  const nextH = String(Math.floor(total / 60)).padStart(2, "0");
  const nextM = String(total % 60).padStart(2, "0");
  return `${nextH}:${nextM}`;
}

function isoToTimeValue(iso) {
  if (!iso) return "00:00";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "00:00";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getDurationLabel(startTime, endTime) {
  const [sh, sm] = String(startTime || "00:00").split(":");
  const [eh, em] = String(endTime || "00:00").split(":");
  const startTotal = Number(sh || 0) * 60 + Number(sm || 0);
  const endTotal = Number(eh || 0) * 60 + Number(em || 0);
  const diff = (endTotal - startTotal + 24 * 60) % (24 * 60);
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function toInputDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthGrid(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startWeekday = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startWeekday);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function buildTimeSlots15m() {
  const result = [];
  for (let mins = 0; mins < 24 * 60; mins += 15) {
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(mins % 60).padStart(2, "0");
    result.push(`${hh}:${mm}`);
  }
  return result;
}

function timeToMinutes(timeValue) {
  const [hours, minutes] = String(timeValue ?? "00:00")
    .slice(0, 5)
    .split(":")
    .map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function minutesToTimeValue(totalMinutes) {
  const mins = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Settings store Mon=0 … Sun=6; JS Date.getDay() is Sun=0 … Sat=6. */
function toRestaurantDayOfWeek(date) {
  return (date.getDay() + 6) % 7;
}

function buildTimeSlotsForHours(openTime, closeTime, { inclusiveClose = false } = {}) {
  const open = timeToMinutes(openTime ?? "09:00");
  const close = timeToMinutes(closeTime ?? "22:00");
  const result = [];
  const pushRange = (from, toExclusive) => {
    for (let mins = from; mins < toExclusive; mins += 15) {
      result.push(minutesToTimeValue(mins));
    }
  };

  if (close > open) {
    pushRange(open, inclusiveClose ? close + 15 : close);
  } else if (close < open) {
    // Overnight hours (e.g. 22:00 – 02:00)
    pushRange(open, 24 * 60);
    pushRange(0, inclusiveClose ? close + 15 : close);
  } else {
    pushRange(0, 24 * 60);
  }
  return result;
}

function clampTimeToSlots(timeValue, slots) {
  if (!slots.length) return timeValue;
  if (slots.includes(timeValue)) return timeValue;
  const target = timeToMinutes(timeValue);
  let best = slots[0];
  let bestDiff = Math.abs(timeToMinutes(best) - target);
  for (const slot of slots) {
    const diff = Math.abs(timeToMinutes(slot) - target);
    if (diff < bestDiff) {
      best = slot;
      bestDiff = diff;
    }
  }
  return best;
}

function getTableTitle(table, t) {
  if (!table) return t("table");
  if (table.table_name) {
    return table.table_number != null
      ? `${table.table_name} ${table.table_number}`
      : table.table_name;
  }
  return table.table_number != null ? t("tableLabel", { number: table.table_number }) : t("table");
}

function getSelectedTablesLabel(tableIds, tables, t) {
  if (!tableIds.length) return t("chooseTables");
  const labels = tableIds
    .map((id) => tables.find((table) => table.id === id)?.table_number)
    .filter((value) => value != null)
    .map((value) => String(value));
  if (!labels.length) return t("tablesSelected", { count: tableIds.length });
  return t("tableLabel", { number: labels.join(", ") });
}

function getReservationTableIds(item) {
  const relationIds = (item.reservation_tables ?? [])
    .map((entry) => entry?.table_id)
    .filter(Boolean);
  if (relationIds.length) return relationIds;
  return item.table_id ? [item.table_id] : [];
}

function getReservationEndIso(item) {
  if (item?.reservation_end_time) return item.reservation_end_time;
  if (!item?.reservation_time) return null;
  const start = new Date(item.reservation_time);
  if (Number.isNaN(start.getTime())) return null;
  start.setMinutes(start.getMinutes() + 120);
  return start.toISOString();
}

function formatTimeRangeChip(item, locale) {
  const raw = item?.reservation_time ?? item?.reservation_date ?? null;
  if (!raw) return "—";
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return String(raw);
  const startStr = start.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const endIso = getReservationEndIso(item);
  if (!endIso) return startStr;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return startStr;
  const endStr = end.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return `${startStr} - ${endStr}`;
}

/** Local minutes-from-midnight — rows with the same key share one time block (no divider between). */
function getReservationTimeGroupKey(item) {
  const raw = item?.reservation_time ?? item?.reservation_date ?? null;
  if (!raw) return -1;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return -2;
  return d.getHours() * 60 + d.getMinutes();
}

function getTableNumbersComma(item, tables) {
  const nums = [];
  (item.reservation_tables ?? []).forEach((entry) => {
    const n = entry?.tables?.table_number;
    if (n != null) nums.push(String(n));
  });
  if (nums.length) return nums.join(", ");
  const t = tables.find((x) => x.id === item.table_id);
  if (t?.table_number != null) return String(t.table_number);
  return "—";
}

function pickEmailLikeNotes(notes) {
  if (!notes || typeof notes !== "string") return "";
  const t = notes.trim();
  if (t.includes("@") && t.length < 80) return t.split(/\s+/)[0] || t;
  return "";
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function IconSvg({ size = 14, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

function TableDiningIcon({ size = 13 }) {
  return (
    <IconSvg size={size}>
      <path d="M4 9h16" />
      <path d="M12 9v5" />
      <path d="M8 14h8" />
    </IconSvg>
  );
}

function ArrivedSeatedIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g fill="currentColor">
        <rect x="3.75" y="14.35" width="11.9" height="2.4" rx="0.52" />
        <rect x="13.8" y="7.1" width="2.6" height="9.65" rx="0.55" />
        <rect x="5" y="16.78" width="1.52" height="3.08" rx="0.42" />
        <rect x="11.38" y="16.78" width="1.52" height="3.08" rx="0.42" />
        <circle cx="8.92" cy="9.38" r="1.95" />
        <ellipse cx="10.58" cy="12.82" rx="2.08" ry="2.72" transform="rotate(-15 10.58 12.82)" />
      </g>
      <circle
        cx="18.55"
        cy="6.72"
        r="2.48"
        fill="var(--surface)"
        stroke="currentColor"
        strokeWidth="1.65"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.42"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.92 6.7l1.12 1.08 2.36-2.28"
      />
    </svg>
  );
}

function StatusRailGlyph({ status }) {
  if (status === "seated") {
    return (
      <IconSvg size={16}>
        <path d="M20 6L9 17l-5-5" />
      </IconSvg>
    );
  }
  if (status === "completed") {
    return (
      <IconSvg size={16}>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </IconSvg>
    );
  }
  if (status === "cancelled") {
    return (
      <IconSvg size={16}>
        <path d="M18 6L6 18M6 6l12 12" />
      </IconSvg>
    );
  }
  return (
    <span style={{ color: "var(--text-muted)", display: "inline-flex" }}>
      <IconSvg size={15}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </IconSvg>
    </span>
  );
}

const Reservations = () => {
  const { restaurant } = useRestaurant();
  const { t, locale } = useLanguage();
  const { actionsEl: topBarActionsEl } = useContext(TopBarSlotsContext);
  const [dayOffset, setDayOffset] = useState(0);
  const [reservations, setReservations] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [updatingReservationId, setUpdatingReservationId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [calendarOpenUp, setCalendarOpenUp] = useState(false);
  const dayFieldRef = useRef(null);
  const [editingReservationId, setEditingReservationId] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [formData, setFormData] = useState({
    day: toInputDateValue(new Date()),
    tableIds: [],
    name: "",
    surname: "",
    phone: "",
    peopleSize: "2",
    time: "19:00",
    endTime: "21:00"
  });
  const [restaurantHours, setRestaurantHours] = useState([]);

  const selectedDate = useMemo(() => {
    const next = new Date();
    next.setDate(next.getDate() + dayOffset);
    return next;
  }, [dayOffset]);

  const dayLabel = useMemo(() => formatDayLabel(selectedDate, locale), [selectedDate, locale]);
  const dayLabelShort = useMemo(() => formatDayLabelShort(selectedDate, locale), [selectedDate, locale]);
  const [undoState, setUndoState] = useState(null);
  const undoTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
    []
  );

  useEffect(() => {
    const loadHours = async () => {
      if (!restaurant?.id) {
        setRestaurantHours([]);
        return;
      }
      const { data, error } = await supabase
        .from("restaurant_hours")
        .select("day_of_week, open_time, close_time, closed")
        .eq("restaurant_id", restaurant.id);
      if (error) {
        console.warn("[admin Reservations] hours load failed:", error.message);
        setRestaurantHours([]);
        return;
      }
      setRestaurantHours(data ?? []);
    };
    loadHours();
  }, [restaurant?.id]);

  const selectedFormDayHours = useMemo(() => {
    const dayDate = new Date(`${formData.day}T00:00:00`);
    if (Number.isNaN(dayDate.getTime())) return null;
    const dayOfWeek = toRestaurantDayOfWeek(dayDate);
    return restaurantHours.find((entry) => entry.day_of_week === dayOfWeek) ?? null;
  }, [formData.day, restaurantHours]);

  const dayOpenClose = useMemo(() => {
    if (!restaurantHours.length) return null;
    if (selectedFormDayHours?.closed) return { closed: true };
    const open = (selectedFormDayHours?.open_time ?? "09:00").slice(0, 5);
    const close = (selectedFormDayHours?.close_time ?? "22:00").slice(0, 5);
    return { closed: false, open, close };
  }, [restaurantHours, selectedFormDayHours]);

  const timeSlots = useMemo(() => {
    if (!dayOpenClose) return buildTimeSlots15m();
    if (dayOpenClose.closed) return [];
    return buildTimeSlotsForHours(dayOpenClose.open, dayOpenClose.close);
  }, [dayOpenClose]);

  const endTimeSlots = useMemo(() => {
    if (!dayOpenClose) return buildTimeSlots15m();
    if (dayOpenClose.closed) return [];
    return buildTimeSlotsForHours(dayOpenClose.open, dayOpenClose.close, {
      inclusiveClose: true
    });
  }, [dayOpenClose]);

  const isSelectedDayClosed = Boolean(dayOpenClose?.closed);

  useEffect(() => {
    if (!timeSlots.length || !endTimeSlots.length) return;
    setFormData((prev) => {
      const nextTime = clampTimeToSlots(prev.time, timeSlots);
      let nextEnd = clampTimeToSlots(prev.endTime, endTimeSlots);
      if (timeToMinutes(nextEnd) <= timeToMinutes(nextTime)) {
        nextEnd = clampTimeToSlots(addMinutesToTimeValue(nextTime, 120), endTimeSlots);
        if (timeToMinutes(nextEnd) <= timeToMinutes(nextTime)) {
          nextEnd = endTimeSlots[endTimeSlots.length - 1] ?? nextTime;
        }
      }
      if (nextTime === prev.time && nextEnd === prev.endTime) return prev;
      return { ...prev, time: nextTime, endTime: nextEnd };
    });
  }, [timeSlots, endTimeSlots]);
  const selectedReservationRange = useMemo(() => {
    const selectedDay = new Date(`${formData.day}T00:00:00`);
    if (Number.isNaN(selectedDay.getTime())) return null;
    const startIso = buildReservationIso(selectedDay, formData.time);
    const endIso = buildReservationIso(selectedDay, formData.endTime);
    return { startIso, endIso };
  }, [formData.day, formData.time, formData.endTime]);

  const unavailableTableIds = useMemo(() => {
    if (!selectedReservationRange) return new Set();
    const next = new Set();
    const startA = new Date(selectedReservationRange.startIso);
    const endA = new Date(selectedReservationRange.endIso);
    if (Number.isNaN(startA.getTime()) || Number.isNaN(endA.getTime())) return next;

    reservations.forEach((reservation) => {
      const status = reservation.status ?? "booked";
      if (status === "cancelled" || status === "completed") return;
      const startB = new Date(reservation.reservation_time ?? reservation.reservation_date ?? "");
      const endB = new Date(getReservationEndIso(reservation) ?? "");
      if (Number.isNaN(startB.getTime()) || Number.isNaN(endB.getTime())) return;
      if (!rangesOverlap(startA, endA, startB, endB)) return;
      getReservationTableIds(reservation).forEach((tableId) => next.add(tableId));
    });
    return next;
  }, [reservations, selectedReservationRange]);

  const openForm = () => {
    setEditingReservationId(null);
    setSubmitError("");
    const day = toInputDateValue(selectedDate);
    const nextDate = new Date(`${day}T00:00:00`);
    setCalendarMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    setFormData({
      day,
      tableIds: [],
      name: "",
      surname: "",
      phone: "",
      peopleSize: "2",
      time: "19:00",
      endTime: "21:00"
    });
    setShowCalendar(false);
    setShowTimePicker(false);
    setShowTablePicker(false);
    setShowForm(true);
  };

  const openEditForm = (reservation) => {
    const startIso = reservation?.reservation_time ?? reservation?.reservation_date ?? null;
    if (!startIso) return;
    const startDate = new Date(startIso);
    if (Number.isNaN(startDate.getTime())) return;
    const endIso = getReservationEndIso(reservation);
    const day = toInputDateValue(startDate);
    setEditingReservationId(reservation.id);
    setSubmitError("");
    setCalendarMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
    setFormData({
      day,
      tableIds: getReservationTableIds(reservation),
      name: reservation.customer_name ?? "",
      surname: "",
      phone: reservation.phone_number ?? "",
      peopleSize: String(reservation.guest_count ?? 2),
      time: isoToTimeValue(startIso),
      endTime: endIso ? isoToTimeValue(endIso) : addMinutesToTimeValue(isoToTimeValue(startIso), 120)
    });
    setShowCalendar(false);
    setShowTimePicker(false);
    setShowTablePicker(false);
    setShowForm(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setSubmitError("");
    setShowCalendar(false);
    setCalendarOpenUp(false);
    setShowTimePicker(false);
    setShowTablePicker(false);
    setEditingReservationId(null);
    setShowForm(false);
  };

  const loadReservations = async () => {
    if (!restaurant?.id) return;
    setLoading(true);
    setError("");
    try {
      const { start, end } = getDayBounds(selectedDate);

      const { data, error: loadError } = await supabase
        .from("reservations")
        .select("*, reservation_tables(table_id, tables(table_number, table_name))")
        .eq("restaurant_id", restaurant.id)
        .gte("reservation_date", start.toISOString())
        .lt("reservation_date", end.toISOString())
        .order("reservation_date", { ascending: true });

      // If table relation is not yet in schema cache, fall back to plain reservations query.
      if (loadError && String(loadError.message || "").includes("relationship")) {
        const { data: plainData, error: plainError } = await supabase
          .from("reservations")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .gte("reservation_date", start.toISOString())
          .lt("reservation_date", end.toISOString())
          .order("reservation_date", { ascending: true });
        if (plainError) {
          setReservations([]);
          setError(plainError.message);
          return;
        }
        setReservations(plainData ?? []);
        return;
      }

      if (loadError) {
        setReservations([]);
        setError(loadError.message);
        return;
      }
      setReservations(data ?? []);
    } catch (err) {
      setReservations([]);
      setError(err instanceof Error ? err.message : t("failedLoadReservations"));
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async () => {
    if (!restaurant?.id) return;
    const { data, error: tablesError } = await supabase
      .from("tables")
      .select("id, table_number, table_name")
      .eq("restaurant_id", restaurant.id)
      .order("table_number", { ascending: true });
    if (tablesError) {
      setSubmitError(tablesError.message);
      return;
    }
    setTables(data ?? []);
  };

  const cleanupOldClosedReservations = async () => {
    if (!restaurant?.id) return;
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("reservations")
      .delete()
      .eq("restaurant_id", restaurant.id)
      .in("status", ["cancelled", "completed"])
      .lt("created_at", cutoff);
  };

  useEffect(() => {
    if (!restaurant?.id) return;
    let cancelled = false;
    (async () => {
      await cleanupOldClosedReservations();
      await loadReservations();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurant?.id, selectedDate]);

  useEffect(() => {
    if (!restaurant?.id) return;

    const channel = supabase
      .channel(`reservations-admin-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        () => {
          loadReservations();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      loadReservations();
    }, 15000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id, selectedDate]);

  useEffect(() => {
    if (!restaurant?.id) return;
    const id = setInterval(() => {
      cleanupOldClosedReservations();
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [restaurant?.id]);

  useEffect(() => {
    loadTables();
  }, [restaurant?.id]);

  const submitReservation = async () => {
    if (submitting) return;
    if (!restaurant?.id) {
      const message = t("restaurantProfileNotLoaded");
      setSubmitError(message);
      window.alert(message);
      return;
    }
    const fullName = `${formData.name.trim()} ${formData.surname.trim()}`.trim();
    if (!fullName || !formData.phone.trim() || !formData.time || !formData.endTime || !formData.day) {
      setSubmitError(t("fillRequiredFields"));
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const selectedDay = new Date(`${formData.day}T00:00:00`);
      if (Number.isNaN(selectedDay.getTime())) {
        setSubmitError(t("chooseValidDay"));
        window.alert(t("chooseValidDay"));
        return;
      }
      const reservationIso = buildReservationIso(selectedDay, formData.time);
      const reservationEndIso = buildReservationIso(selectedDay, formData.endTime);
      const payload = {
        restaurant_id: restaurant.id,
        table_id: formData.tableIds[0] ?? null,
        customer_name: fullName,
        phone_number: formData.phone.trim(),
        guest_count: Math.max(1, Number(formData.peopleSize || 1)),
        reservation_date: reservationIso,
        reservation_time: reservationIso,
        reservation_end_time: reservationEndIso,
        status: "booked",
        source: editingReservationId ? undefined : "admin"
      };
      if (payload.source === undefined) delete payload.source;

      let targetReservationId = editingReservationId;
      if (editingReservationId) {
        let updateError = null;
        const withEnd = await supabase
          .from("reservations")
          .update(payload)
          .eq("id", editingReservationId);
        updateError = withEnd.error;
        if (updateError && String(updateError.message || "").includes("reservation_end_time")) {
          const { reservation_end_time, ...fallbackPayload } = payload;
          const fallback = await supabase
            .from("reservations")
            .update(fallbackPayload)
            .eq("id", editingReservationId);
          updateError = fallback.error;
        }
        if (updateError) {
          setSubmitError(updateError.message);
          window.alert(t("saveFailed", { message: updateError.message }));
          return;
        }
      } else {
        let insertData = null;
        let insertError = null;
        const insertWithEnd = await supabase.from("reservations").insert(payload).select("id").single();
        if (insertWithEnd.error && String(insertWithEnd.error.message || "").includes("reservation_end_time")) {
          const { reservation_end_time, ...fallbackPayload } = payload;
          const fallback = await supabase.from("reservations").insert(fallbackPayload).select("id").single();
          insertData = fallback.data;
          insertError = fallback.error;
        } else if (insertWithEnd.error && /source|schema cache|column/i.test(String(insertWithEnd.error.message || ""))) {
          const { source: _source, ...fallbackPayload } = payload;
          const fallback = await supabase.from("reservations").insert(fallbackPayload).select("id").single();
          insertData = fallback.data;
          insertError = fallback.error;
        } else {
          insertData = insertWithEnd.data;
          insertError = insertWithEnd.error;
        }
        if (insertError) {
          setSubmitError(insertError.message);
          window.alert(t("saveFailed", { message: insertError.message }));
          return;
        }
        targetReservationId = insertData?.id ?? null;
      }

      if (targetReservationId) {
        await supabase.from("reservation_tables").delete().eq("reservation_id", targetReservationId);
      }
      if (formData.tableIds.length > 0 && targetReservationId) {
        const joinRows = formData.tableIds.map((tableId) => ({
          reservation_id: targetReservationId,
          table_id: tableId
        }));
        const { error: joinError } = await supabase.from("reservation_tables").insert(joinRows);
        if (joinError) {
          setSubmitError(joinError.message);
          window.alert(t("saveFailed", { message: joinError.message }));
          return;
        }
      }

      // Close directly to avoid race with submitting flag checks.
      setShowForm(false);
      setShowCalendar(false);
      setShowTimePicker(false);
      setShowTablePicker(false);
      setEditingReservationId(null);
      setFormData((prev) => ({
        ...prev,
        tableIds: [],
        name: "",
        surname: "",
        phone: "",
        endTime: addMinutesToTimeValue(prev.time, 120)
      }));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(selectedDay);
      target.setHours(0, 0, 0, 0);
      const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      setDayOffset(diffDays);
      await loadReservations();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("unexpectedSaveError");
      setSubmitError(message);
      window.alert(t("saveFailed", { message }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await submitReservation();
  };

  const deleteReservation = async (reservationId) => {
    if (!reservationId || updatingReservationId) return;
    setUpdatingReservationId(reservationId);
    const { error: deleteError } = await supabase
      .from("reservations")
      .delete()
      .eq("id", reservationId);
    if (deleteError) {
      setError(deleteError.message);
      setUpdatingReservationId(null);
      return;
    }
    await loadReservations();
    setUpdatingReservationId(null);
  };

  const visibleReservations = useMemo(() => {
    if (!showActiveOnly) return reservations;
    return reservations.filter((item) => {
      const status = item.status ?? "booked";
      if (updatingReservationId && item.id === updatingReservationId) return true;
      return status === "booked" || status === "seated";
    });
  }, [reservations, showActiveOnly, updatingReservationId]);

  const sortedVisibleReservations = useMemo(() => {
    return [...visibleReservations].sort((a, b) => {
      const ta = new Date(a.reservation_time ?? a.reservation_date ?? 0).getTime();
      const tb = new Date(b.reservation_time ?? b.reservation_date ?? 0).getTime();
      return ta - tb;
    });
  }, [visibleReservations]);

  const commitReservationStatus = async (reservationId, nextStatus) => {
    setUpdatingReservationId(reservationId);
    setReservations((prev) =>
      prev.map((item) =>
        item.id === reservationId ? { ...item, status: nextStatus } : item
      )
    );

    const { error: updateError } = await supabase
      .from("reservations")
      .update({ status: nextStatus })
      .eq("id", reservationId);
    if (updateError) {
      setError(updateError.message);
      await loadReservations();
      setUpdatingReservationId(null);
      return false;
    }

    const willLeaveActiveList =
      showActiveOnly && (nextStatus === "cancelled" || nextStatus === "completed");
    if (willLeaveActiveList) {
      await new Promise((resolve) => setTimeout(resolve, 420));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 280));
    }

    await loadReservations();
    setUpdatingReservationId(null);
    return true;
  };

  const updateReservationStatus = async (reservationId, nextStatus) => {
    if (!reservationId || updatingReservationId) return;
    const current = reservations.find((item) => item.id === reservationId);
    const prevStatus = current?.status ?? "booked";
    const ok = await commitReservationStatus(reservationId, nextStatus);
    if (!ok) return;

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState({ reservationId, prevStatus, nextStatus, ts: Date.now() });
    undoTimerRef.current = setTimeout(() => setUndoState(null), 5000);
  };

  const handleUndoStatus = async () => {
    if (!undoState || updatingReservationId) return;
    const { reservationId, prevStatus } = undoState;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState(null);
    await commitReservationStatus(reservationId, prevStatus);
  };

  return (
    <Page>
      {topBarActionsEl &&
        createPortal(
          <AddIconButton type="button" onClick={openForm} aria-label={t("addReservation")} title={t("addReservation")}>
            <IconSvg size={20}>
              <path d="M12 5v14M5 12h14" />
            </IconSvg>
          </AddIconButton>,
          topBarActionsEl
        )}
      <HeaderRow>
        <DaySwitcher>
          <DayButton type="button" onClick={() => setDayOffset((p) => p - 1)} aria-label={t("previousDay")}>
            <DayChevron viewBox="0 0 24 24" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </DayChevron>
          </DayButton>
          <DayLabel>
            <span className="day-label-full">{dayLabel}</span>
            <span className="day-label-short">{dayLabelShort}</span>
          </DayLabel>
          <DayButton type="button" onClick={() => setDayOffset((p) => p + 1)} aria-label={t("nextDay")}>
            <DayChevron viewBox="0 0 24 24" aria-hidden>
              <path d="M9 18l6-6-6-6" />
            </DayChevron>
          </DayButton>
        </DaySwitcher>
        <HeaderActions>
          <ToggleControlButton
            type="button"
            onClick={() => setShowActiveOnly((prev) => !prev)}
            aria-label={showActiveOnly ? t("showAllReservations") : t("showActiveOnly")}
          >
            <ToggleTrack $active={showActiveOnly}>
              <ToggleThumb $active={showActiveOnly} />
            </ToggleTrack>
            <span>{t("activeOnly")}</span>
          </ToggleControlButton>
        </HeaderActions>
      </HeaderRow>

      <Card>
        {loading ? (
          <EmptyWrap>
            <EmptyText>{t("loadingReservations")}</EmptyText>
          </EmptyWrap>
        ) : error ? (
          <EmptyWrap>
            <EmptyText>{t("couldNotLoadReservations", { message: error })}</EmptyText>
            <AddButton type="button" onClick={openForm}>{t("addReservation")}</AddButton>
          </EmptyWrap>
        ) : visibleReservations.length === 0 ? (
          <EmptyWrap>
            <EmptyText>
              {showActiveOnly ? t("noActiveReservationsDay") : t("noReservationsDay")}
            </EmptyText>
            <AddButton type="button" onClick={openForm}>{t("addReservation")}</AddButton>
          </EmptyWrap>
        ) : (
          <ListSurface>
            {sortedVisibleReservations.map((item, index) => {
              const prev = index > 0 ? sortedVisibleReservations[index - 1] : null;
              const timeGroupKey = getReservationTimeGroupKey(item);
              const prevTimeGroupKey = prev ? getReservationTimeGroupKey(prev) : null;
              const showTimeBlockDivider = index > 0 && timeGroupKey !== prevTimeGroupKey;
              const status = item.status ?? "booked";
              const phone = item.phone_number ?? item.phone ?? "";
              const phoneHref = phone.replace(/[\s()-]/g, "");
              const guestCount = item.guest_count ?? item.party_size ?? item.people_count ?? 1;
              const emailChip = pickEmailLikeNotes(item.notes);
              const notesText =
                typeof item.notes === "string" && item.notes.trim() && !emailChip
                  ? item.notes.trim()
                  : "";
              const isWebsite = item.source === "website";
              const isStatusUpdating = updatingReservationId === item.id;
              const isExitingActive =
                isStatusUpdating &&
                showActiveOnly &&
                (status === "cancelled" || status === "completed");
              return (
                <Fragment key={item.id}>
                  {showTimeBlockDivider ? <TimeBlockDivider aria-hidden /> : null}
                  <ReservationCardTrack
                    $pulse={isStatusUpdating ? status : null}
                    $exiting={isExitingActive}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      if (event.target.closest("a,button")) return;
                      openEditForm(item);
                    }}
                    onClick={(event) => {
                      if (event.target.closest("a,button")) return;
                      openEditForm(item);
                    }}
                  >
                    <StatusRail $status={status} $animating={isStatusUpdating}>
                      {isStatusUpdating ? (
                        <StatusGlyphWrap key={status}>
                          <StatusRailGlyph status={status} />
                        </StatusGlyphWrap>
                      ) : (
                        <StatusRailGlyph status={status} />
                      )}
                    </StatusRail>
                    <ReservationCardMain>
                      <CardTextCol>
                        <CustomerBlock>
                          <CustomerNameRow>
                            <CustomerName $status={status}>
                              {item.customer_name ?? item.name ?? t("guest")}
                            </CustomerName>
                            <CustomerNameSep aria-hidden>·</CustomerNameSep>
                            <CustomerPhone $status={status}>{phone || t("noPhone")}</CustomerPhone>
                          </CustomerNameRow>
                        </CustomerBlock>
                        <ChipsWrap>
                          <InfoChip title={t("reservationTime")}>
                            <IconSvg size={13}>
                              <circle cx="12" cy="12" r="9" />
                              <path d="M12 7v5l3 2" />
                            </IconSvg>
                            {formatTimeRangeChip(item, locale)}
                          </InfoChip>
                          <InfoChip title={t("partySize")}>
                            <IconSvg size={13}>
                              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                            </IconSvg>
                            {guestCount}
                          </InfoChip>
                          <InfoChip title={t("tables")}>
                            <TableDiningIcon size={20} />
                            {getTableNumbersComma(item, tables)}
                          </InfoChip>
                          {isWebsite ? (
                            <InfoChip title={t("reservationFromWebsite")}>
                              <IconSvg size={13}>
                                <circle cx="12" cy="12" r="9" />
                                <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
                              </IconSvg>
                              {t("reservationFromWebsite")}
                            </InfoChip>
                          ) : null}
                          {emailChip ? (
                            <InfoChip title={t("notesEmail")}>
                              <IconSvg size={13}>
                                <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                                <path d="m22 7-10 6L2 7" />
                              </IconSvg>
                              {emailChip.length > 36 ? `${emailChip.slice(0, 33)}…` : emailChip}
                            </InfoChip>
                          ) : null}
                          {notesText ? (
                            <InfoChip title={t("reservationNotes")}>
                              <IconSvg size={13}>
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
                              </IconSvg>
                              {notesText.length > 36 ? `${notesText.slice(0, 33)}…` : notesText}
                            </InfoChip>
                          ) : null}
                        </ChipsWrap>
                      </CardTextCol>
                      <CardEndActions>
                        <ChevronHint aria-hidden>&#8250;</ChevronHint>
                        <ActionDivider />
                        {phoneHref ? (
                          <PhoneIconLink
                            href={`tel:${phoneHref}`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t("callCustomer")}
                          >
                            <IconSvg size={20}>
                              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                            </IconSvg>
                          </PhoneIconLink>
                        ) : (
                          <PhoneIconPlaceholder aria-hidden />
                        )}
                        {status === "booked" ? (
                          <>
                            <ActionDivider />
                            <QuickIconButton
                              type="button"
                              $tone="danger"
                              $pressed={isStatusUpdating && status === "cancelled"}
                              title={t("cancelReservation")}
                              aria-label={t("cancelReservation")}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateReservationStatus(item.id, "cancelled");
                              }}
                              disabled={Boolean(updatingReservationId)}
                            >
                              <IconSvg size={20}>
                                <path d="M18 6L6 18M6 6l12 12" />
                              </IconSvg>
                            </QuickIconButton>
                            <ActionDivider />
                            <QuickIconButton
                              type="button"
                              $tone="success"
                              $pressed={isStatusUpdating && status === "seated"}
                              title={t("markArrived")}
                              aria-label={t("markArrived")}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateReservationStatus(item.id, "seated");
                              }}
                              disabled={Boolean(updatingReservationId)}
                            >
                              <ArrivedSeatedIcon size={24} />
                            </QuickIconButton>
                          </>
                        ) : null}
                        {status === "seated" ? (
                          <>
                            <ActionDivider />
                            <QuickIconButton
                              type="button"
                              $tone="neutral"
                              $pressed={isStatusUpdating && status === "completed"}
                              title={t("markCompleted")}
                              aria-label={t("markCompleted")}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateReservationStatus(item.id, "completed");
                              }}
                              disabled={Boolean(updatingReservationId)}
                            >
                              <IconSvg size={20}>
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                              </IconSvg>
                            </QuickIconButton>
                          </>
                        ) : null}
                        {(status === "cancelled" || status === "completed") && (
                          <>
                            <ActionDivider />
                            <QuickIconButton
                              type="button"
                              $tone="danger"
                              title={t("removeReservation")}
                              aria-label={t("removeReservation")}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteReservation(item.id);
                              }}
                              disabled={updatingReservationId === item.id}
                            >
                              <IconSvg size={20}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </IconSvg>
                            </QuickIconButton>
                          </>
                        )}
                      </CardEndActions>
                    </ReservationCardMain>
                  </ReservationCardTrack>
                </Fragment>
              );
            })}
          </ListSurface>
        )}
      </Card>

      {showForm && (
        <ModalOverlay onClick={closeForm}>
          <ModalCard onClick={(event) => event.stopPropagation()}>
            <ModalHeader>
              <ModalHeading>
                <ModalEyebrow>{t("navReservations")}</ModalEyebrow>
                <FormTitle>{editingReservationId ? t("editReservation") : t("addReservation")}</FormTitle>
              </ModalHeading>
              <CloseButton type="button" onClick={closeForm} aria-label={t("close")}>
                ×
              </CloseButton>
            </ModalHeader>
            <FormCard onSubmit={handleSubmit}>
              <ModalBody>
              <FormGrid>
                <Field>
                  <Label>{t("name")}</Label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </Field>
                <Field>
                  <Label>{t("surname")}</Label>
                  <Input
                    type="text"
                    value={formData.surname}
                    onChange={(event) => setFormData((prev) => ({ ...prev, surname: event.target.value }))}
                    required
                  />
                </Field>
                <Field>
                  <Label>{t("phoneNumber")}</Label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                    required
                  />
                </Field>
                <Field>
                  <Label>{t("peopleSize")}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.peopleSize}
                    onChange={(event) => setFormData((prev) => ({ ...prev, peopleSize: event.target.value }))}
                    required
                  />
                </Field>
                <Field>
                  <Label>{t("startTime")}</Label>
                  <TimeSelectWrap>
                    <TimeSelectButton
                      type="button"
                      onClick={() => {
                        setShowTimePicker((prev) => !prev);
                        setShowCalendar(false);
                        setShowTablePicker(false);
                      }}
                      aria-label={t("selectReservationTime")}
                    >
                      <TimeSelectValue>{formData.time}</TimeSelectValue>
                      <TimeSelectIcon aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M12 7v5l3 2" />
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      </TimeSelectIcon>
                    </TimeSelectButton>
                    {showTimePicker && (
                      <TimePopover $openUp>
                        <TimePopoverHeader>
                          {isSelectedDayClosed
                            ? t("restaurantClosedDay")
                            : t("chooseTime24h")}
                        </TimePopoverHeader>
                        {timeSlots.length === 0 ? (
                          <TimeEmptyHint>
                            {isSelectedDayClosed
                              ? t("noReservationTimes")
                              : t("noOpeningHours")}
                          </TimeEmptyHint>
                        ) : (
                          <TimeGrid>
                            {timeSlots.map((slot) => (
                              <TimeOption
                                key={slot}
                                type="button"
                                $active={formData.time === slot}
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    time: slot,
                                    endTime: clampTimeToSlots(
                                      addMinutesToTimeValue(slot, 120),
                                      endTimeSlots
                                    )
                                  }));
                                  setShowTimePicker(false);
                                }}
                              >
                                {slot}
                              </TimeOption>
                            ))}
                          </TimeGrid>
                        )}
                      </TimePopover>
                    )}
                  </TimeSelectWrap>
                </Field>
                <Field>
                  <Label>{t("finishTime")}</Label>
                  <EndTimeWrap>
                    <EndTimeControl
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          endTime: clampTimeToSlots(
                            addMinutesToTimeValue(prev.endTime, -15),
                            endTimeSlots.length ? endTimeSlots : buildTimeSlots15m()
                          )
                        }))
                      }
                    >
                      <ControlIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 12h12" />
                      </ControlIcon>
                    </EndTimeControl>
                    <EndTimeCenter>
                      <EndTimeValue>{formData.endTime}</EndTimeValue>
                      <DurationBadge>({getDurationLabel(formData.time, formData.endTime)})</DurationBadge>
                    </EndTimeCenter>
                    <EndTimeControl
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          endTime: clampTimeToSlots(
                            addMinutesToTimeValue(prev.endTime, 15),
                            endTimeSlots.length ? endTimeSlots : buildTimeSlots15m()
                          )
                        }))
                      }
                    >
                      <ControlIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 6v12M6 12h12" />
                      </ControlIcon>
                    </EndTimeControl>
                  </EndTimeWrap>
                </Field>
                <Field ref={dayFieldRef} style={{ position: "relative" }}>
                  <Label>{t("daySelector")}</Label>
                  <CalendarButton
                    type="button"
                    onClick={() => {
                      setShowTimePicker(false);
                      setShowTablePicker(false);
                      setShowCalendar((prev) => {
                        const next = !prev;
                        if (next && dayFieldRef.current) {
                          const rect = dayFieldRef.current.getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const estimatedHeight = 320;
                          setCalendarOpenUp(spaceBelow < estimatedHeight && rect.top > spaceBelow);
                        }
                        return next;
                      });
                    }}
                    aria-label={t("selectReservationDay")}
                  >
                    <span>
                      {Number.isNaN(new Date(`${formData.day}T00:00:00`).getTime())
                        ? t("selectDay")
                        : formatDayLabel(new Date(`${formData.day}T00:00:00`), locale)}
                    </span>
                    <span>{showCalendar ? (calendarOpenUp ? "\u25BC" : "\u25B2") : "\u25BC"}</span>
                  </CalendarButton>
                  {showCalendar && (
                    <CalendarPopover $openUp={calendarOpenUp}>
                      <CalendarHeader>
                        <CalendarNav
                          type="button"
                          onClick={() =>
                            setCalendarMonth(
                              (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                            )
                          }
                        >
                          &#x2039;
                        </CalendarNav>
                        <CalendarMonthLabel>
                          {calendarMonth.toLocaleDateString(locale, {
                            month: "long",
                            year: "numeric"
                          })}
                        </CalendarMonthLabel>
                        <CalendarNav
                          type="button"
                          onClick={() =>
                            setCalendarMonth(
                              (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                            )
                          }
                        >
                          &#x203A;
                        </CalendarNav>
                      </CalendarHeader>
                      <CalendarWeekRow>
                        {[t("day_monday"), t("day_tuesday"), t("day_wednesday"), t("day_thursday"), t("day_friday"), t("day_saturday"), t("day_sunday")].map((day) => (
                          <CalendarWeekLabel key={day}>{day}</CalendarWeekLabel>
                        ))}
                      </CalendarWeekRow>
                      <CalendarGrid>
                        {getMonthGrid(calendarMonth).map((day) => {
                          const dayKey = toInputDateValue(day);
                          const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                          const isSelected = dayKey === formData.day;
                          return (
                            <CalendarDay
                              key={day.toISOString()}
                              type="button"
                              $selected={isSelected}
                              $outside={!isCurrentMonth}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, day: dayKey }));
                                setShowCalendar(false);
                              }}
                            >
                              {day.getDate()}
                            </CalendarDay>
                          );
                        })}
                      </CalendarGrid>
                    </CalendarPopover>
                  )}
                </Field>
                <Field style={{ position: "relative" }}>
                  <Label>{t("selectTable")}</Label>
                  <TableSelectWrap>
                    <CalendarButton
                      type="button"
                      onClick={() => {
                        setShowTablePicker((prev) => !prev);
                        setShowCalendar(false);
                        setShowTimePicker(false);
                      }}
                    >
                      {formData.tableIds.length === 0 ? (
                        <TableSelectValue $muted>
                          {getSelectedTablesLabel(formData.tableIds, tables, t)}
                        </TableSelectValue>
                      ) : (
                        <TableChipRow>
                          {formData.tableIds
                            .map((id) => tables.find((t) => t.id === id))
                            .filter(Boolean)
                            .slice(0, 4)
                            .map((table) => (
                              <TableChip key={table.id}>
                                {table.table_number != null
                                  ? table.table_number
                                  : getTableTitle(table, t)}
                              </TableChip>
                            ))}
                          {formData.tableIds.length > 4 ? (
                            <TableChip $more>+{formData.tableIds.length - 4}</TableChip>
                          ) : null}
                        </TableChipRow>
                      )}
                      <TableSelectChevron aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                          <path
                            d={showTablePicker ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </TableSelectChevron>
                    </CalendarButton>
                    {showTablePicker && (
                      <TablePopover $openUp>
                        <TablePopoverTop>
                          <TimePopoverHeader>
                            {formData.tableIds.length
                              ? t("tablesSelected", { count: formData.tableIds.length })
                              : t("pickOneOrMoreTables")}
                          </TimePopoverHeader>
                          {formData.tableIds.length > 0 ? (
                            <TableClearButton
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({ ...prev, tableIds: [] }))
                              }
                            >
                              {t("clear")}
                            </TableClearButton>
                          ) : null}
                        </TablePopoverTop>
                        {tables.length === 0 ? (
                          <TimeEmptyHint>{t("noTablesYet")}</TimeEmptyHint>
                        ) : (
                          <TableScrollList>
                            {tables.map((table) => {
                              const isSelected = formData.tableIds.includes(table.id);
                              const isUnavailable =
                                unavailableTableIds.has(table.id) && !isSelected;
                              return (
                                <TableOptionRow
                                  key={table.id}
                                  type="button"
                                  $selected={isSelected}
                                  $disabled={isUnavailable}
                                  onClick={() =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      tableIds: isSelected
                                        ? prev.tableIds.filter((id) => id !== table.id)
                                        : [...prev.tableIds, table.id]
                                    }))
                                  }
                                  disabled={isUnavailable}
                                >
                                  <TableOptionMeta>
                                    <TableOptionTitle>
                                      {table.table_name
                                        ? table.table_name
                                        : t("tableLabel", { number: table.table_number ?? "" }).trim()}
                                    </TableOptionTitle>
                                    <TableOptionStatus $busy={isUnavailable}>
                                      {isUnavailable ? t("busyAtThisTime") : t("available")}
                                    </TableOptionStatus>
                                  </TableOptionMeta>
                                  <TableCheck $on={isSelected} $disabled={isUnavailable} aria-hidden>
                                    {isSelected ? (
                                      <svg viewBox="0 0 24 24" width="12" height="12">
                                        <path
                                          d="M5 12.5l4.2 4.2L19 7.5"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2.6"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    ) : null}
                                  </TableCheck>
                                </TableOptionRow>
                              );
                            })}
                          </TableScrollList>
                        )}
                      </TablePopover>
                    )}
                  </TableSelectWrap>
                </Field>
              </FormGrid>
              {submitError && <FormError>{submitError}</FormError>}
              </ModalBody>
              <FormActions>
                <SecondaryButton type="button" onClick={closeForm}>{t("cancel")}</SecondaryButton>
                <PrimaryButton
                  type="button"
                  onClick={submitReservation}
                  disabled={submitting}
                >
                  {submitting ? t("saving") : t("saveReservation")}
                </PrimaryButton>
              </FormActions>
            </FormCard>
          </ModalCard>
        </ModalOverlay>
      )}

      {undoState && (
        <UndoToast key={undoState.ts}>
          <UndoRow>
            <UndoDot aria-hidden />
            <UndoText>{getStatusChangeLabel(undoState.nextStatus, t)}</UndoText>
            <UndoButton type="button" onClick={handleUndoStatus} disabled={Boolean(updatingReservationId)}>
              {t("undo")}
            </UndoButton>
          </UndoRow>
          <UndoProgressTrack>
            <UndoProgress />
          </UndoProgressTrack>
        </UndoToast>
      )}
    </Page>
  );
};

const Page = styled.div`
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 18px;
  padding: 14px;
  flex: 1;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  ${pageShell}

  @media (max-width: 600px) {
    padding: 10px;
    gap: 12px;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 2px 2px 4px;
  flex-shrink: 0;

  @media (max-width: 600px) {
    flex-wrap: nowrap;
    align-items: center;
    gap: 10px;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;

  @media (max-width: 600px) {
    flex: 0 0 auto;
    justify-content: flex-end;
  }
`;

const DaySwitcher = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 10px;
  border: 1px solid var(--orders-container-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 90%, var(--button-overlay) 10%);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 55%, transparent);
  box-sizing: border-box;

  @media (max-width: 600px) {
    flex: 1 1 0;
    min-width: 0;
    justify-content: space-between;
  }
`;

const DayButton = styled.button`
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--surface) 86%, var(--button-overlay) 14%);
  color: var(--text);
  cursor: pointer;
  font-size: 20px;
  line-height: 0;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.12s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--orders-container-border) 65%, var(--text) 35%);
    background: color-mix(in srgb, var(--hover-overlay) 45%, var(--surface) 55%);
    transform: translateY(-1px);
  }
`;

const DayChevron = styled.svg`
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 2.3;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
  display: block;
  flex-shrink: 0;
`;

const DayLabel = styled.span`
  min-width: 252px;
  text-align: center;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.01em;

  .day-label-short {
    display: none;
  }

  @media (max-width: 600px) {
    min-width: 0;
    flex: 1;
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    .day-label-full {
      display: none;
    }

    .day-label-short {
      display: inline;
    }
  }
`;

const ToggleControlButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  border: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--surface) 90%, var(--button-overlay) 10%);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 55%, transparent);
  color: var(--text);
  border-radius: 999px;
  padding: 0 14px 0 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.01em;
  box-sizing: border-box;
`;

const ToggleTrack = styled.span`
  position: relative;
  width: 42px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid
    ${({ $active }) =>
      $active
        ? "color-mix(in srgb, var(--orders-container-border) 55%, var(--text) 25%)"
        : "var(--orders-container-border)"};
  background: ${({ $active }) =>
    $active
      ? "linear-gradient(135deg, color-mix(in srgb, var(--primary) 75%, #f97316 25%), color-mix(in srgb, var(--primary) 55%, #fb923c 45%))"
      : "color-mix(in srgb, var(--button-overlay) 85%, var(--surface) 15%)"};
  transition: background 0.18s ease, border-color 0.18s ease;
`;

const ToggleThumb = styled.span`
  position: absolute;
  top: 2px;
  left: ${({ $active }) => ($active ? "20px" : "2px")};
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(2, 6, 23, 0.2);
  transition: left 0.18s ease;
`;

const Card = styled.div`
  ${cardPanel}
  padding: 16px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  @media (max-width: 600px) {
    padding: 10px;
  }
`;

const ListSurface = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 6px 0 0;
  padding: 14px 12px;
  min-height: 0;
  flex: 1 1 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
  ${listSurface}

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  @media (max-width: 600px) {
    padding: 10px 6px;
    gap: 10px;
  }
`;

const EmptyWrap = styled.div`
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 12px;
  padding: 34px 14px;
  min-height: 0;
  flex: 1;
`;

const TimeBlockDivider = styled.div`
  position: relative;
  height: 1px;
  flex: 0 0 auto;
  margin: 4px 0 6px;
  background: linear-gradient(
    90deg,
    var(--orders-container-border),
    color-mix(in srgb, var(--orders-container-border) 45%, transparent)
  );
  opacity: 0.95;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 7px;
    height: 7px;
    border-radius: 999px;
    transform: translateY(-50%);
    background: var(--orders-container-border);
  }
`;

const statusGlyphIn = keyframes`
  0% {
    transform: scale(0.35) rotate(-12deg);
    opacity: 0;
  }
  55% {
    transform: scale(1.18) rotate(2deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
`;

const statusRailFlash = keyframes`
  0% { opacity: 0.5; }
  100% { opacity: 0; }
`;

const statusPulseSeated = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
  45% { box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.28); }
`;

const statusPulseCancelled = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  45% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.26); }
`;

const statusPulseCompleted = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
  45% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.26); }
`;

const statusCardExit = keyframes`
  0% {
    opacity: 1;
    transform: translateX(0);
  }
  100% {
    opacity: 0;
    transform: translateX(14px);
  }
`;

const statusButtonPress = keyframes`
  0% { transform: scale(1); }
  40% { transform: scale(0.88); }
  100% { transform: scale(1); }
`;

const ReservationCardTrack = styled.div`
  flex: 0 0 auto;
  min-width: 0;
  min-height: 72px;
  display: flex;
  align-items: stretch;
  ${cardItem}
  ${cardItemHover}
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  transform-origin: center left;

  ${({ $pulse, $exiting }) => {
    if ($exiting) return css`animation: ${statusCardExit} 0.38s ease forwards;`;
    if ($pulse === "seated") return css`animation: ${statusPulseSeated} 0.45s ease;`;
    if ($pulse === "cancelled") return css`animation: ${statusPulseCancelled} 0.45s ease;`;
    if ($pulse === "completed") return css`animation: ${statusPulseCompleted} 0.45s ease;`;
    return null;
  }}

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
`;

const StatusRail = styled.div`
  width: 28px;
  flex-shrink: 0;
  align-self: stretch;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ $status }) =>
    $status === "completed" ? "var(--text-muted)" : "#fff"};
  background: ${({ $status }) =>
    $status === "completed"
      ? "color-mix(in srgb, var(--orders-container-border) 72%, var(--surface))"
      : $status === "cancelled"
        ? "var(--danger)"
        : $status === "seated"
          ? "#4ade80"
          : "transparent"};
  transition: background 0.35s ease, color 0.35s ease;

  ${({ $animating }) =>
    $animating &&
    css`
      &::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.34),
          rgba(255, 255, 255, 0)
        );
        animation: ${statusRailFlash} 0.45s ease;
        pointer-events: none;
      }
    `}

  &::after {
    content: "";
    position: absolute;
    top: 9px;
    bottom: 9px;
    right: 0;
    width: 1px;
    background: ${({ $status }) =>
      $status === "booked" || !$status
        ? "color-mix(in srgb, var(--orders-container-border) 85%, #fff 15%)"
        : "transparent"};
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
`;

const StatusGlyphWrap = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  animation: ${statusGlyphIn} 0.42s cubic-bezier(0.22, 1, 0.36, 1);
`;

const ReservationCardMain = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }
`;

const CardTextCol = styled.div`
  flex: 1;
  min-width: 0;
  padding: 11px 0 11px 10px;
  display: grid;
  gap: 9px;
  align-content: start;

  @media (max-width: 600px) {
    padding: 10px 10px 8px 10px;
    gap: 7px;
  }
`;

const CustomerBlock = styled.div`
  min-width: 0;
`;

const CustomerNameRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 10px;
  min-width: 0;
  line-height: 1.25;
`;

const CustomerNameSep = styled.span`
  color: var(--text-muted);
  font-weight: 600;
  font-size: 15px;
  user-select: none;
  margin: 0 -1px;
`;

const CustomerName = styled.span`
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${({ $status }) =>
    $status === "cancelled" ? "var(--danger)" : $status === "seated" ? "var(--success)" : "var(--text)"};
  word-break: break-word;

  @media (max-width: 600px) {
    font-size: 15.5px;
  }
`;

const CustomerPhone = styled.span`
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${({ $status }) =>
    $status === "cancelled"
      ? "color-mix(in srgb, var(--danger) 88%, var(--text) 12%)"
      : $status === "seated"
        ? "color-mix(in srgb, var(--success) 82%, var(--text) 18%)"
        : "var(--text)"};
  opacity: ${({ $status }) => ($status === "cancelled" || $status === "seated" ? 0.95 : 0.88)};
  word-break: break-word;

  @media (max-width: 600px) {
    font-size: 14px;
  }
`;

const ChipsWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
`;

const InfoChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  background: transparent;
  border: 1px solid var(--orders-container-border);

  svg {
    color: color-mix(in srgb, var(--primary) 68%, var(--text-muted) 32%);
  }
`;

const CardEndActions = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 6px 8px 6px 0;
  border-left: 1px solid var(--orders-container-border);
  margin-left: 2px;

  @media (max-width: 600px) {
    border-left: none;
    border-top: 1px solid var(--orders-container-border);
    margin-left: 0;
    padding: 2px 6px 2px 8px;
    justify-content: flex-end;
  }
`;

const ChevronHint = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 22px;
  font-weight: 300;
  color: color-mix(in srgb, var(--primary) 55%, var(--text-muted) 45%);
  line-height: 1;
  padding: 0 2px 0 4px;
  user-select: none;
`;

const ActionDivider = styled.span`
  width: 1px;
  flex-shrink: 0;
  align-self: stretch;
  margin: 4px 6px;
  min-height: 42px;
  background: var(--orders-container-border);
  opacity: 0.9;
`;

const PhoneIconLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 10px;
  color: color-mix(in srgb, var(--primary) 62%, var(--text-muted) 38%);
  text-decoration: none;
  transition: background 0.12s ease, color 0.12s ease;

  &:hover {
    background: var(--hover-overlay);
    color: var(--primary);
  }
`;

const PhoneIconPlaceholder = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
`;

const QuickIconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  background: transparent;
  color: ${({ $tone }) =>
    $tone === "danger" ? "var(--danger)" : $tone === "success" ? "var(--success)" : "var(--text-muted)"};
  transition: background 0.12s ease, color 0.12s ease, transform 0.1s ease;

  ${({ $pressed }) =>
    $pressed &&
    css`
      animation: ${statusButtonPress} 0.38s ease;
    `}

  &:hover:not(:disabled) {
    background: var(--hover-overlay);
    transform: scale(1.04);
  }

  &:active:not(:disabled) {
    transform: scale(0.92);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const EmptyText = styled.p`
  margin: 0;
  color: var(--text-muted);
`;

const FormCard = styled.form`
  padding: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
`;

const ModalBody = styled.div`
  display: grid;
  gap: 14px;
  padding: 20px 22px;

  @media (max-width: 600px) {
    padding: 16px;
  }
`;

const FormTitle = styled.h3`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text);
  line-height: 1.15;
`;

const FormGrid = styled.div`
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label`
  display: grid;
  gap: 6px;
`;

const Label = styled.span`
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
`;

const Input = styled.input`
  border: 1px solid var(--orders-container-border);
  border-radius: 12px;
  padding: 11px 13px;
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--orders-container-border) 55%, var(--text) 45%);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--orders-container-border) 35%, transparent);
  }
`;

const TimeSelectWrap = styled.div`
  position: relative;
`;

const EndTimeWrap = styled.div`
  border: 1px solid var(--orders-container-border);
  border-radius: 14px;
  padding: 8px;
  background: color-mix(in srgb, var(--orders-container-border) 18%, var(--surface));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const EndTimeControl = styled.button`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--orders-container-border) 22%, var(--surface));
  color: var(--text);
  cursor: pointer;
  font-size: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--orders-container-border) 55%, var(--text) 45%);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--text) 8%, transparent);
  }

  &:active {
    transform: translateY(1px);
  }
`;

const ControlIcon = styled.svg`
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  fill: none;
  flex-shrink: 0;
`;

const EndTimeValue = styled.span`
  font-size: 14px;
  font-weight: 500;
`;

const EndTimeCenter = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  text-align: center;
  flex: 1;
`;

const DurationBadge = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  opacity: 0.9;
  min-width: 80px;
  text-align: center;
`;

const TableSelectWrap = styled.div`
  position: relative;
  width: 100%;
`;

const TableSelectValue = styled.span`
  font-size: 14px;
  font-weight: ${({ $muted }) => ($muted ? 500 : 600)};
  color: ${({ $muted }) => ($muted ? "var(--text-muted)" : "var(--text)")};
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
`;

const TableChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
  justify-content: flex-start;
`;

const TableChip = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 26px;
  padding: 0 9px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid var(--orders-container-border);
  background: ${({ $more }) =>
    $more
      ? "color-mix(in srgb, var(--text) 4%, var(--surface))"
      : "color-mix(in srgb, var(--sidebar-orange) 14%, var(--surface))"};
  color: ${({ $more }) => ($more ? "var(--text-muted)" : "var(--text)")};
`;

const TableSelectChevron = styled.span`
  color: var(--text-muted);
  display: inline-flex;
  flex-shrink: 0;
`;

const TablePopover = styled.div`
  position: absolute;
  z-index: 45;
  left: 0;
  right: 0;
  ${({ $openUp }) =>
    $openUp
      ? `
    bottom: calc(100% + 8px);
    top: auto;
  `
      : `
    top: calc(100% + 8px);
    bottom: auto;
  `}
  border: 1px solid var(--orders-container-border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 18px 36px rgba(2, 6, 23, 0.22);
  padding: 10px;
  display: grid;
  gap: 8px;
`;

const TablePopoverTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 2px 0;
`;

const TableClearButton = styled.button`
  border: none;
  background: transparent;
  color: var(--sidebar-orange);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
`;

const TableScrollList = styled.div`
  max-height: 220px;
  overflow-y: auto;
  display: grid;
  gap: 6px;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--text) 18%, transparent);
    border-radius: 999px;
  }
`;

const TableOptionRow = styled.button`
  border: 1px solid var(--orders-container-border);
  background: ${({ $selected, $disabled }) =>
    $selected
      ? "color-mix(in srgb, var(--sidebar-orange) 12%, var(--surface))"
      : $disabled
        ? "color-mix(in srgb, var(--text) 3%, var(--surface))"
        : "var(--surface)"};
  box-shadow: ${({ $selected }) =>
    $selected ? "inset 3px 0 0 var(--sidebar-orange)" : "none"};
  color: var(--text);
  border-radius: 12px;
  min-height: 48px;
  padding: 8px 10px 8px 8px;
  cursor: pointer;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px;
  align-items: center;
  gap: 10px;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  opacity: ${({ $disabled }) => ($disabled ? 0.72 : 1)};

  &:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--orders-container-border) 65%, var(--text) 35%);
    background: ${({ $selected }) =>
      $selected
        ? "color-mix(in srgb, var(--sidebar-orange) 16%, var(--surface))"
        : "color-mix(in srgb, var(--text) 3%, var(--surface))"};
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

const TableOptionMeta = styled.span`
  display: grid;
  gap: 2px;
  min-width: 0;
`;

const TableOptionTitle = styled.span`
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TableOptionStatus = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${({ $busy }) => ($busy ? "var(--danger, #dc2626)" : "var(--text-muted)")};
`;

const TableCheck = styled.span`
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1.5px solid
    ${({ $on }) => ($on ? "var(--sidebar-orange)" : "var(--orders-container-border)")};
  background: ${({ $on }) => ($on ? "var(--sidebar-orange)" : "transparent")};
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;


const TimeSelectButton = styled.button`
  border: 1px solid var(--orders-container-border);
  border-radius: 14px;
  width: 100%;
  padding: 13px 42px 13px 14px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  position: relative;

  &:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--orders-container-border) 55%, var(--text) 45%);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--orders-container-border) 35%, transparent);
    transform: translateY(-1px);
  }
`;

const TimeSelectValue = styled.span`
  font-size: 14px;
  font-weight: 600;
`;

const TimeSelectIcon = styled.span`
  display: inline-flex;
  pointer-events: none;
  color: #64748b;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);

  svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const TimePopover = styled.div`
  position: absolute;
  z-index: 40;
  left: 0;
  right: 0;
  ${({ $openUp }) =>
    $openUp
      ? `
    bottom: calc(100% + 8px);
    top: auto;
  `
      : `
    top: calc(100% + 8px);
    bottom: auto;
  `}
  border: 1px solid var(--orders-container-border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 18px 36px rgba(2, 6, 23, 0.22);
  padding: 10px;
  display: grid;
  gap: 8px;
`;

const TimePopoverHeader = styled.span`
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 700;
`;

const TimeEmptyHint = styled.p`
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  padding: 8px 4px 4px;
`;

const TimeGrid = styled.div`
  max-height: 220px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
`;

const TimeOption = styled.button`
  border: 1px solid ${({ $active }) => ($active ? "transparent" : "var(--orders-container-border)")};
  background: ${({ $active }) =>
    $active ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(148, 163, 184, 0.06)"};
  color: ${({ $active }) => ($active ? "#fff" : "var(--text)")};
  border-radius: 10px;
  height: 32px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
`;

const CalendarButton = styled.button`
  border: 1px solid var(--orders-container-border);
  border-radius: 12px;
  width: 100%;
  padding: 11px 13px;
  background: var(--surface);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
`;

const CalendarPopover = styled.div`
  position: absolute;
  z-index: 30;
  left: 0;
  right: 0;
  ${({ $openUp }) =>
    $openUp
      ? `
    bottom: calc(100% + 8px);
    top: auto;
  `
      : `
    top: calc(100% + 8px);
    bottom: auto;
  `}
  border: 1px solid var(--orders-container-border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 16px 30px rgba(2, 6, 23, 0.2);
  padding: 10px;
  display: grid;
  gap: 8px;
`;

const CalendarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CalendarNav = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid var(--orders-container-border);
  background: var(--button-overlay);
  color: var(--text);
  cursor: pointer;
`;

const CalendarMonthLabel = styled.span`
  font-size: 13px;
  font-weight: 700;
`;

const CalendarWeekRow = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
`;

const CalendarWeekLabel = styled.span`
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 700;
`;

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
`;

const CalendarDay = styled.button`
  border: 1px solid ${({ $selected }) => ($selected ? "transparent" : "var(--orders-container-border)")};
  background: ${({ $selected }) => ($selected ? "var(--sidebar-orange)" : "transparent")};
  color: ${({ $selected, $outside }) => ($selected ? "#fff" : $outside ? "var(--text-muted)" : "var(--text)")};
  opacity: ${({ $outside }) => ($outside ? 0.72 : 1)};
  border-radius: 10px;
  height: 32px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
`;

const FormError = styled.p`
  margin: 0;
  color: #dc2626;
  font-size: 13px;
`;

const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px 18px;
  border-top: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--surface) 94%, var(--bg) 6%);

  @media (max-width: 600px) {
    padding: 12px 16px 16px;
  }
`;

const SecondaryButton = styled.button`
  border: 1px solid var(--orders-container-border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  padding: 10px 16px;
  cursor: pointer;
  font-weight: 600;
`;

const AddButton = styled.button`
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 999px;
  background: var(--sidebar-orange);
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
`;

const AddIconButton = styled.button`
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: var(--sidebar-orange);
  color: #ffffff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: filter 0.15s ease, transform 0.12s ease;

  &:hover {
    filter: brightness(1.05);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const PrimaryButton = styled(AddButton)`
  height: auto;
  padding: 10px 18px;
  border-radius: 999px;
  background: var(--sidebar-orange);
  box-shadow: none;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, #0f172a 55%, transparent);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 1200;
  padding: 24px;

  @media (max-width: 600px) {
    padding: 12px;
    align-items: start;
  }
`;

const ModalCard = styled.div`
  width: min(720px, 100%);
  max-height: min(90dvh, 900px);
  overflow: auto;
  ${cardPanel}
  border-color: var(--orders-container-border);
  padding: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);

  @media (max-width: 600px) {
    max-height: 94dvh;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--orders-container-border);

  @media (max-width: 600px) {
    padding: 16px 16px 12px;
  }
`;

const ModalHeading = styled.div`
  display: grid;
  gap: 4px;
  min-width: 0;
`;

const ModalEyebrow = styled.span`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--sidebar-orange);
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--orders-container-border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 18px;
  flex-shrink: 0;
`;

const undoSlideIn = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, 14px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
`;

const undoCountdown = keyframes`
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
`;

const UndoToast = styled.div`
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 1300;
  width: min(360px, calc(100vw - 28px));
  ${cardPanel}
  border-color: var(--orders-container-border);
  padding: 0;
  overflow: hidden;
  box-shadow: 0 18px 44px rgba(2, 6, 23, 0.3);
  animation: ${undoSlideIn} 0.24s ease;
`;

const UndoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px 12px 14px;
`;

const UndoDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--sidebar-orange);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--sidebar-orange) 22%, transparent);
`;

const UndoText = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const UndoButton = styled.button`
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--sidebar-orange);
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  padding: 7px 12px;
  border-radius: 999px;
  transition: background 0.15s ease;

  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--sidebar-orange) 14%, transparent);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const UndoProgressTrack = styled.div`
  height: 3px;
  width: 100%;
  background: color-mix(in srgb, var(--orders-container-border) 55%, transparent);
`;

const UndoProgress = styled.div`
  height: 100%;
  width: 100%;
  transform-origin: left center;
  background: var(--sidebar-orange);
  animation: ${undoCountdown} 5s linear forwards;
`;

export default Reservations;
