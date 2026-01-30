import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { supabase } from "../services/supabase";
import { useRestaurant } from "../context/RestaurantContext";

const Dashboard = () => {
  const { restaurant } = useRestaurant();
  const [stats, setStats] = useState({
    categories: 0,
    menuItems: 0,
    tables: 0,
    orders: 0
  });
  const [chartSeries, setChartSeries] = useState({
    labels: [],
    orders: [],
    revenue: []
  });
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return {
      start: start.toISOString().slice(0, 10),
      end: today.toISOString().slice(0, 10)
    };
  });

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

  const formatCurrency = (value) => `$${value.toFixed(2)}`;

  const formatDateKey = (value) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const loadSeries = async () => {
      if (!restaurant?.id) return;
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) return;

      if (startDate > endDate) {
        const corrected = formatDateKey(startDate);
        setDateRange((prev) => ({ ...prev, end: corrected }));
        return;
      }

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
          return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        }),
        orders: dateKeys.map((key) => ordersMap[key] || 0),
        revenue: dateKeys.map((key) => revenueMap[key] || 0)
      });
    };

    loadSeries();
  }, [restaurant, dateRange]);

  const chartMeta = useMemo(() => {
    if (!chartSeries.labels.length) return "No data";
    return `${chartSeries.labels[0]} – ${chartSeries.labels[chartSeries.labels.length - 1]}`;
  }, [chartSeries.labels]);

  const totalRevenue = useMemo(
    () => chartSeries.revenue.reduce((sum, value) => sum + value, 0),
    [chartSeries.revenue]
  );

  const totalOrders = useMemo(
    () => chartSeries.orders.reduce((sum, value) => sum + value, 0),
    [chartSeries.orders]
  );

  const chartPoints = useMemo(() => {
    const width = 180;
    const height = 80;
    const padding = 6;
    const max = Math.max(...chartSeries.revenue, 1);
    const count = chartSeries.revenue.length;
    return chartSeries.revenue.map((value, index) => {
      const x =
        count === 1
          ? width / 2
          : padding + (index * (width - padding * 2)) / (count - 1);
      const y = height - padding - (value / max) * (height - padding * 2);
      return { x, y, value, amount: formatCurrency(value) };
    });
  }, [chartSeries.revenue]);

  const linePath = useMemo(() => {
    if (!chartPoints.length) return "";
    return chartPoints
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
      .join(" ");
  }, [chartPoints]);

  const areaPath = useMemo(() => {
    if (!chartPoints.length) return "";
    const height = 80;
    const padding = 6;
    const last = chartPoints[chartPoints.length - 1];
    return `${linePath} L${last.x} ${height - padding} L${chartPoints[0].x} ${
      height - padding
    } Z`;
  }, [chartPoints, linePath]);

  const revenueTicks = useMemo(() => {
    const max = Math.max(...chartSeries.revenue, 0);
    if (max === 0) return ["$0", "$0", "$0", "$0", "$0"];
    const step = Math.ceil(max / 4);
    return [step * 4, step * 3, step * 2, step, 0].map((value) =>
      formatCurrency(value)
    );
  }, [chartSeries.revenue]);

  const maxOrders = useMemo(
    () => Math.max(...chartSeries.orders, 0),
    [chartSeries.orders]
  );

  return (
    <div>
      <Header>
        <div>
          <Heading>Welcome back</Heading>
          <Subheading>Here is a quick snapshot of your restaurant activity.</Subheading>
        </div>
        <HeaderRight>
          <DatePicker>
            <DateField>
              <label htmlFor="start-date">From</label>
              <input
                id="start-date"
                type="date"
                value={dateRange.start}
                onChange={(event) =>
                  setDateRange((prev) => ({
                    ...prev,
                    start: event.target.value,
                    end:
                      event.target.value > prev.end ? event.target.value : prev.end
                  }))
                }
              />
            </DateField>
            <DateField>
              <label htmlFor="end-date">To</label>
              <input
                id="end-date"
                type="date"
                value={dateRange.end}
                onChange={(event) =>
                  setDateRange((prev) => ({
                    ...prev,
                    end: event.target.value,
                    start:
                      event.target.value < prev.start ? event.target.value : prev.start
                  }))
                }
              />
            </DateField>
          </DatePicker>
          <HighlightCard>
            <HighlightLabel>Range total</HighlightLabel>
            <HighlightValue>{formatCurrency(totalRevenue)}</HighlightValue>
            <HighlightMeta>{totalOrders} orders in range</HighlightMeta>
          </HighlightCard>
        </HeaderRight>
      </Header>
      <Grid>
        <Card $accent="indigo">
          <CardTop>
            <CardLabel>Categories</CardLabel>
            <Chip>+2%</Chip>
          </CardTop>
          <CardValue>{stats.categories}</CardValue>
          <Sparkline>
            <SparklinePath
              d="M2 26 L20 20 L38 22 L56 14 L74 18 L92 10"
              $accent="indigo"
            />
          </Sparkline>
        </Card>
        <Card $accent="sky">
          <CardTop>
            <CardLabel>Menu Items</CardLabel>
            <Chip>+5%</Chip>
          </CardTop>
          <CardValue>{stats.menuItems}</CardValue>
          <Sparkline>
            <SparklinePath
              d="M2 24 L20 26 L38 18 L56 16 L74 22 L92 12"
              $accent="sky"
            />
          </Sparkline>
        </Card>
        <Card $accent="emerald">
          <CardTop>
            <CardLabel>Tables</CardLabel>
            <Chip>Stable</Chip>
          </CardTop>
          <CardValue>{stats.tables}</CardValue>
          <Sparkline>
            <SparklinePath
              d="M2 22 L20 20 L38 20 L56 20 L74 20 L92 20"
              $accent="emerald"
            />
          </Sparkline>
        </Card>
        <Card $accent="rose">
          <CardTop>
            <CardLabel>Total Orders</CardLabel>
            <Chip>+12%</Chip>
          </CardTop>
          <CardValue>{stats.orders}</CardValue>
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
            <ChartTitle>Revenue trend</ChartTitle>
            <ChartMeta>{chartMeta}</ChartMeta>
          </ChartHeader>
          <ChartBody>
            <LineChart>
              <YAxis>
                {revenueTicks.map((value) => (
                  <YAxisTick key={value}>{value}</YAxisTick>
                ))}
              </YAxis>
              <ChartCanvas>
                <defs>
                  <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(129, 140, 248, 0.4)" />
                    <stop offset="100%" stopColor="rgba(129, 140, 248, 0)" />
                  </linearGradient>
                </defs>
                <GridLines>
                  {[10, 26, 42, 58, 74].map((y) => (
                    <line key={y} x1="0" x2="180" y1={y} y2={y} />
                  ))}
                </GridLines>
                <AreaPath d={areaPath} />
                <LinePath d={linePath} />
                <LineGlow d={linePath} />
                {chartPoints.map((point) => (
                  <LinePointGroup key={`${point.x}-${point.y}`}>
                    <LinePoint cx={point.x} cy={point.y} r="3.5" />
                    <LinePointLabel
                      x={point.x}
                      y={Math.max(6, point.y - 10)}
                      textAnchor="middle"
                    >
                      ${point.amount}
                    </LinePointLabel>
                  </LinePointGroup>
                ))}
              </ChartCanvas>
            </LineChart>
            <XAxis>
              {chartSeries.labels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </XAxis>
            <ChartLegend>
              <LegendDot />
              <span>
                {formatCurrency(totalRevenue)} total revenue
              </span>
            </ChartLegend>
          </ChartBody>
        </ChartCard>
        <ChartCard>
          <ChartHeader>
            <ChartTitle>Orders per day</ChartTitle>
            <ChartMeta>{totalOrders} orders</ChartMeta>
          </ChartHeader>
          <ChartBody>
            <Bars>
              {chartSeries.orders.map((value, index) => (
                <Bar
                  key={`${chartSeries.labels[index]}-${value}`}
                  $height={maxOrders ? Math.max((value / maxOrders) * 100, value ? 12 : 4) : 4}
                >
                  <BarValue>{value}</BarValue>
                  <BarTooltip>
                    {formatCurrency(chartSeries.revenue[index] || 0)} · {value} orders
                  </BarTooltip>
                </Bar>
              ))}
            </Bars>
            <XAxis>
              {chartSeries.labels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </XAxis>
            <ChartLegend>
              <LegendDot $accent="emerald" />
              <span>Hover a bar for revenue</span>
            </ChartLegend>
          </ChartBody>
        </ChartCard>
      </Charts>
    </div>
  );
};

const Heading = styled.h1`
  margin: 0 0 6px;
  font-size: 30px;
  font-weight: 600;
`;

const Subheading = styled.p`
  margin: 0;
  color: var(--text-muted);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  margin-bottom: 24px;
  flex-wrap: wrap;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
`;

const DatePicker = styled.div`
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  background: var(--surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
`;

const DateField = styled.div`
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);

  input {
    min-width: 150px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
`;

const Card = styled.div`
  background: linear-gradient(145deg, rgba(21, 31, 54, 0.95), rgba(17, 24, 39, 0.95));
  padding: 22px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
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
        ? "rgba(99, 102, 241, 0.25)"
        : $accent === "sky"
          ? "rgba(56, 189, 248, 0.25)"
          : $accent === "emerald"
            ? "rgba(16, 185, 129, 0.2)"
            : "rgba(244, 63, 94, 0.2)"};
    filter: blur(20px);
  }
`;

const CardLabel = styled.p`
  margin: 0 0 8px;
  color: var(--text-muted);
  font-size: 14px;
`;

const CardValue = styled.p`
  margin: 0;
  font-size: 30px;
  font-weight: 600;
  color: #fff;
`;

const CardTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Chip = styled.span`
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  color: var(--text-soft);
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
      ? "#818cf8"
      : $accent === "sky"
        ? "#38bdf8"
        : $accent === "emerald"
          ? "#34d399"
          : "#fb7185"};
  stroke-width: 2.2;
  stroke-linecap: round;
  opacity: 0.9;
`;

const HighlightCard = styled.div`
  background: linear-gradient(130deg, rgba(99, 102, 241, 0.22), rgba(15, 23, 42, 0.85));
  border: 1px solid rgba(99, 102, 241, 0.35);
  padding: 16px 18px;
  border-radius: var(--radius-md);
  min-width: 200px;
  box-shadow: var(--shadow-sm);
`;

const HighlightLabel = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const HighlightValue = styled.p`
  margin: 6px 0 4px;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
`;

const HighlightMeta = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--text-soft);
`;

const Charts = styled.div`
  margin-top: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
