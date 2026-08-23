import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/services/supabase";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { formatCurrency } from "@/src/utils/currency";

export default function Dashboard() {
  const { restaurant } = useRestaurant();
  const { colors, theme } = useTheme();
  const { t } = useLanguage();
  const isLight = theme === "light";
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;
  const currency = restaurant?.currency ?? "USD";

  const silverBorder = isLight ? "#e0e0e0" : "rgba(192, 192, 192, 0.22)";
  const subtleLine = isLight ? "rgba(28, 25, 23, 0.08)" : colors.containerBorderSubtle;
  const softFill = isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)";
  const softFillStrong = isLight ? "rgba(28, 25, 23, 0.05)" : "rgba(255,255,255,0.08)";

  const [stats, setStats] = useState({
    categories: 0,
    menuItems: 0,
    tables: 0,
    orders: 0,
  });
  const [revenueChartSeries, setRevenueChartSeries] = useState({
    labels: [] as string[],
    orders: [] as number[],
    revenue: [] as number[],
  });
  const [ordersChartSeries, setOrdersChartSeries] = useState({
    labels: [] as string[],
    orders: [] as number[],
    revenue: [] as number[],
  });
  const [bestSellingItems, setBestSellingItems] = useState<
    { name: string; quantity: number; revenue: number }[]
  >([]);
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

      const [categories, menuItems, tables, orders] = await Promise.all([
        supabase
          .from("categories")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurant.id),
        supabase
          .from("menu_items")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurant.id),
        supabase
          .from("tables")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurant.id),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurant.id),
      ]);

      setStats({
        categories: categories.count ?? 0,
        menuItems: menuItems.count ?? 0,
        tables: tables.count ?? 0,
        orders: orders.count ?? 0,
      });
    };

    void loadStats();
  }, [restaurant?.id]);

  const loadChartData = async (
    range: { start: Date; end: Date },
    setChartSeries: (series: { labels: string[]; orders: number[]; revenue: number[] }) => void
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
        return date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
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
  }, [restaurant?.id, weekOffset]);

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

      const itemMap = new Map<string, { quantity: number; revenue: number }>();
      (data ?? []).forEach((order: { items?: { name?: string; quantity?: number; price?: number }[] }) => {
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
          revenue: values.revenue,
        }))
        .sort((a, b) => (b.quantity === a.quantity ? b.revenue - a.revenue : b.quantity - a.quantity))
        .slice(0, 8);

      setBestSellingItems(ranked);
    };

    void loadBestSellingItems();
  }, [restaurant?.id]);

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

  const barHeightScale = isTablet ? 100 : 88;
  const barHeightFloor = isTablet ? 4 : 8;

  const formatRevenueBarValue = (value: number) => {
    const integerDigits = Math.trunc(Math.abs(value)).toString().length;
    if (integerDigits > 6) {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    }
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const panelStyle = {
    backgroundColor: colors.surface,
    borderColor: silverBorder,
  };

  const renderWeekNav = () => (
    <WeekNavigator style={{ backgroundColor: softFill, borderColor: silverBorder }}>
      <WeekArrowButton
        onPress={() => setWeekOffset((prev) => prev - 1)}
        style={{ backgroundColor: colors.bg, borderColor: silverBorder }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="chevron-back" size={14} color={colors.text} />
      </WeekArrowButton>
      <WeekRangeText style={{ color: colors.text }} numberOfLines={1}>
        {weekLabel}
      </WeekRangeText>
      <WeekArrowButton
        disabled={weekOffset === 0}
        onPress={() => setWeekOffset((prev) => Math.min(prev + 1, 0))}
        style={{
          backgroundColor: colors.bg,
          borderColor: silverBorder,
          opacity: weekOffset === 0 ? 0.45 : 1,
        }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons
          name="chevron-forward"
          size={14}
          color={weekOffset === 0 ? colors.textMuted : colors.text}
        />
      </WeekArrowButton>
    </WeekNavigator>
  );

  const statCards = [
    { key: "categories", label: t("dashCategories"), value: stats.categories, sub: t("dashCategoriesSub"), chip: "CT" },
    { key: "menuItems", label: t("dashMenuItems"), value: stats.menuItems, sub: t("dashMenuItemsSub"), chip: "MI" },
    { key: "tables", label: t("dashTables"), value: stats.tables, sub: t("dashTablesSub"), chip: "TB" },
    { key: "orders", label: t("dashOrders"), value: stats.orders, sub: t("dashOrdersSub"), chip: "OR" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Grid>
        {statCards.map((card) => (
          <StatCard
            key={card.key}
            style={[panelStyle, { width: isTablet ? "23.5%" : "48%" }]}
          >
            <StatTop>
              <StatLabel style={{ color: colors.textMuted }}>{card.label}</StatLabel>
              <Chip style={{ backgroundColor: softFillStrong }}>
                <ChipText style={{ color: colors.textMuted }}>{card.chip}</ChipText>
              </Chip>
            </StatTop>
            <StatValue style={{ color: colors.text }}>{card.value}</StatValue>
            <StatSub style={{ color: colors.textMuted }}>{card.sub}</StatSub>
          </StatCard>
        ))}
      </Grid>

      <Charts>
        <ChartCard
          style={[
            panelStyle,
            { width: isTablet ? "49%" : "100%" },
          ]}
        >
          <ChartHeader>
            <ChartTitleBlock>
              <ChartEyebrow style={{ color: colors.textMuted }}>{t("dashRevenue")}</ChartEyebrow>
              <ChartTitle style={{ color: colors.text }}>{t("dashByDay")}</ChartTitle>
            </ChartTitleBlock>
            {renderWeekNav()}
          </ChartHeader>
          <ChartBody>
            {revenueChartSeries.labels.length > 0 ? (
              <BarContainer style={{ borderColor: silverBorder, backgroundColor: softFill }}>
                {revenueChartSeries.revenue.map((value, index) => {
                  const selected = selectedRevenueDay === index;
                  return (
                    <BarWrapper key={`rev-${index}`}>
                      <BarValueSlot>
                        {selected ? (
                          <BarValue style={{ color: colors.text }}>
                            {value > 0 ? formatRevenueBarValue(value) : "—"}
                          </BarValue>
                        ) : null}
                      </BarValueSlot>
                      <Pressable
                        onPress={() =>
                          setSelectedRevenueDay((prev) => (prev === index ? null : index))
                        }
                        style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "flex-end" }}
                      >
                        <BarTrack style={isTablet ? { marginTop: 8 } : undefined}>
                          <Bar
                            style={{
                              height: `${Math.max((value / maxRevenue) * barHeightScale, barHeightFloor)}%`,
                              backgroundColor: selected ? "#ff7700" : colors.sidebarOrange ?? "#ff6600",
                              borderColor: silverBorder,
                              opacity: selected || selectedRevenueDay == null ? 1 : 0.45,
                            }}
                          />
                        </BarTrack>
                      </Pressable>
                      <BarLabel style={{ color: selected ? colors.text : colors.textMuted }}>
                        {revenueChartSeries.labels[index]}
                      </BarLabel>
                    </BarWrapper>
                  );
                })}
              </BarContainer>
            ) : (
              <EmptyChart style={{ color: colors.textMuted }}>{t("dashNoData")}</EmptyChart>
            )}
          </ChartBody>
          <LegendRow>
            <Legend style={{ color: colors.textMuted }}>
              {t("dashTotalRevenue")}: {formatCurrency(totalRevenue, currency)}
            </Legend>
            <LegendPeriodBadge style={{ color: colors.textMuted, borderColor: silverBorder }}>
              {t("dashThisWeek")}
            </LegendPeriodBadge>
          </LegendRow>
        </ChartCard>

        <ChartCard
          style={[
            panelStyle,
            { width: isTablet ? "49%" : "100%" },
          ]}
        >
          <ChartHeader>
            <ChartTitleBlock>
              <ChartEyebrow style={{ color: colors.textMuted }}>{t("dashOrdersLabel")}</ChartEyebrow>
              <ChartTitle style={{ color: colors.text }}>{t("dashPerDay")}</ChartTitle>
            </ChartTitleBlock>
            {renderWeekNav()}
          </ChartHeader>
          <ChartBody>
            {ordersChartSeries.labels.length > 0 ? (
              <BarContainer style={{ borderColor: silverBorder, backgroundColor: softFill }}>
                {ordersChartSeries.orders.map((value, index) => {
                  const selected = selectedOrdersDay === index;
                  return (
                    <BarWrapper key={`ord-${index}`}>
                      <BarValueSlot>
                        {selected ? (
                          <BarValue style={{ color: colors.text }}>
                            {value > 0 ? t("dashNOrders", { n: value }) : "—"}
                          </BarValue>
                        ) : null}
                      </BarValueSlot>
                      <Pressable
                        onPress={() =>
                          setSelectedOrdersDay((prev) => (prev === index ? null : index))
                        }
                        style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "flex-end" }}
                      >
                        <BarTrack style={isTablet ? { marginTop: 8 } : undefined}>
                          <Bar
                            style={{
                              height: `${Math.max((value / maxOrders) * barHeightScale, barHeightFloor)}%`,
                              backgroundColor: selected ? "#16a34a" : "#22c55e",
                              borderColor: silverBorder,
                              opacity: selected || selectedOrdersDay == null ? 1 : 0.45,
                            }}
                          />
                        </BarTrack>
                      </Pressable>
                      <BarLabel style={{ color: selected ? colors.text : colors.textMuted }}>
                        {ordersChartSeries.labels[index]}
                      </BarLabel>
                    </BarWrapper>
                  );
                })}
              </BarContainer>
            ) : (
              <EmptyChart style={{ color: colors.textMuted }}>{t("dashNoData")}</EmptyChart>
            )}
          </ChartBody>
          <LegendRow>
            <Legend style={{ color: colors.textMuted }}>
              {t("dashTotalOrders")}: {totalOrders}
            </Legend>
            <LegendPeriodBadge style={{ color: colors.textMuted, borderColor: silverBorder }}>
              {t("dashThisWeek")}
            </LegendPeriodBadge>
          </LegendRow>
        </ChartCard>
      </Charts>

      <BestSellingCard style={panelStyle}>
        <BestSellingHeader>
          <BestSellingTitle style={{ color: colors.text }}>{t("dashBestSelling")}</BestSellingTitle>
          <LegendPeriodBadge style={{ color: colors.textMuted, borderColor: silverBorder }}>
            {t("dashLast30")}
          </LegendPeriodBadge>
        </BestSellingHeader>
        {bestSellingItems.length === 0 ? (
          <EmptyChart style={{ color: colors.textMuted, paddingVertical: 24 }}>
            {t("dashNoItemSales")}
          </EmptyChart>
        ) : (
          <BestSellingList style={{ borderColor: silverBorder, backgroundColor: softFill }}>
            {bestSellingItems.map((item, index) => (
              <BestSellingRow
                key={`${item.name}-${index}`}
                style={{
                  borderBottomWidth: index === bestSellingItems.length - 1 ? 0 : 1,
                  borderBottomColor: subtleLine,
                }}
              >
                <BestSellingLeft>
                  <BestSellingRank style={{ color: colors.textMuted }}>{index + 1}</BestSellingRank>
                  <BestSellingName style={{ color: colors.text }} numberOfLines={1}>
                    {item.name}
                  </BestSellingName>
                </BestSellingLeft>
                <BestSellingRight>
                  <BestSellingQty style={{ color: colors.textMuted }}>
                    {t("dashNSold", { n: item.quantity })}
                  </BestSellingQty>
                  <BestSellingRevenue style={{ color: colors.text }}>
                    {formatCurrency(item.revenue, currency)}
                  </BestSellingRevenue>
                </BestSellingRight>
              </BestSellingRow>
            ))}
          </BestSellingList>
        )}
      </BestSellingCard>
    </ScrollView>
  );
}

