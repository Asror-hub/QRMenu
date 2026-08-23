import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { supabase } from "../services/supabase";
import { useRestaurant } from "../context/RestaurantContext";
import { useLanguage } from "../context/LanguageContext";
import { formatCurrency } from "../utils/currency";
import { cardItem, cardPanel } from "../styles/cards";

const getTooltipEdge = (index, total) =>
  index >= total - 2 ? "end" : index <= 1 ? "start" : "center";

const Dashboard = () => {
  const { restaurant } = useRestaurant();
  const { t, locale } = useLanguage();
  const [stats, setStats] = useState({
    categories: 0,
    menuItems: 0,
    tables: 0,
    orders: 0
  });
  const [revenueChartSeries, setRevenueChartSeries] = useState({
    labels: [],
    orders: [],
    revenue: []
  });
  const [ordersChartSeries, setOrdersChartSeries] = useState({
    labels: [],
    orders: [],
    revenue: []
  });
  const [bestSellingItems, setBestSellingItems] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);

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

  useEffect(() => {
    const loadStats = async () => {
      if (!restaurant?.id) return;

      const [categories, menuItems, tables, orders] = await Promise.all([
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id),
        supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id),
        supabase.from("tables").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id)
      ]);

      setStats({
        categories: categories.count ?? 0,
        menuItems: menuItems.count ?? 0,
        tables: tables.count ?? 0,
        orders: orders.count ?? 0
      });
    };

    loadStats();
  }, [restaurant]);

  const currency = restaurant?.currency ?? "USD";

  const formatDateKey = (value) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

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
      const items = Array.isArray(order.items) ? order.items : [];
      const total = items.reduce(
        (sum, item) =>
          sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      );
      revenueMap[key] += total;
    });

    setChartSeries({
      labels: dateKeys.map((key) => {
        const date = new Date(`${key}T00:00:00`);
        return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
      }),
      orders: dateKeys.map((key) => ordersMap[key] || 0),
      revenue: dateKeys.map((key) => revenueMap[key] || 0)
    });
  };

  useEffect(() => {
    const range = getWeekRange(weekOffset);
    loadChartData(range, setRevenueChartSeries);
  }, [restaurant, weekOffset, locale]);

  useEffect(() => {
    const range = getWeekRange(weekOffset);
    loadChartData(range, setOrdersChartSeries);
  }, [restaurant, weekOffset, locale]);

  useEffect(() => {
    const loadBestSellingItems = async () => {
      if (!restaurant?.id) return;
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("orders")
        .select("items")
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      const itemMap = new Map();
      (data ?? []).forEach((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        items.forEach((item) => {
          const name = String(item?.name ?? "").trim();
          if (!name) return;
          const quantity = Number(item?.quantity || 0);
          const price = Number(item?.price || 0);
          const existing = itemMap.get(name) ?? { quantity: 0, revenue: 0 };
          existing.quantity += quantity;
          existing.revenue += quantity * price;
          itemMap.set(name, existing);
        });
      });

      const ranked = Array.from(itemMap.entries())
        .map(([name, values]) => ({
          name,
          quantity: values.quantity,
          revenue: values.revenue
        }))
        .sort((a, b) =>
          b.quantity === a.quantity ? b.revenue - a.revenue : b.quantity - a.quantity
        )
        .slice(0, 8);

      setBestSellingItems(ranked);
    };

    loadBestSellingItems();
  }, [restaurant]);

  const revenueChartMeta = useMemo(() => {
    if (!revenueChartSeries.labels.length) return t("noData");
    return `${revenueChartSeries.labels[0]} – ${revenueChartSeries.labels[revenueChartSeries.labels.length - 1]}`;
  }, [revenueChartSeries.labels, t]);

  const ordersChartMeta = useMemo(() => {
    if (!ordersChartSeries.labels.length) return t("noData");
    return `${ordersChartSeries.labels[0]} – ${ordersChartSeries.labels[ordersChartSeries.labels.length - 1]}`;
  }, [ordersChartSeries.labels, t]);

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

  return (
    <Page>
      <Grid>
        <Card $accent="indigo">
          <CardTop>
            <CardLabel>{t("statsCategories")}</CardLabel>
            <Chip>CT</Chip>
          </CardTop>
          <CardValue>{stats.categories}</CardValue>
          <CardSubtext>{t("menuGroupsConfigured")}</CardSubtext>
          <Sparkline>
            <SparklinePath
              d="M2 26 L20 20 L38 22 L56 14 L74 18 L92 10"
              $accent="indigo"
            />
          </Sparkline>
        </Card>
        <Card $accent="sky">
          <CardTop>
            <CardLabel>{t("statsMenuItems")}</CardLabel>
            <Chip>MI</Chip>
          </CardTop>
          <CardValue>{stats.menuItems}</CardValue>
          <CardSubtext>{t("itemsCurrentlyActive")}</CardSubtext>
          <Sparkline>
            <SparklinePath
              d="M2 24 L20 26 L38 18 L56 16 L74 22 L92 12"
              $accent="sky"
            />
          </Sparkline>
        </Card>
        <Card $accent="emerald">
          <CardTop>
            <CardLabel>{t("statsTables")}</CardLabel>
            <Chip>TB</Chip>
          </CardTop>
          <CardValue>{stats.tables}</CardValue>
          <CardSubtext>{t("diningTablesAvailable")}</CardSubtext>
          <Sparkline>
            <SparklinePath
              d="M2 22 L20 20 L38 20 L56 20 L74 20 L92 20"
              $accent="emerald"
            />
          </Sparkline>
        </Card>
        <Card $accent="rose">
          <CardTop>
            <CardLabel>{t("statsTotalOrders")}</CardLabel>
            <Chip>OR</Chip>
          </CardTop>
          <CardValue>{stats.orders}</CardValue>
          <CardSubtext>{t("allTimeOrderVolume")}</CardSubtext>
          <Sparkline>
            <SparklinePath
              d="M2 28 L20 24 L38 22 L56 16 L74 10 L92 6"
              $accent="rose"
            />
          </Sparkline>
        </Card>
      </Grid>
      <Charts>
        <ChartCard>
          <ChartHeader>
            <ChartTitle>{t("revenueByDay")}</ChartTitle>
            <ChartHeaderRight>
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
            </ChartHeaderRight>
          </ChartHeader>
          <ChartBody>
            <ChartWrapper>
              <YAxisLabels>
                {[4, 3, 2, 1, 0].map((i) => {
                  const val = (maxRevenue / 4) * i;
                  return (
                    <YAxisTick key={i}>
                      {formatCurrency(val, currency)}
                    </YAxisTick>
                  );
                })}
              </YAxisLabels>
              <ColumnsContainer>
                <GridLinesVertical $columns={revenueChartSeries.labels.length}>
                  {revenueChartSeries.labels.map((_, i) => (
                    <div key={i} className="grid-line" />
                  ))}
                </GridLinesVertical>
                <ColumnsInner>
                  {revenueChartSeries.revenue.map((value, index) => (
                    <ColumnGroup key={`revenue-${revenueChartSeries.labels[index]}-${value}`}>
                      <RevenueColumn
                        $height={maxRevenue ? (value / maxRevenue) * 100 : 0}
                        $isEmpty={value === 0}
                      >
                        <ColumnTooltip $edge={getTooltipEdge(index, revenueChartSeries.revenue.length)}>
                          {revenueChartSeries.labels[index]} · {formatCurrency(value, currency)}
                        </ColumnTooltip>
                      </RevenueColumn>
                    </ColumnGroup>
                  ))}
                </ColumnsInner>
              </ColumnsContainer>
            </ChartWrapper>
            <ChartLegend>
              <LegendLeft>
                <LegendDot />
                <span>{revenueChartMeta}</span>
              </LegendLeft>
              <LegendValue>{formatCurrency(totalRevenue, currency)} {t("totalRevenueSuffix")}</LegendValue>
            </ChartLegend>
          </ChartBody>
        </ChartCard>
        <ChartCard>
          <ChartHeader>
            <ChartTitle>{t("ordersPerDay")}</ChartTitle>
            <ChartHeaderRight>
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
            </ChartHeaderRight>
          </ChartHeader>
          <ChartBody>
            <ChartWrapper>
              <YAxisLabels>
                {[4, 3, 2, 1, 0].map((i) => {
                  const val = Math.round((maxOrders / 4) * i);
                  return (
                    <YAxisTick key={i}>
                      {val}
                    </YAxisTick>
                  );
                })}
              </YAxisLabels>
              <ColumnsContainer>
                <GridLinesVertical $columns={ordersChartSeries.labels.length}>
                  {ordersChartSeries.labels.map((_, i) => (
                    <div key={i} className="grid-line" />
                  ))}
                </GridLinesVertical>
                <ColumnsInner>
                  {ordersChartSeries.orders.map((value, index) => (
                    <ColumnGroup key={`orders-${ordersChartSeries.labels[index]}-${value}`}>
                      <OrdersColumn
                        $height={maxOrders ? (value / maxOrders) * 100 : 0}
                        $isEmpty={value === 0}
                      >
                        <ColumnTooltip $edge={getTooltipEdge(index, ordersChartSeries.orders.length)}>
                          {ordersChartSeries.labels[index]} · {value} {t("ordersCountSuffix")}
                        </ColumnTooltip>
                      </OrdersColumn>
                    </ColumnGroup>
                  ))}
                </ColumnsInner>
              </ColumnsContainer>
            </ChartWrapper>
            <ChartLegend>
              <LegendLeft>
                <LegendDot $accent="emerald" />
                <span>{ordersChartMeta}</span>
              </LegendLeft>
              <LegendValue>{totalOrders} {t("ordersTotalSuffix")}</LegendValue>
            </ChartLegend>
          </ChartBody>
        </ChartCard>
      </Charts>
      <BestSellingCard>
        <BestSellingHeader>
          <BestSellingTitle>{t("bestSellingItems")}</BestSellingTitle>
          <BestSellingPeriod>{t("last30Days")}</BestSellingPeriod>
        </BestSellingHeader>
        {bestSellingItems.length === 0 ? (
          <BestSellingEmpty>{t("noItemSales")}</BestSellingEmpty>
        ) : (
          <BestSellingList>
            {bestSellingItems.map((item, index) => (
              <BestSellingRow key={`${item.name}-${index}`}>
                <BestSellingLeft>
                  <BestSellingRank>{index + 1}</BestSellingRank>
                  <BestSellingName title={item.name}>{item.name}</BestSellingName>
                </BestSellingLeft>
                <BestSellingRight>
                  <BestSellingQty>{t("soldCount", { count: item.quantity })}</BestSellingQty>
                  <BestSellingRevenue>{formatCurrency(item.revenue, currency)}</BestSellingRevenue>
                </BestSellingRight>
              </BestSellingRow>
            ))}
          </BestSellingList>
        )}
      </BestSellingCard>
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

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }

  @media (max-width: 480px) {
    gap: 10px;
  }
