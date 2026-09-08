import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { supabase } from "../services/supabase";
import { useRestaurant } from "../context/RestaurantContext";
import { useLanguage } from "../context/LanguageContext";
import { formatCurrency } from "../utils/currency";
import { cardItem, cardPanel } from "../styles/cards";

const LIST_PREVIEW = 5;
const EMPTY_REPORT = { items: [], total: 0, previousTotal: 0 };
const BAR_TRACK_HEIGHT = 132;

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function orderRevenue(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    if (item?.type === "waiter_call") return sum;
    return sum + Number(item?.quantity || 0) * Number(item?.price || 0);
  }, 0);
}

function addSoldItems(map, items) {
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

function rankedSoldItems(map) {
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

function periodBounds(days) {
  const currentEnd = new Date();
  currentEnd.setHours(23, 59, 59, 999);
  const currentStart = startOfDay(new Date());
  currentStart.setDate(currentStart.getDate() - (days - 1));
  const previousStart = startOfDay(new Date(currentStart));
  previousStart.setDate(previousStart.getDate() - days);
  return { currentStart, currentEnd, previousStart };
}

function foldPeriod(orders, currentStart, previousStart) {
  const itemMap = new Map();
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

async function loadPeriodReports(restaurantId) {
  const last7 = periodBounds(7);
  const last30 = periodBounds(30);
  const { data } = await supabase
    .from("orders")
    .select("created_at, items")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", last30.previousStart.toISOString())
    .lte("created_at", last30.currentEnd.toISOString());

  const orders = data ?? [];
  return {
    last7: foldPeriod(orders, last7.currentStart, last7.previousStart),
    last30: foldPeriod(orders, last30.currentStart, last30.previousStart),
  };
}

const IconUtensils = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z" />
    <path d="M21 15v7" />
  </svg>
);

const IconGrid = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconTrend = ({ delta }) => {
  if (delta > 0) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l7-7 4 4 7-7" />
        <path d="M14 7h7v7" />
      </svg>
    );
  }
  if (delta < 0) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7l7 7 4-4 7 7" />
        <path d="M14 17h7v-7" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
};