const Grid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const StatCard = styled.View`
  border-radius: 16px;
  border-width: 1px;
  padding: 16px;
  min-height: 118px;
`;

const StatTop = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
`;

const StatLabel = styled.Text`
  font-size: 13px;
  font-weight: 600;
`;

const Chip = styled.View`
  padding: 4px 9px;
  border-radius: 999px;
`;

const ChipText = styled.Text`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.4px;
`;

const StatValue = styled.Text`
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.4px;
  line-height: 34px;
`;

const StatSub = styled.Text`
  font-size: 12px;
  font-weight: 500;
  margin-top: 4px;
`;

const Charts = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
`;

const ChartCard = styled.View`
  border-radius: 16px;
  border-width: 1px;
  padding: 16px;
  margin-bottom: 4px;
`;

const ChartHeader = styled.View`
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
`;

const ChartTitleBlock = styled.View`
  gap: 2px;
  flex: 1;
  min-width: 0;
`;

const ChartEyebrow = styled.Text`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

const ChartTitle = styled.Text`
  font-size: 19px;
  font-weight: 700;
`;

const WeekNavigator = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  border-width: 1px;
  border-radius: 14px;
  padding: 4px;
  flex-shrink: 0;
`;

const WeekArrowButton = styled.TouchableOpacity`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const WeekRangeText = styled.Text`
  font-size: 11px;
  font-weight: 700;
  min-width: 96px;
  max-width: 124px;
  text-align: center;
