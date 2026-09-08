import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "@/src/services/supabase";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { LinearGradient } from "expo-linear-gradient";
import { formatCurrency } from "@/src/utils/currency";
import { cardShadow } from "@/src/styles/cardShadow";

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

type SoldItem = { name: string; quantity: number; revenue: number };
type PeriodReport = { items: SoldItem[]; total: number; previousTotal: number };

const LIST_PREVIEW = 5;
const EMPTY_REPORT: PeriodReport = { items: [], total: 0, previousTotal: 0 };

type OrderItems = {
  name?: string;
  quantity?: number;
  price?: number;
  type?: string;
}[];

function orderRevenue(items?: OrderItems) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    if (item?.type === "waiter_call") return sum;
    return sum + Number(item?.quantity || 0) * Number(item?.price || 0);
  }, 0);
}

function addSoldItems(map: Map<string, { quantity: number; revenue: number }>, items?: OrderItems) {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  items.forEach((item) => {
    if (item?.type === "waiter_call") return;
    const name = String(item?.name ?? "").trim();
    if (!name) return;
    const quantity = Number(item?.quantity || 0);
    const price = Number(item?.price || 0);
    const revenue = quantity * price;
    total += revenue;
    const existing = map.get(name) ?? { quantity: 0, revenue: 0 };
    existing.quantity += quantity;
    existing.revenue += revenue;
    map.set(name, existing);
  });
  return total;
}

function rankedSoldItems(map: Map<string, { quantity: number; revenue: number }>) {
  return Array.from(map.entries())
    .map(([name, values]) => ({
      name,
      quantity: values.quantity,
      revenue: values.revenue,
    }))
    .sort(
      (a, b) =>
        b.quantity - a.quantity ||
        b.revenue - a.revenue ||
        a.name.localeCompare(b.name)
    );
}

function periodBounds(days: number) {
  const currentEnd = new Date();
  currentEnd.setHours(23, 59, 59, 999);
  const currentStart = startOfDay(new Date());
  currentStart.setDate(currentStart.getDate() - (days - 1));
  const previousStart = startOfDay(new Date(currentStart));
  previousStart.setDate(previousStart.getDate() - days);
  return { currentStart, currentEnd, previousStart };
}

function foldPeriod(
  orders: { created_at: string; items?: OrderItems }[],
  currentStart: Date,
  previousStart: Date
): PeriodReport {
  const itemMap = new Map<string, { quantity: number; revenue: number }>();
  let previousTotal = 0;
  orders.forEach((order) => {
    const created = new Date(order.created_at);
    if (created < previousStart) return;
    if (created < currentStart) {
      previousTotal += orderRevenue(order.items);
      return;
    }
    addSoldItems(itemMap, order.items);
  });
  const items = rankedSoldItems(itemMap);
  return {
    items,
    total: items.reduce((sum, item) => sum + item.revenue, 0),
    previousTotal,
  };
}

async function loadPeriodReports(restaurantId: string) {
  const last7 = periodBounds(7);
  const last30 = periodBounds(30);
  const { data } = await supabase
    .from("orders")
    .select("created_at, items")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", last30.previousStart.toISOString())
    .lte("created_at", last30.currentEnd.toISOString());

  const orders = (data ?? []) as { created_at: string; items?: OrderItems }[];
  return {
    last7: foldPeriod(orders, last7.currentStart, last7.previousStart),
    last30: foldPeriod(orders, last30.currentStart, last30.previousStart),
  };
}