const Dashboard = () => {
  const { restaurant } = useRestaurant();
  const { t, locale } = useLanguage();
  const currency = restaurant?.currency ?? "USD";

  const [stats, setStats] = useState({
    menuItems: 0,
    tables: 0,
  });
  const [revenueChartSeries, setRevenueChartSeries] = useState({
    labels: [],
    dayNums: [],
    orders: [],
    revenue: [],
  });
  const [ordersChartSeries, setOrdersChartSeries] = useState({
    labels: [],
    dayNums: [],
    orders: [],
    revenue: [],
  });
  const [last7Report, setLast7Report] = useState(EMPTY_REPORT);
  const [last30Report, setLast30Report] = useState(EMPTY_REPORT);
  const [periodDays, setPeriodDays] = useState(7);
  const [periodListExpanded, setPeriodListExpanded] = useState(false);
  const [todayItems, setTodayItems] = useState([]);
  const [todayListExpanded, setTodayListExpanded] = useState(false);
  const [yesterdayTotal, setYesterdayTotal] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedRevenueDay, setSelectedRevenueDay] = useState(null);
  const [selectedOrdersDay, setSelectedOrdersDay] = useState(null);

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

  const formatDateKey = (value) => {
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

    loadStats();
  }, [restaurant?.id]);

  const loadChartData = async (range, setChartSeries) => {
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

    const dateKeys = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      dateKeys.push(formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const ordersMap = Object.fromEntries(dateKeys.map((key) => [key, 0]));
    const revenueMap = Object.fromEntries(dateKeys.map((key) => [key, 0]));

    (data ?? []).forEach((order) => {
      const key = formatDateKey(order.created_at);
      if (!(key in ordersMap)) ordersMap[key] = 0;
      if (!(key in revenueMap)) revenueMap[key] = 0;
      ordersMap[key] += 1;
      revenueMap[key] += orderRevenue(order.items);
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
    loadChartData(range, setRevenueChartSeries);
    loadChartData(range, setOrdersChartSeries);
  }, [restaurant?.id, weekOffset, locale]);

  useEffect(() => {
    const loadPeriodItems = async () => {
      if (!restaurant?.id) return;
      const reports = await loadPeriodReports(restaurant.id);
      setLast7Report(reports.last7);
      setLast30Report(reports.last30);
    };

    loadPeriodItems();
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

      const itemMap = new Map();
      let previousSum = 0;
      (data ?? []).forEach((order) => {
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

    loadTodayItems();
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
    const startText = start.toLocaleDateString(locale, { month: "short", day: "numeric" });
    const endText = end.toLocaleDateString(locale, { month: "short", day: "numeric" });
    return `${startText} - ${endText}`;
  }, [weekOffset, locale]);

  const chartTodayIndex = useMemo(() => {
    if (weekOffset !== 0) return -1;
    const { start } = getWeekRange(0);
    const diff = Math.round(
      (startOfDay(new Date()).getTime() - start.getTime()) / 86_400_000
    );
    return diff >= 0 && diff <= 6 ? diff : -1;
  }, [weekOffset]);

  const formatFullRevenue = (value) =>
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
      ? t(isSelectedToday ? "vsYesterdayMore" : "vsPreviousMore", {
          amount: formatCurrency(vsYesterday, currency, locale),
        })
      : vsYesterday < 0
        ? t(isSelectedToday ? "vsYesterdayLess" : "vsPreviousLess", {
            amount: formatCurrency(Math.abs(vsYesterday), currency, locale),
          })
        : t(isSelectedToday ? "vsYesterdaySame" : "vsPreviousSame");
  const selectedDayLabel = isSelectedToday
    ? t("today")
    : selectedDay.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  const applySelectedDay = (date) => {
    if (!date || Number.isNaN(date.valueOf())) return;
    const next = startOfDay(date);
    const today = startOfDay(new Date());
    setSelectedDay(next > today ? today : next);
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
      ? t(periodDays === 7 ? "vsPrevious7More" : "vsPrevious30More", {
          amount: formatCurrency(vsPeriod, currency, locale),
        })
      : vsPeriod < 0
        ? t(periodDays === 7 ? "vsPrevious7Less" : "vsPrevious30Less", {
            amount: formatCurrency(Math.abs(vsPeriod), currency, locale),
          })
        : t(periodDays === 7 ? "vsPrevious7Same" : "vsPrevious30Same");
  const vsPeriodColor = vsPeriod > 0 ? "#16a34a" : vsPeriod < 0 ? "#dc2626" : "var(--analytics-text)";

  const selectPeriodDays = (days) => {
    setPeriodDays(days);
    setPeriodListExpanded(false);
  };

  const renderDelta = (delta, label, color) => (
    <DeltaRow $color={color}>
      <IconTrend delta={delta} />
      <DeltaText>{label}</DeltaText>
    </DeltaRow>
  );

  const renderRankedList = (items, visible, canExpand, expanded, onToggle, emptyKey) => {
    if (items.length === 0) {
      return <EmptyState>{t(emptyKey)}</EmptyState>;
    }
    return (
      <BestSellingList>
        {visible.map((item, index) => (
          <BestSellingRow key={`${item.name}-${index}`}>
            <BestSellingLeft>
              <RankBadge $first={index === 0}>{index + 1}</RankBadge>
              <BestSellingName title={item.name}>{item.name}</BestSellingName>
            </BestSellingLeft>
            <BestSellingRight>
              <BestSellingQty>{t("timesCount", { n: item.quantity })}</BestSellingQty>
              <BestSellingRevenue>
                {formatCurrency(item.revenue, currency, locale)}
              </BestSellingRevenue>
            </BestSellingRight>
          </BestSellingRow>
        ))}
        {canExpand ? (
          <ShowMoreBtn type="button" onClick={onToggle}>
            {expanded ? t("showLess") : t("showMore")}
          </ShowMoreBtn>
        ) : null}
      </BestSellingList>
    );
  };

  const renderBars = ({ values, labels, dayNums, selected, onSelect, accent, max, formatValue }) => {
    if (!labels.length) {
      return <EmptyState>{t("noData")}</EmptyState>;
    }
    const peakIndex = values.reduce(
      (best, value, index) => (value > values[best] ? index : best),
      0
    );
    const activeIndex = selected ?? (chartTodayIndex >= 0 ? chartTodayIndex : peakIndex);

    return (
      <>
        <ChartPlot>
          <ChartGrid>
            <ChartGridLine />
            <ChartGridLine />
            <ChartGridLine $baseline />
          </ChartGrid>
          <BarContainer>
            {values.map((value, index) => {
              const isSelected = index === activeIndex;
              const isToday = index === chartTodayIndex;
              const showValue = isSelected && value > 0;
              const height =
                value <= 0 ? 0 : Math.max(8, Math.round((value / max) * BAR_TRACK_HEIGHT));
              return (
                <BarWrapper
                  key={`${labels[index]}-${index}`}
                  type="button"
                  onClick={() => onSelect(index)}
                >
                  <BarValueSlot>
                    {showValue ? <BarValue title={formatValue(value)}>{formatValue(value)}</BarValue> : null}
                  </BarValueSlot>
                  <BarWell $active={isSelected} $accent={accent}>
                    {height > 0 ? (
                      <BarFill $height={height} $dimmed={!isSelected} $accent={accent} />
                    ) : (
                      <BarEmptyTick $today={isToday} $accent={accent} />
                    )}
                  </BarWell>
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
                <BarLabel $strong={isSelected || isToday}>{labels[index]}</BarLabel>
                <BarDayNum $today={isToday} $accent={accent}>
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
      label: t("statsMenuItems"),
      value: stats.menuItems,
      ink: "#ff6600",
      icon: <IconUtensils />,
    },
    {
      key: "tables",
      label: t("statsTables"),
      value: stats.tables,
      ink: "#0284c7",
      icon: <IconGrid />,
    },
  ];

  return (
    <Page>
      <KpiRow>
        {statCards.map((card) => (
          <KpiCard key={card.key}>
            <KpiIcon $ink={card.ink}>{card.icon}</KpiIcon>
            <KpiCopy>
              <KpiValue>{card.value}</KpiValue>
              <KpiLabel>{card.label}</KpiLabel>
            </KpiCopy>
          </KpiCard>
        ))}
      </KpiRow>

      <WeekBar>
        <WeekBarLabel>{t("thisWeek")}</WeekBarLabel>
        <WeekNavigator>
          <WeekArrowButton
            type="button"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            aria-label={t("previousWeek")}
          >
            <span aria-hidden="true">◀</span>
          </WeekArrowButton>
          <WeekLabel>{weekLabel}</WeekLabel>
          <WeekArrowButton
            type="button"
            onClick={() => setWeekOffset((prev) => Math.min(prev + 1, 0))}
            aria-label={t("nextWeek")}
            disabled={weekOffset === 0}
          >
            <span aria-hidden="true">▶</span>
          </WeekArrowButton>
        </WeekNavigator>
      </WeekBar>

      <Charts>
        <ChartCard>
          <ChartHeader>
            <ChartEyebrow>{t("revenue")}</ChartEyebrow>
            <ChartMetric>{formatCurrency(totalRevenue, currency, locale)}</ChartMetric>
          </ChartHeader>
          <ChartBody>
            {renderBars({
              values: revenueChartSeries.revenue,
              labels: revenueChartSeries.labels,
              dayNums: revenueChartSeries.dayNums,
              selected: selectedRevenueDay,
              onSelect: setSelectedRevenueDay,
              accent: "orange",
              max: maxRevenue,
              formatValue: formatFullRevenue,
            })}
          </ChartBody>
        </ChartCard>
        <ChartCard>
          <ChartHeader>
            <ChartEyebrow>{t("ordersCount")}</ChartEyebrow>
            <ChartMetric>{totalOrders}</ChartMetric>
          </ChartHeader>
          <ChartBody>
            {renderBars({
              values: ordersChartSeries.orders,
              labels: ordersChartSeries.labels,
              dayNums: ordersChartSeries.dayNums,
              selected: selectedOrdersDay,
              onSelect: setSelectedOrdersDay,
              accent: "green",
              max: maxOrders,
              formatValue: (value) => String(value),
            })}
          </ChartBody>
        </ChartCard>
      </Charts>

      <Panel>
        <PanelHeader>
          <ChartTitleBlock>
            <ChartEyebrow>{isSelectedToday ? t("orderedToday") : t("orderedDay")}</ChartEyebrow>
            <ChartMetric>{formatCurrency(todayTotal, currency, locale)}</ChartMetric>
            {renderDelta(
              vsYesterday,
              vsDeltaLabel,
              vsYesterday > 0 ? "#16a34a" : vsYesterday < 0 ? "#dc2626" : "var(--analytics-text)"
            )}
          </ChartTitleBlock>
          <DateChip>
            <DateChipLabel>{selectedDayLabel}</DateChipLabel>
            <DateInput
              type="date"
              max={formatDateKey(new Date())}
              value={formatDateKey(selectedDay)}
              onChange={(event) => {
                if (!event.target.value) return;
                applySelectedDay(new Date(`${event.target.value}T00:00:00`));
              }}
              aria-label={t("pickDate")}
            />
          </DateChip>
        </PanelHeader>
        {renderRankedList(
          todayItems,
          visibleTodayItems,
          canExpandTodayList,
          todayListExpanded,
          () => setTodayListExpanded((prev) => !prev),
          isSelectedToday ? "noOrdersToday" : "noOrdersOnDay"
        )}
      </Panel>

      <Panel>
        <PanelHeader $align="center">
          <PeriodCardTitle>
            {t(periodDays === 7 ? "ordersInLast7" : "ordersInLast30")}
          </PeriodCardTitle>
          <PeriodSwitch>
            {[7, 30].map((days) => {
              const active = periodDays === days;
              return (
                <PeriodSwitchBtn
                  key={days}
                  type="button"
                  $active={active}
                  onClick={() => selectPeriodDays(days)}
                  aria-pressed={active}
                >
                  {t(days === 7 ? "period7Days" : "period30Days")}
                </PeriodSwitchBtn>
              );
            })}
          </PeriodSwitch>
        </PanelHeader>
        <PeriodSummary>
          <ChartMetric>{formatCurrency(periodReport.total, currency, locale)}</ChartMetric>
          {renderDelta(vsPeriod, vsPeriodLabel, vsPeriodColor)}
        </PeriodSummary>
        {renderRankedList(
          periodReport.items,
          visiblePeriodItems,
          canExpandPeriodList,
          periodListExpanded,
          () => setPeriodListExpanded((prev) => !prev),
          "noOrdersPeriod"
        )}
      </Panel>
    </Page>
  );
};

const Page = styled.div`
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
`;

const KpiRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  @media (max-width: 480px) {
    gap: 10px;
  }
`;

const KpiCard = styled.div`
  ${cardPanel}
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
`;

const KpiIcon = styled.span`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: ${({ $ink }) => $ink};
  background: ${({ $ink }) => `${$ink}18`};
`;

const KpiCopy = styled.div`
  min-width: 0;
`;

const KpiValue = styled.p`
  margin: 0;
  font-size: 26px;
  line-height: 1.1;
  font-weight: 700;
  color: var(--analytics-text);
`;

const KpiLabel = styled.p`
  margin: 4px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--analytics-text);
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const WeekBar = styled.div`
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  @media (max-width: 560px) {
    flex-wrap: wrap;
  }
`;

const WeekBarLabel = styled.p`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--analytics-text);
`;

const WeekNavigator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface-2);
  padding: 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--container-border);
`;

const WeekArrowButton = styled.button`
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--analytics-text);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, opacity 0.2s ease;
  opacity: 0.9;

  &:hover {
    opacity: 1;
    background: var(--container-border-subtle);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const WeekLabel = styled.span`
  min-width: 132px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--analytics-text);

  @media (max-width: 480px) {
    min-width: 92px;
  }
`;

const Charts = styled.div`
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 24px;
  align-content: start;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

const ChartCard = styled.div`
  ${cardPanel}
  padding: 22px 22px 16px;
  min-height: 0;
  display: flex;
  flex-direction: column;

  @media (max-width: 600px) {
    padding: 16px;
  }
`;

const ChartHeader = styled.div`
  margin-bottom: 12px;
`;

const ChartEyebrow = styled.p`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--analytics-text);
  opacity: 0.7;
`;

const ChartMetric = styled.p`
  margin: 4px 0 0;
  font-size: 24px;
  line-height: 1.15;
  font-weight: 700;
  color: var(--analytics-text);
  white-space: nowrap;
`;

const ChartBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ChartPlot = styled.div`
  position: relative;
  height: ${BAR_TRACK_HEIGHT + 28}px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--analytics-text) 3%, transparent);
  overflow: hidden;
`;

const ChartGrid = styled.div`
  position: absolute;
  inset: 28px 12px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
`;

const ChartGridLine = styled.div`
  height: 1px;
  background: ${({ $baseline }) =>
    $baseline
      ? "color-mix(in srgb, var(--analytics-text) 14%, transparent)"
      : "color-mix(in srgb, var(--analytics-text) 7%, transparent)"};
`;

const BarContainer = styled.div`
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  align-items: stretch;
  padding: 0 10px;
`;

const BarWrapper = styled.button`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 0;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
`;

const BarValueSlot = styled.span`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 24px;
  width: 100%;
  margin-bottom: 4px;
`;

const BarValue = styled.span`
  max-width: 100%;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: var(--analytics-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
`;

const BarWell = styled.span`
  width: 22px;
  height: ${BAR_TRACK_HEIGHT}px;
  border-radius: 10px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: ${({ $active, $accent }) =>
    $active
      ? $accent === "green"
        ? "rgba(22, 163, 74, 0.08)"
        : "rgba(255, 102, 0, 0.08)"
      : "color-mix(in srgb, var(--analytics-text) 4.5%, transparent)"};

  @media (min-width: 900px) {
    width: 26px;
  }
`;

const BarFill = styled.span`
  display: block;
  width: 100%;
  height: ${({ $height }) => $height}px;
  border-radius: 10px;
  opacity: ${({ $dimmed }) => ($dimmed ? 0.38 : 1)};
  background: ${({ $accent }) =>
    $accent === "green"
      ? "linear-gradient(180deg, #86efac 0%, #16a34a 100%)"
      : "linear-gradient(180deg, #ffb067 0%, #ff6600 100%)"};
`;

const BarEmptyTick = styled.span`
  display: block;
  width: 100%;
  height: 3px;
  border-radius: 999px;
  background: ${({ $today, $accent }) =>
    $today
      ? $accent === "green"
        ? "#16a34a"
        : "#ff6600"
      : "color-mix(in srgb, var(--analytics-text) 16%, transparent)"};
`;

const BarLabelRow = styled.div`
  display: flex;
  padding: 0 10px;
`;

const BarLabelBlock = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
`;

const BarLabel = styled.span`
  font-size: 11px;
  font-weight: ${({ $strong }) => ($strong ? 800 : 600)};
  color: var(--analytics-text);
  opacity: ${({ $strong }) => ($strong ? 1 : 0.7)};
  white-space: nowrap;
`;

const BarDayNum = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${({ $today, $accent }) =>
    $today ? ($accent === "green" ? "#16a34a" : "#ff6600") : "var(--analytics-text)"};
  opacity: ${({ $today }) => ($today ? 1 : 0.65)};
`;

const Panel = styled.div`
  margin-top: 24px;
  ${cardPanel}
  padding: 22px;

  @media (max-width: 600px) {
    margin-top: 18px;
    padding: 16px;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: ${({ $align }) => $align || "flex-start"};
  gap: 12px;
  margin-bottom: 12px;

  @media (max-width: 640px) {
    flex-wrap: wrap;
  }
`;

const ChartTitleBlock = styled.div`
  min-width: 0;
`;

const DateChip = styled.label`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--container-border);
  border-radius: 999px;
  padding: 6px 12px;
  background: color-mix(in srgb, var(--analytics-text) 3%, transparent);
  cursor: pointer;
  flex-shrink: 0;
`;

const DateChipLabel = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: var(--analytics-text);
`;

const DateInput = styled.input`
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
  border: none;
`;

const PeriodCardTitle = styled.h3`
  margin: 0;
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--analytics-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PeriodSwitch = styled.div`
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid var(--container-border);
  background: color-mix(in srgb, var(--analytics-text) 3%, transparent);
  flex-shrink: 0;
`;

const PeriodSwitchBtn = styled.button`
  border: none;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  color: ${({ $active }) => ($active ? "#fff" : "var(--analytics-text)")};
  background: ${({ $active }) => ($active ? "var(--sidebar-orange)" : "transparent")};
  opacity: ${({ $active }) => ($active ? 1 : 0.7)};
`;

const PeriodSummary = styled.div`
  margin: 0 0 12px;
`;

const DeltaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: ${({ $color }) => $color};
  opacity: ${({ $color }) => ($color === "var(--analytics-text)" ? 0.7 : 1)};
`;

const DeltaText = styled.span`
  font-size: 13px;
  font-weight: 600;
`;

const EmptyState = styled.p`
  margin: 0;
  padding: 20px 0;
  text-align: center;
  color: var(--analytics-text);
  opacity: 0.7;
`;

const BestSellingList = styled.div`
  ${cardItem}
  overflow: hidden;
`;

const BestSellingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--primary) 16%, var(--container-border-subtle));

  &:last-child {
    border-bottom: none;
  }
`;

const BestSellingLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
`;

const RankBadge = styled.span`
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  color: ${({ $first }) => ($first ? "var(--sidebar-orange)" : "var(--analytics-text)")};
  background: ${({ $first }) =>
    $first
      ? "color-mix(in srgb, var(--sidebar-orange) 16%, transparent)"
      : "color-mix(in srgb, var(--analytics-text) 6%, transparent)"};
  opacity: ${({ $first }) => ($first ? 1 : 0.75)};
`;

const BestSellingName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--analytics-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const BestSellingRight = styled.div`
  display: grid;
  justify-items: end;
  gap: 2px;
`;

const BestSellingQty = styled.span`
  font-size: 12px;
  color: var(--analytics-text);
  opacity: 0.75;
`;

const BestSellingRevenue = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: var(--analytics-text);
`;

const ShowMoreBtn = styled.button`
  width: 100%;
  border: none;
  background: transparent;
  padding: 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--sidebar-orange);
  cursor: pointer;

  &:hover {
    opacity: 0.85;
  }
`;

export default Dashboard;