`;

const ChartBody = styled.View`
  min-height: 176px;
  margin-bottom: 12px;
`;

const BarContainer = styled.View`
  border-width: 1px;
  border-radius: 12px;
  padding: 10px 8px 6px;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  height: 156px;
  gap: 2px;
`;

const BarWrapper = styled.View`
  flex: 1;
  align-items: center;
  height: 100%;
  justify-content: space-between;
  min-width: 0;
`;

const BarValueSlot = styled.View`
  min-height: 22px;
  width: 100%;
  align-items: center;
  justify-content: flex-end;
`;

const BarTrack = styled.View`
  width: 100%;
  max-width: 36px;
  height: 108px;
  justify-content: flex-end;
  padding-bottom: 2px;
  overflow: hidden;
`;

const Bar = styled.View`
  width: 100%;
  max-width: 36px;
  min-height: 4px;
  border-radius: 8px 8px 0 0;
  border-width: 1px;
  align-self: center;
`;

const BarValue = styled.Text`
  font-size: 9px;
  font-weight: 700;
  line-height: 11px;
  max-width: 100%;
  text-align: center;
`;

const BarLabel = styled.Text`
  font-size: 9px;
  margin-top: 4px;
  line-height: 11px;
  max-width: 100%;
  text-align: center;
  font-weight: 600;