`;

const Card = styled.div`
  ${cardPanel}
  padding: 22px;
  position: relative;
  overflow: hidden;
  min-height: 160px;

  &::after {
    content: "";
    position: absolute;
    top: -40%;
    right: -30%;
    width: 140px;
    height: 140px;
    background: ${({ $accent }) =>
      $accent === "indigo"
        ? "var(--card-accent-indigo)"
        : $accent === "sky"
          ? "var(--card-accent-sky)"
          : $accent === "emerald"
            ? "var(--card-accent-emerald)"
            : "var(--card-accent-rose)"};
    filter: blur(20px);
  }

  @media (max-width: 600px) {
    padding: 15px;
    min-height: 118px;
  }
`;

const CardLabel = styled.p`
  margin: 0 0 8px;
  color: var(--analytics-text);
  font-size: 13px;
  font-weight: 600;
  opacity: 0.75;
`;

const CardValue = styled.p`
  margin: 0;
  font-size: 34px;
  line-height: 1;
  font-weight: 700;
  color: var(--analytics-text);

  @media (max-width: 600px) {
    font-size: 26px;
  }
`;

const CardSubtext = styled.p`
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--analytics-text);
  opacity: 0.65;
`;

const CardTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Chip = styled.span`
  font-size: 10px;
  letter-spacing: 0.04em;
  padding: 4px 9px;
  border-radius: 999px;
  background: var(--primary-muted);
  color: var(--analytics-text);
  font-weight: 700;