`;

const ChartCard = styled.div`
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: 18px;
  box-shadow: var(--shadow-sm);
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const ChartTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
`;

const ChartMeta = styled.span`
  font-size: 12px;
  color: var(--text-muted);
`;

const ChartBody = styled.div`
  display: grid;
  gap: 12px;
`;

const LineChart = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
`;

const ChartCanvas = styled.svg.attrs({
  viewBox: "0 0 180 80",
  preserveAspectRatio: "none"
})`
  width: 100%;
  height: 120px;
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.12), transparent);
  border-radius: 12px;
  border: 1px solid rgba(99, 102, 241, 0.2);
  padding: 10px;
`;

const LinePath = styled.path`
  fill: none;
  stroke: #818cf8;
  stroke-width: 2.8;
  stroke-linecap: round;
`;

const LineGlow = styled.path`
  fill: none;
  stroke: rgba(129, 140, 248, 0.4);
  stroke-width: 8;
  stroke-linecap: round;
  filter: blur(6px);
`;

const AreaPath = styled.path`
  fill: url(#lineFill);
  opacity: 0.7;
`;

const GridLines = styled.g`
  line {
    stroke: rgba(148, 163, 184, 0.12);
    stroke-dasharray: 4 6;
  }
`;

const LinePointGroup = styled.g`
  cursor: pointer;

  &:hover text {
    opacity: 1;
  }

  &:hover circle {
    r: 5;
  }
`;