`;

const EmptyChart = styled.Text`
  font-size: 14px;
  text-align: center;
  padding: 40px 12px;
  font-weight: 500;
`;

const Legend = styled.Text`
  font-size: 12px;
  opacity: 0.85;
  line-height: 16px;
  flex: 1;
`;

const LegendRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const LegendPeriodBadge = styled.Text`
  font-size: 11px;
  font-weight: 600;
  border-width: 1px;
  border-radius: 999px;
  padding: 4px 10px;
  opacity: 0.9;
`;

const BestSellingCard = styled.View`
  border-radius: 16px;
  border-width: 1px;
  padding: 16px;
  margin-top: 10px;
`;

const BestSellingHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
`;

const BestSellingTitle = styled.Text`
  font-size: 18px;
  font-weight: 700;
`;

const BestSellingList = styled.View`
  border-width: 1px;
  border-radius: 12px;
  overflow: hidden;
`;

const BestSellingRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
`;

const BestSellingLeft = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
`;

const BestSellingRank = styled.Text`
  width: 20px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
`;

const BestSellingName = styled.Text`
  flex: 1;
  font-size: 14px;
  font-weight: 600;
`;

const BestSellingRight = styled.View`
  align-items: flex-end;
  gap: 2px;
`;

const BestSellingQty = styled.Text`
  font-size: 12px;
`;

const BestSellingRevenue = styled.Text`
  font-size: 13px;
  font-weight: 700;
`;