`;

const Sparkline = styled.svg.attrs({
  viewBox: "0 0 94 34",
  preserveAspectRatio: "none"
})`
  width: 100%;
  height: 34px;
  margin-top: 16px;
  overflow: visible;
`;

const SparklinePath = styled.path`
  fill: none;
  stroke: ${({ $accent }) =>
    $accent === "indigo"
        ? "var(--sidebar-orange)"
        : $accent === "sky"
        ? "#38bdf8"
        : $accent === "emerald"
          ? "#34d399"
          : "#fb7185"};
  stroke-width: 2.2;
  stroke-linecap: round;
  opacity: 0.9;
`;

const Charts = styled.div`
  margin-top: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 24px;
  align-content: start;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
    gap: 16px;
    margin-top: 18px;
  }
`;

const ChartCard = styled.div`
  ${cardPanel}
  padding: 24px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: visible;

  @media (max-width: 600px) {
    padding: 16px;
  }
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 16px;

  @media (max-width: 480px) {
    flex-wrap: wrap;
    gap: 10px;
  }
`;

const ChartTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--analytics-text);
`;

const ChartHeaderRight = styled.div`
  margin-left: auto;
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
    color: var(--analytics-text);
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

const ChartBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 0 0 auto;
  min-height: 0;
  padding: 4px 0 0 2px;
  overflow: visible;
`;

const CHART_PLOT_HEIGHT = 180;
const CHART_PLOT_MIN_HEIGHT = 140;