export default function Dashboard() {
  const { restaurant } = useRestaurant();
  const { colors, theme } = useTheme();
  const { t, locale } = useLanguage();
  const isLight = theme === "light";
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;
  const currency = restaurant?.currency ?? "USD";

  const silverBorder = isLight ? "#e0e0e0" : "rgba(192, 192, 192, 0.22)";
  const subtleLine = isLight ? "rgba(28, 25, 23, 0.08)" : colors.containerBorderSubtle;
  const softFill = isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)";
  const softFillStrong = isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)";

  const [stats, setStats] = useState({
    menuItems: 0,
    tables: 0,
  });
  const [revenueChartSeries, setRevenueChartSeries] = useState({
    labels: [] as string[],
    dayNums: [] as string[],
    orders: [] as number[],
    revenue: [] as number[],
  });
  const [ordersChartSeries, setOrdersChartSeries] = useState({
    labels: [] as string[],
    dayNums: [] as string[],
    orders: [] as number[],
    revenue: [] as number[],
  });
  const [last7Report, setLast7Report] = useState<PeriodReport>(EMPTY_REPORT);
  const [last30Report, setLast30Report] = useState<PeriodReport>(EMPTY_REPORT);
  const [periodDays, setPeriodDays] = useState<7 | 30>(7);
  const [periodListExpanded, setPeriodListExpanded] = useState(false);
  const [todayItems, setTodayItems] = useState<SoldItem[]>([]);
  const [todayListExpanded, setTodayListExpanded] = useState(false);
  const [yesterdayTotal, setYesterdayTotal] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedRevenueDay, setSelectedRevenueDay] = useState<number | null>(null);
  const [selectedOrdersDay, setSelectedOrdersDay] = useState<number | null>(null);

  const getWeekRange = (offsetWeeks = 0) => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + offsetWeeks * 7);
    const day = base.getDay();
    const mondayDiff = day === 0 ? -6 : 1 - day;
    const start = new Date(base);
    start.setDate(base.getDate() + mondayDiff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  };

  const formatDateKey = (value: string | Date) => {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const loadStats = async () => {
      if (!restaurant?.id) return;

      const [menuItems, tables] = await Promise.all([
        supabase
          .from("menu_items")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurant.id),
        supabase
          .from("tables")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurant.id),
      ]);

      setStats({
        menuItems: menuItems.count ?? 0,
        tables: tables.count ?? 0,
      });
    };

    void loadStats();
  }, [restaurant?.id]);

  const loadChartData = async (
    range: { start: Date; end: Date },
    setChartSeries: (series: {
      labels: string[];
      dayNums: string[];
      orders: number[];
      revenue: number[];
    }) => void
  ) => {
    if (!restaurant?.id) return;
    const startDate = new Date(range.start);
    const endDate = new Date(range.end);
    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) return;
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from("orders")
      .select("created_at, items")
      .eq("restaurant_id", restaurant.id)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const dateKeys: string[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      dateKeys.push(formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const ordersMap: Record<string, number> = Object.fromEntries(dateKeys.map((key) => [key, 0]));
    const revenueMap: Record<string, number> = Object.fromEntries(dateKeys.map((key) => [key, 0]));

    (data ?? []).forEach((order: { created_at: string; items?: { price?: number; quantity?: number }[] }) => {
      const key = formatDateKey(order.created_at);
      if (!(key in ordersMap)) ordersMap[key] = 0;
      if (!(key in revenueMap)) revenueMap[key] = 0;
      ordersMap[key] += 1;
      const items = Array.isArray(order.items) ? order.items : [];
      const total = items.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      );
      revenueMap[key] += total;
    });

    setChartSeries({
      labels: dateKeys.map((key) => {
        const date = new Date(`${key}T00:00:00`);
        return date.toLocaleDateString(locale, { weekday: "short" });
      }),
      dayNums: dateKeys.map((key) => {
        const date = new Date(`${key}T00:00:00`);
        return String(date.getDate());
      }),
      orders: dateKeys.map((key) => ordersMap[key] || 0),
      revenue: dateKeys.map((key) => revenueMap[key] || 0),
    });
  };

  useEffect(() => {
    const range = getWeekRange(weekOffset);
    setSelectedRevenueDay(null);
    setSelectedOrdersDay(null);
    void loadChartData(range, setRevenueChartSeries);
    void loadChartData(range, setOrdersChartSeries);
  }, [restaurant?.id, weekOffset, locale]);

  useEffect(() => {
    const loadPeriodItems = async () => {
      if (!restaurant?.id) return;
      const reports = await loadPeriodReports(restaurant.id);
      setLast7Report(reports.last7);
      setLast30Report(reports.last30);
    };

    void loadPeriodItems();
  }, [restaurant?.id]);

  useEffect(() => {
    const loadTodayItems = async () => {
      if (!restaurant?.id) return;
      const dayStart = startOfDay(selectedDay);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const prevStart = new Date(dayStart);
      prevStart.setDate(prevStart.getDate() - 1);

      const { data } = await supabase
        .from("orders")
        .select("created_at, items")
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", prevStart.toISOString())
        .lte("created_at", dayEnd.toISOString());

      const itemMap = new Map<string, { quantity: number; revenue: number }>();
      let previousSum = 0;
      (data ?? []).forEach((order: { created_at: string; items?: OrderItems }) => {
        const created = new Date(order.created_at);
        if (created < dayStart) {
          previousSum += orderRevenue(order.items);
          return;
        }
        addSoldItems(itemMap, order.items);
      });

      setYesterdayTotal(previousSum);
      setTodayItems(rankedSoldItems(itemMap));
    };

    void loadTodayItems();
  }, [restaurant?.id, selectedDay]);

  const totalRevenue = useMemo(
    () => revenueChartSeries.revenue.reduce((sum, value) => sum + value, 0),
    [revenueChartSeries.revenue]
  );

  const totalOrders = useMemo(
    () => ordersChartSeries.orders.reduce((sum, value) => sum + value, 0),
    [ordersChartSeries.orders]
  );

  const maxRevenue = useMemo(
    () => Math.max(...revenueChartSeries.revenue, 1),
    [revenueChartSeries.revenue]
  );

  const maxOrders = useMemo(
    () => Math.max(...ordersChartSeries.orders, 1),
    [ordersChartSeries.orders]
  );

  const weekLabel = useMemo(() => {
    const { start, end } = getWeekRange(weekOffset);
    const startText = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endText = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${startText} - ${endText}`;
  }, [weekOffset]);

  const chartTodayIndex = useMemo(() => {
    if (weekOffset !== 0) return -1;
    const { start } = getWeekRange(0);
    const diff = Math.round(
      (startOfDay(new Date()).getTime() - start.getTime()) / 86_400_000
    );
    return diff >= 0 && diff <= 6 ? diff : -1;
  }, [weekOffset]);

  const barTrackHeight = isTablet ? 132 : 112;

  const formatFullRevenue = (value: number) =>
    (Number.isFinite(value) ? value : 0).toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  const visibleTodayItems = todayListExpanded
    ? todayItems
    : todayItems.slice(0, LIST_PREVIEW);
  const canExpandTodayList = todayItems.length > LIST_PREVIEW;
  const todayTotal = useMemo(
    () => todayItems.reduce((sum, item) => sum + item.revenue, 0),
    [todayItems]
  );
  const vsYesterday = todayTotal - yesterdayTotal;
  const isSelectedToday = isSameDay(selectedDay, new Date());
  const vsDeltaLabel =
    vsYesterday > 0
      ? t(isSelectedToday ? "dashVsYesterdayMore" : "dashVsPreviousMore", {
          amount: formatCurrency(vsYesterday, currency),
        })
      : vsYesterday < 0
        ? t(isSelectedToday ? "dashVsYesterdayLess" : "dashVsPreviousLess", {
            amount: formatCurrency(Math.abs(vsYesterday), currency),
          })
        : t(isSelectedToday ? "dashVsYesterdaySame" : "dashVsPreviousSame");
  const selectedDayLabel = isSelectedToday
    ? t("dashToday")
    : selectedDay.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  const applySelectedDay = (date?: Date) => {
    if (!date) return;
    setSelectedDay(startOfDay(date));
    setTodayListExpanded(false);
  };

  const periodReport = periodDays === 7 ? last7Report : last30Report;
  const visiblePeriodItems = periodListExpanded
    ? periodReport.items
    : periodReport.items.slice(0, LIST_PREVIEW);
  const canExpandPeriodList = periodReport.items.length > LIST_PREVIEW;
  const vsPeriod = periodReport.total - periodReport.previousTotal;
  const vsPeriodLabel =
    vsPeriod > 0
      ? t(periodDays === 7 ? "dashVsPrevious7More" : "dashVsPrevious30More", {
          amount: formatCurrency(vsPeriod, currency),
        })
      : vsPeriod < 0
        ? t(periodDays === 7 ? "dashVsPrevious7Less" : "dashVsPrevious30Less", {
            amount: formatCurrency(Math.abs(vsPeriod), currency),
          })
        : t(periodDays === 7 ? "dashVsPrevious7Same" : "dashVsPrevious30Same");
  const vsPeriodColor =
    vsPeriod > 0 ? "#16a34a" : vsPeriod < 0 ? "#dc2626" : colors.textMuted;

  const selectPeriodDays = (days: 7 | 30) => {
    setPeriodDays(days);
    setPeriodListExpanded(false);
  };

  const panelStyle = {
    backgroundColor: colors.surface,
    borderColor: isLight ? "rgba(28, 25, 23, 0.08)" : "rgba(255,255,255,0.08)",
    ...(Platform.OS === "ios" ? cardShadow : { elevation: 0 }),
  };

  const renderWeekNav = () => (
    <WeekNavigator>
      <WeekArrowButton
        onPress={() => setWeekOffset((prev) => prev - 1)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={18} color={colors.text} />
      </WeekArrowButton>
      <WeekRangeText style={{ color: colors.text }} numberOfLines={1}>
        {weekLabel}
      </WeekRangeText>
      <WeekArrowButton
        disabled={weekOffset === 0}
        onPress={() => setWeekOffset((prev) => Math.min(prev + 1, 0))}
        style={{ opacity: weekOffset === 0 ? 0.35 : 1 }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="chevron-forward"
          size={18}
          color={weekOffset === 0 ? colors.textMuted : colors.text}
        />
      </WeekArrowButton>
    </WeekNavigator>
  );

  const renderDelta = (delta: number, label: string, color: string) => (
    <DeltaRow>
      <Ionicons
        name={delta > 0 ? "trending-up" : delta < 0 ? "trending-down" : "remove"}
        size={14}
        color={color}
      />
      <DeltaText style={{ color }}>{label}</DeltaText>
    </DeltaRow>
  );

  const renderRankedList = (
    items: SoldItem[],
    visible: SoldItem[],
    canExpand: boolean,
    expanded: boolean,
    onToggle: () => void,
    emptyKey: string
  ) => {
    if (items.length === 0) {
      return (
        <EmptyChart style={{ color: colors.textMuted, paddingVertical: 20 }}>
          {t(emptyKey)}
        </EmptyChart>
      );
    }
    return (
      <BestSellingList>
        {visible.map((item, index) => (
          <BestSellingRow
            key={`${item.name}-${index}`}
            style={{
              borderBottomWidth:
                index === visible.length - 1 && !canExpand ? 0 : StyleSheet.hairlineWidth,
              borderBottomColor: subtleLine,
            }}
          >
            <BestSellingLeft>
              <RankBadge
                style={{
                  backgroundColor:
                    index === 0 ? colors.primaryMuted : softFillStrong,
                }}
              >
                <RankBadgeText
                  style={{
                    color: index === 0 ? colors.sidebarOrange : colors.textMuted,
                  }}
                >
                  {index + 1}
                </RankBadgeText>
              </RankBadge>
              <BestSellingName style={{ color: colors.text }} numberOfLines={1}>
                {item.name}
              </BestSellingName>
            </BestSellingLeft>
            <BestSellingRight>
              <BestSellingQty style={{ color: colors.textMuted }}>
                {t("dashNTimes", { n: item.quantity })}
              </BestSellingQty>
              <BestSellingRevenue style={{ color: colors.text }}>
                {formatCurrency(item.revenue, currency)}
              </BestSellingRevenue>
            </BestSellingRight>
          </BestSellingRow>
        ))}
        {canExpand ? (
          <ShowAllBtn onPress={onToggle} activeOpacity={0.75}>
            <ShowAllText style={{ color: colors.sidebarOrange }}>
              {expanded ? t("dashShowLess") : t("dashShowAll")}
            </ShowAllText>
          </ShowAllBtn>
        ) : null}
      </BestSellingList>
    );
  };

  const renderBars = ({
    values,
    labels,
    dayNums,
    selected,
    onSelect,
    colors: barColors,
    max,
    formatValue,
  }: {
    values: number[];
    labels: string[];
    dayNums: string[];
    selected: number | null;
    onSelect: (index: number) => void;
    colors: [string, string];
    max: number;
    formatValue: (value: number) => string;
  }) => {
    const peakIndex = values.reduce(
      (best, value, index) => (value > values[best] ? index : best),
      0
    );
    const activeIndex =
      selected ?? (chartTodayIndex >= 0 ? chartTodayIndex : peakIndex);
    const gridColor = isLight ? "rgba(28, 25, 23, 0.06)" : "rgba(255,255,255,0.08)";
    const baselineColor = isLight ? "rgba(28, 25, 23, 0.12)" : "rgba(255,255,255,0.16)";
    const wellColor = isLight ? "rgba(28, 25, 23, 0.045)" : "rgba(255,255,255,0.06)";

    return (
      <>
      <ChartPlot style={{ backgroundColor: softFill }}>
        <ChartGrid pointerEvents="none">
          <ChartGridLine style={{ backgroundColor: gridColor }} />
          <ChartGridLine style={{ backgroundColor: gridColor }} />
          <ChartGridLine style={{ backgroundColor: baselineColor }} />
        </ChartGrid>
        <BarContainer>
          {values.map((value, index) => {
            const isSelected = index === activeIndex;
            const isToday = index === chartTodayIndex;
            const showValue = isSelected && value > 0;
            const dimmed = !isSelected;
            const height =
              value <= 0
                ? 0
                : Math.max(8, Math.round((value / max) * barTrackHeight));
            return (
              <BarWrapper key={`${labels[index]}-${index}`}>
                <BarValueSlot>
                  {showValue ? (
                    <BarValue
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.38}
                      ellipsizeMode="clip"
                      style={{
                        color: colors.text,
                        width: isTablet ? 72 : 56,
                      }}
                    >
                      {formatValue(value)}
                    </BarValue>
                  ) : null}
                </BarValueSlot>
                <Pressable
                  onPress={() => onSelect(index)}
                  style={{
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                >
                  <BarWell
                    style={{
                      height: barTrackHeight,
                      backgroundColor: isSelected
                        ? `${barColors[1]}14`
                        : wellColor,
                      width: isTablet ? 26 : 20,
                    }}
                  >
                    {height > 0 ? (
                      <LinearGradient
                        colors={barColors}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={{
                          width: "100%",
                          height,
                          borderRadius: 10,
                          opacity: dimmed ? 0.38 : 1,
                        }}
                      />
                    ) : (
                      <BarEmptyTick
                        style={{
                          backgroundColor: isToday
                            ? barColors[1]
                            : isLight
                              ? "rgba(28, 25, 23, 0.14)"
                              : "rgba(255,255,255,0.18)",
                        }}
                      />
                    )}
                  </BarWell>
                </Pressable>
              </BarWrapper>
            );
          })}
        </BarContainer>
      </ChartPlot>
      <BarLabelRow>
        {values.map((_, index) => {
          const isSelected = index === activeIndex;
          const isToday = index === chartTodayIndex;
          return (
            <BarLabelBlock key={`label-${labels[index]}-${index}`}>
              <BarLabel
                style={{
                  color: isSelected || isToday ? colors.text : colors.textMuted,
                  fontWeight: isSelected || isToday ? "800" : "600",
                }}
                numberOfLines={1}
              >
                {labels[index]}
              </BarLabel>
              <BarDayNum
                style={{
                  color: isToday ? barColors[1] : colors.textMuted,
                }}
              >
                {dayNums[index]}
              </BarDayNum>
            </BarLabelBlock>
          );
        })}
      </BarLabelRow>
    </>
    );
  };

  const statCards = [
    {
      key: "menuItems",
      label: t("dashMenuItems"),
      value: stats.menuItems,
      icon: "restaurant-outline" as const,
      ink: "#ff6600",
    },
    {
      key: "tables",
      label: t("dashTables"),
      value: stats.tables,
      icon: "grid-outline" as const,
      ink: "#0284c7",
    },
  ];

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      <KpiRow>
        {statCards.map((card) => (
          <KpiCard
            key={card.key}
            style={[panelStyle, { flex: 1 }]}
          >
            <KpiIcon style={{ backgroundColor: `${card.ink}18` }}>
              <Ionicons name={card.icon} size={18} color={card.ink} />
            </KpiIcon>
            <KpiCopy>
              <KpiValue style={{ color: colors.text }}>{card.value}</KpiValue>
              <KpiLabel style={{ color: colors.textMuted }} numberOfLines={1}>
                {card.label}
              </KpiLabel>
            </KpiCopy>
          </KpiCard>
        ))}
      </KpiRow>

      <WeekBar>
        <WeekBarLabel style={{ color: colors.text }}>{t("dashThisWeek")}</WeekBarLabel>
        {renderWeekNav()}
      </WeekBar>

      <Charts>
        <ChartCard
          style={[
            panelStyle,
            { width: isTablet ? "48.8%" : "100%" },
          ]}
        >
          <ChartHeader>
            <ChartTitleBlock>
              <ChartEyebrow style={{ color: colors.textMuted }}>{t("dashRevenue")}</ChartEyebrow>
              <ChartMetric style={{ color: colors.text }}>
                {formatCurrency(totalRevenue, currency)}
              </ChartMetric>
            </ChartTitleBlock>
          </ChartHeader>
          <ChartBody>
            {revenueChartSeries.labels.length > 0 ? (
              renderBars({
                values: revenueChartSeries.revenue,
                labels: revenueChartSeries.labels,
                dayNums: revenueChartSeries.dayNums,
                selected: selectedRevenueDay,
                onSelect: (index) => setSelectedRevenueDay(index),
                colors: isLight
                  ? ["#ffb067", "#ff6600"]
                  : ["#ff9a4d", "#ff6600"],
                max: maxRevenue,
                formatValue: formatFullRevenue,
              })
            ) : (
              <EmptyChart style={{ color: colors.textMuted }}>{t("dashNoData")}</EmptyChart>
            )}
          </ChartBody>
        </ChartCard>

        <ChartCard
          style={[
            panelStyle,
            { width: isTablet ? "48.8%" : "100%" },
          ]}
        >
          <ChartHeader>
            <ChartTitleBlock>
              <ChartEyebrow style={{ color: colors.textMuted }}>{t("dashOrdersLabel")}</ChartEyebrow>
              <ChartMetric style={{ color: colors.text }}>{totalOrders}</ChartMetric>
            </ChartTitleBlock>
          </ChartHeader>
          <ChartBody>
            {ordersChartSeries.labels.length > 0 ? (
              renderBars({
                values: ordersChartSeries.orders,
                labels: ordersChartSeries.labels,
                dayNums: ordersChartSeries.dayNums,
                selected: selectedOrdersDay,
                onSelect: (index) => setSelectedOrdersDay(index),
                colors: isLight
                  ? ["#86efac", "#16a34a"]
                  : ["#4ade80", "#16a34a"],
                max: maxOrders,
                formatValue: (value) => String(value),
              })
            ) : (
              <EmptyChart style={{ color: colors.textMuted }}>{t("dashNoData")}</EmptyChart>
            )}
          </ChartBody>
        </ChartCard>
      </Charts>

      <Panel style={panelStyle}>
        <PanelHeader>
          <ChartTitleBlock>
            <ChartEyebrow style={{ color: colors.textMuted }}>
              {isSelectedToday ? t("dashOrderedToday") : t("dashOrderedDay")}
            </ChartEyebrow>
            <MetricValue style={{ color: colors.text }}>
              {formatCurrency(todayTotal, currency)}
            </MetricValue>
            {renderDelta(
              vsYesterday,
              vsDeltaLabel,
              vsYesterday > 0
                ? "#16a34a"
                : vsYesterday < 0
                  ? "#dc2626"
                  : colors.textMuted
            )}
          </ChartTitleBlock>
          <DateFilterBtn
            onPress={() => setShowDayPicker(true)}
            activeOpacity={0.8}
            style={{ borderColor: silverBorder, backgroundColor: softFill }}
            accessibilityLabel={t("dashPickDate")}
          >
            <Ionicons name="calendar-outline" size={14} color={colors.text} />
            <DateFilterText style={{ color: colors.text }} numberOfLines={1}>
              {selectedDayLabel}
            </DateFilterText>
          </DateFilterBtn>
        </PanelHeader>
        {renderRankedList(
          todayItems,
          visibleTodayItems,
          canExpandTodayList,
          todayListExpanded,
          () => setTodayListExpanded((prev) => !prev),
          isSelectedToday ? "dashNoOrdersToday" : "dashNoOrdersOnDay"
        )}
      </Panel>

      <Panel style={panelStyle}>
        <PanelHeader style={{ alignItems: "center" }}>
          <PeriodCardTitle
            style={{ color: colors.text }}
            numberOfLines={1}
          >
            {t(periodDays === 7 ? "dashOrderedLast7" : "dashOrderedLast30")}
          </PeriodCardTitle>
          <PeriodSwitch style={{ backgroundColor: softFill, borderColor: silverBorder }}>
            {([7, 30] as const).map((days) => {
              const active = periodDays === days;
              return (
                <PeriodSwitchBtn
                  key={days}
                  onPress={() => selectPeriodDays(days)}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: active ? colors.sidebarOrange : "transparent",
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(days === 7 ? "dashPeriod7" : "dashPeriod30")}
                >
                  <PeriodSwitchText
                    style={{ color: active ? "#fff" : colors.textMuted }}
                  >
                    {t(days === 7 ? "dashPeriod7" : "dashPeriod30")}
                  </PeriodSwitchText>
                </PeriodSwitchBtn>
              );
            })}
          </PeriodSwitch>
        </PanelHeader>
        <PeriodSummary>
          <MetricValue
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={{ color: colors.text }}
          >
            {formatCurrency(periodReport.total, currency)}
          </MetricValue>
          {renderDelta(vsPeriod, vsPeriodLabel, vsPeriodColor)}
        </PeriodSummary>
        {renderRankedList(
          periodReport.items,
          visiblePeriodItems,
          canExpandPeriodList,
          periodListExpanded,
          () => setPeriodListExpanded((prev) => !prev),
          "dashNoOrdersPeriod"
        )}
      </Panel>
    </ScrollView>
    {showDayPicker && Platform.OS === "ios" ? (
      <Modal
        transparent
        visible
        animationType="slide"
        onRequestClose={() => setShowDayPicker(false)}
      >
        <DayPickerOverlay>
          <Pressable style={{ flex: 1 }} onPress={() => setShowDayPicker(false)} />
          <DayPickerSheet
            style={{ backgroundColor: colors.surface, borderColor: silverBorder }}
          >
            <DayPickerTitle style={{ color: colors.text }}>
              {t("dashPickDate")}
            </DayPickerTitle>
            <DateTimePicker
              value={selectedDay}
              mode="date"
              display="spinner"
              maximumDate={startOfDay(new Date())}
              themeVariant={theme === "dark" ? "dark" : "light"}
              onValueChange={(_event, date) => applySelectedDay(date)}
              style={{ width: 280, alignSelf: "center" }}
            />
            <DayPickerDone
              onPress={() => setShowDayPicker(false)}
              style={{ backgroundColor: colors.sidebarOrange }}
            >
              <DayPickerDoneText>{t("done")}</DayPickerDoneText>
            </DayPickerDone>
          </DayPickerSheet>
        </DayPickerOverlay>
      </Modal>
    ) : null}
    {showDayPicker && Platform.OS === "android" ? (
      <DateTimePicker
        value={selectedDay}
        mode="date"
        display="calendar"
        maximumDate={startOfDay(new Date())}
        onValueChange={(_event, date) => {
          if (date) applySelectedDay(date);
          setShowDayPicker(false);
        }}
        onDismiss={() => setShowDayPicker(false)}
      />
    ) : null}
    </>
  );
}

const KpiRow = styled.View`
  flex-direction: row;
  gap: 10px;
  margin-bottom: 14px;
`;

const KpiCard = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  border-radius: 18px;
  border-width: 1px;
  padding: 12px 14px;
`;

const KpiIcon = styled.View`
  width: 36px;
  height: 36px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
`;

const KpiCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 1px;
`;

const KpiValue = styled.Text`
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.4px;
  line-height: 26px;
`;

const KpiLabel = styled.Text`
  font-size: 12px;
  font-weight: 600;
`;

const Panel = styled.View`
  border-radius: 20px;
  border-width: 1px;
  padding: 16px;
  margin-bottom: 14px;
`;

const PanelHeader = styled.View`
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
`;

const MetricValue = styled.Text`
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.6px;
  line-height: 32px;
`;

const DeltaRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
`;

const DeltaText = styled.Text`
  flex: 1;
  font-size: 12px;
  font-weight: 600;
`;

const WeekBar = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 2px 4px 10px;
`;

const WeekBarLabel = styled.Text`
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.3px;
`;

const Charts = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 2px;
`;

const ChartCard = styled.View`
  border-radius: 20px;
  border-width: 1px;
  padding: 16px 14px 12px;
  margin-bottom: 12px;
`;

const ChartHeader = styled.View`
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  padding: 0 4px;
`;

const ChartTitleBlock = styled.View`
  gap: 2px;
  flex: 1;
  min-width: 0;
`;

const ChartEyebrow = styled.Text`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
`;

const ChartMetric = styled.Text`
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.4px;
`;

const WeekNavigator = styled.View`
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
`;

const WeekArrowButton = styled.TouchableOpacity`
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
`;

const WeekRangeText = styled.Text`
  font-size: 13px;
  font-weight: 700;
  min-width: 108px;
  text-align: center;
`;

const ChartBody = styled.View`
  min-height: 188px;
`;

const ChartPlot = styled.View`
  position: relative;
  border-radius: 16px;
  padding: 8px 6px 10px;
  overflow: visible;
`;

const ChartGrid = styled.View`
  position: absolute;
  top: 36px;
  left: 12px;
  right: 12px;
  bottom: 10px;
  justify-content: space-between;
`;

const ChartGridLine = styled.View`
  height: ${StyleSheet.hairlineWidth}px;
  width: 100%;
`;

const BarContainer = styled.View`
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2px;
`;

const BarWrapper = styled.View`
  flex: 1;
  align-items: center;
  min-width: 0;
`;

const BarValueSlot = styled.View`
  min-height: 16px;
  width: 100%;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 6px;
  overflow: visible;
  z-index: 2;
`;

const BarWell = styled.View`
  border-radius: 11px;
  overflow: hidden;
  justify-content: flex-end;
`;

const BarEmptyTick = styled.View`
  height: 3px;
  width: 100%;
  border-radius: 99px;
`;

const BarValue = styled.Text`
  font-size: 9px;
  font-weight: 800;
  line-height: 11px;
  width: 100%;
  text-align: center;
`;

const BarLabelRow = styled.View`
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2px;
  padding: 8px 6px 0;
`;

const BarLabelBlock = styled.View`
  flex: 1;
  align-items: center;
  gap: 1px;
  min-width: 0;
`;

const BarLabel = styled.Text`
  font-size: 10px;
  line-height: 12px;
  max-width: 100%;
  text-align: center;
`;

const BarDayNum = styled.Text`
  font-size: 10px;
  font-weight: 700;
  line-height: 12px;
`;

const EmptyChart = styled.Text`
  font-size: 14px;
  text-align: center;
  padding: 28px 12px;
  font-weight: 500;
`;

const PeriodCardTitle = styled.Text`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.1px;
  line-height: 18px;
`;

const PeriodSummary = styled.View`
  margin-bottom: 12px;
  gap: 4px;
`;

const PeriodSwitch = styled.View`
  flex-direction: row;
  align-items: center;
  border-width: 1px;
  border-radius: 999px;
  padding: 3px;
  flex-shrink: 0;
`;

const PeriodSwitchBtn = styled.TouchableOpacity`
  padding: 6px 10px;
  border-radius: 999px;
`;

const PeriodSwitchText = styled.Text`
  font-size: 12px;
  font-weight: 700;
`;

const DateFilterBtn = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  max-width: 48%;
  padding: 8px 12px;
  border-radius: 999px;
  border-width: 1px;
  flex-shrink: 0;
  margin-top: 2px;
`;

const DateFilterText = styled.Text`
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 1;
`;

const DayPickerOverlay = styled.View`
  flex: 1;
  justify-content: flex-end;
  background-color: rgba(15, 14, 13, 0.42);
`;

const DayPickerSheet = styled.View`
  border-top-width: 1px;
  padding: 18px 16px 24px;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  gap: 8px;
`;

const DayPickerTitle = styled.Text`
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.3px;
`;

const DayPickerDone = styled.TouchableOpacity`
  min-height: 48px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
`;

const DayPickerDoneText = styled.Text`
  color: #fff;
  font-size: 15px;
  font-weight: 700;
`;

const BestSellingList = styled.View`
  margin-left: -4px;
  margin-right: -4px;
`;

const BestSellingRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 4px;
`;

const BestSellingLeft = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
`;

const RankBadge = styled.View`
  width: 24px;
  height: 24px;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
`;

const RankBadgeText = styled.Text`
  font-size: 11px;
  font-weight: 800;
`;

const BestSellingName = styled.Text`
  flex: 1;
  font-size: 14px;
  font-weight: 600;
`;

const BestSellingRight = styled.View`
  align-items: flex-end;
  gap: 1px;
`;

const BestSellingQty = styled.Text`
  font-size: 11px;
  font-weight: 600;
`;

const BestSellingRevenue = styled.Text`
  font-size: 13px;
  font-weight: 700;
`;

const ShowAllBtn = styled.TouchableOpacity`
  align-items: center;
  justify-content: center;
  padding: 10px 4px 2px;
`;

const ShowAllText = styled.Text`
  font-size: 13px;
  font-weight: 700;
`;