const LinePoint = styled.circle`
  fill: #fff;
  stroke: #818cf8;
  stroke-width: 2;
  transition: r 0.2s ease;
`;

const LinePointLabel = styled.text`
  font-size: 10px;
  fill: #e2e8f0;
  opacity: 0;
  transition: opacity 0.2s ease;
  paint-order: stroke;
  stroke: rgba(15, 23, 42, 0.8);
  stroke-width: 3;
`;

const YAxis = styled.div`
  display: grid;
  align-content: space-between;
  height: 120px;
  font-size: 11px;
  color: var(--text-muted);
  text-align: right;
`;

const YAxisTick = styled.span``;

const Bars = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 120px;
`;

const Bar = styled.div`
  flex: 1;
  height: ${({ $height }) => $height}%;
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.6), rgba(34, 197, 94, 0.1));
  border-radius: 999px;
  border: 1px solid rgba(34, 197, 94, 0.35);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 6px;
  position: relative;

  &:hover span[data-tooltip] {
    opacity: 1;
    transform: translateY(-6px);
  }
`;

const BarValue = styled.span`
  font-size: 11px;
  color: #d1fae5;
`;

const BarTooltip = styled.span.attrs({ "data-tooltip": true })`
  position: absolute;
  top: -28px;
  background: rgba(15, 23, 42, 0.9);
  color: #fff;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  opacity: 0;
  transform: translateY(0);
  transition: opacity 0.2s ease, transform 0.2s ease;
  border: 1px solid rgba(148, 163, 184, 0.2);
  white-space: nowrap;
`;

const XAxis = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(40px, 1fr);
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  overflow-x: auto;
  padding-bottom: 4px;
`;

const ChartLegend = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
`;

const LegendDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $accent }) => ($accent === "emerald" ? "#34d399" : "#818cf8")};
`;

export default Dashboard;