const ChartWrapper = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: stretch;
  height: ${CHART_PLOT_HEIGHT}px;
  min-height: ${CHART_PLOT_MIN_HEIGHT}px;
  flex-shrink: 0;
  min-width: 0;
  overflow: visible;
`;

const YAxisLabels = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  min-width: 52px;
  padding: 14px 8px 6px 4px;
  box-sizing: border-box;
`;

const YAxisTick = styled.span`
  font-size: 11px;
  color: var(--analytics-text);
  opacity: 0.7;
  text-align: right;
  white-space: nowrap;
  line-height: 1;
`;

const ColumnsContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 44px,
    var(--container-border-subtle) 44px,
    var(--container-border-subtle) 45px
  );
  border-radius: var(--radius-sm);
  border: 1px solid var(--container-border);
  overflow: visible;
`;

const GridLinesVertical = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(${({ $columns }) => $columns || 7}, 1fr);
  pointer-events: none;

  .grid-line {
    border-right: 1px dashed var(--container-border-subtle);
  }
  .grid-line:last-child { border-right: none; }
`;

const ColumnsInner = styled.div`
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 14px 20px 6px;
  min-height: 0;
`;

const ColumnGroup = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  min-height: 0;
  height: 100%;
`;

const RevenueColumn = styled.div`
  width: 100%;
  max-width: 48px;
  min-height: ${({ $isEmpty }) => ($isEmpty ? 4 : 6)}px;
  height: ${({ $height }) => Math.max($height, 0)}%;
  background: linear-gradient(180deg, #ff7700 0%, #ff6600 50%, rgba(255, 102, 0, 0.95) 100%);
  border-radius: 8px 8px 0 0;
  border: 1px solid rgba(255, 102, 0, 0.4);
  box-shadow: 0 -2px 12px rgba(255, 102, 0, 0.2);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 6px;
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: scaleY(1.02);
    box-shadow: 0 -4px 20px rgba(255, 102, 0, 0.35);
  }
`;

const OrdersColumn = styled.div`
  width: 100%;
  max-width: 48px;
  min-height: ${({ $isEmpty }) => ($isEmpty ? 4 : 6)}px;
  height: ${({ $height }) => Math.max($height, 0)}%;
  background: linear-gradient(180deg, #22c55e 0%, #16a34a 50%, rgba(22, 163, 74, 0.6) 100%);
  border-radius: 8px 8px 0 0;
  border: 1px solid rgba(34, 197, 94, 0.5);
  box-shadow: 0 -2px 12px rgba(34, 197, 94, 0.25);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 6px;
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: scaleY(1.02);
    box-shadow: 0 -4px 20px rgba(34, 197, 94, 0.35);
  }
`;

const ColumnTooltip = styled.span.attrs({ "data-tooltip": true })`
  position: absolute;
  top: -36px;
  ${({ $edge }) =>
    $edge === "end"
      ? "right: 0; left: auto;"
      : $edge === "start"
        ? "left: 0; right: auto;"
        : "left: 50%;"}
  --tt-x: ${({ $edge }) => ($edge === "end" || $edge === "start" ? "0px" : "-50%")};
  transform: translateX(var(--tt-x)) translateY(0);
  background: var(--tooltip-bg);
  color: var(--tooltip-text);
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  border: 1px solid var(--border);
  white-space: nowrap;
  z-index: 100;
  box-shadow: var(--shadow-sm);
  pointer-events: none;

  ${RevenueColumn}:hover &,
  ${OrdersColumn}:hover & {
    opacity: 1;
    transform: translateX(var(--tt-x)) translateY(-4px);
  }
`;

const ChartLegend = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--analytics-text);
  opacity: 0.75;
  border-top: 1px solid var(--container-border-subtle);
  padding-top: 10px;
  margin-top: 2px;
`;

const LegendDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $accent }) => ($accent === "emerald" ? "#22c55e" : "var(--sidebar-orange)")};
`;

const LegendLeft = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const LegendValue = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: var(--analytics-text);
  white-space: nowrap;
`;

const BestSellingCard = styled.div`
  margin-top: 24px;
  ${cardPanel}
  padding: 22px;

  @media (max-width: 600px) {
    margin-top: 18px;
    padding: 16px;
  }
`;

const BestSellingHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const BestSellingTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--analytics-text);
`;

const BestSellingPeriod = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: var(--analytics-text);
  opacity: 0.8;
  border: 1px solid var(--container-border);
  border-radius: 999px;
  padding: 4px 10px;
`;

const BestSellingEmpty = styled.p`
  margin: 0;
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

const BestSellingRank = styled.span`
  width: 20px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--analytics-text);
  opacity: 0.75;
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

export default Dashboard;
