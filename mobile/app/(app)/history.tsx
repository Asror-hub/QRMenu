import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { supabase } from "@/src/services/supabase";
import { formatCurrency } from "@/src/utils/currency";
import type { Order, OrderItem } from "@/src/context/OrdersContext";

const PAGE_SIZE = 40;

type SourceFilter = "all" | "qr" | "staff";
type DateFilter = "all" | "today" | "yesterday" | "7d" | "30d";
type TranslateFn = (
  key: string,
  vars?: Record<string, string | number | null | undefined>
) => string;

const SOURCE_FILTERS: {
  id: SourceFilter;
  labelKey: string;
  hintKey: string;
  icon: "layers-outline" | "qr-code-outline" | "person-outline";
}[] = [
  {
    id: "all",
    labelKey: "historySourceAll",
    hintKey: "historySourceAllHint",
    icon: "layers-outline",
  },
  {
    id: "qr",
    labelKey: "historySourceQr",
    hintKey: "historySourceQrHint",
    icon: "qr-code-outline",
  },
  {
    id: "staff",
    labelKey: "historySourceStaff",
    hintKey: "historySourceStaffHint",
    icon: "person-outline",
  },
];

const DATE_FILTERS: { id: DateFilter; labelKey: string; hintKey: string }[] = [
  { id: "all", labelKey: "historyDateAny", hintKey: "historyDateAnyHint" },
  { id: "today", labelKey: "historyDateToday", hintKey: "historyDateTodayHint" },
  {
    id: "yesterday",
    labelKey: "historyDateYesterday",
    hintKey: "historyDateYesterdayHint",
  },
  { id: "7d", labelKey: "historyDateLast7", hintKey: "historyDateLast7Hint" },
  { id: "30d", labelKey: "historyDateLast30", hintKey: "historyDateLast30Hint" },
];

function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateFilterBounds(filter: DateFilter): { gte?: string; lt?: string } {
  if (filter === "all") return {};
  const now = new Date();
  const today = startOfLocalDay(now);
  if (filter === "today") {
    return { gte: today.toISOString() };
  }
  if (filter === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { gte: y.toISOString(), lt: today.toISOString() };
  }
  if (filter === "7d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { gte: from.toISOString() };
  }
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return { gte: from.toISOString() };
}


function isWaiterCallOrder(order: Order) {
  return (order.items ?? []).some(
    (i) => (i as OrderItem & { type?: string })?.type === "waiter_call"
  );
}

function orderTitle(order: Order, t: TranslateFn) {
  if (isWaiterCallOrder(order)) return t("historyWaiterRequest");
  return t("ordersOrderNum", { n: order.order_number ?? "—" });
}

function tableLabel(order: Order, t: TranslateFn) {
  const tables = order.tables;
  if (!tables) return t("table");
  const name = tables.table_name?.trim();
  if (name) return `${name} ${tables.table_number ?? ""}`.trim();
  return tables.table_number != null
    ? `${t("table")} ${tables.table_number}`
    : t("table");
}

function getOrderTotal(items: OrderItem[] = []) {
  return items.reduce((sum, item) => {
    if ((item as OrderItem & { type?: string })?.type === "waiter_call") {
      return sum;
    }
    const price = Number(item.price ?? 0) || 0;
    const qty = Number(item.quantity ?? 1) || 1;
    return sum + price * qty;
  }, 0);
}

function formatWhen(iso?: string | null, locale?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale || undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(order: Order, t: TranslateFn) {
  if (isWaiterCallOrder(order)) return t("historyWaiter");
  if (order.source === "staff") return t("historyStaff");
  return t("historyQr");
}

function menuItems(order: Order) {
  return (order.items ?? []).filter(
    (i) => (i as OrderItem & { type?: string })?.type !== "waiter_call"
  );
}

export default function HistoryScreen() {
  const { restaurant } = useRestaurant();
  const { colors, theme } = useTheme();
  const { t, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSplit = width >= 768;
  const isLight = theme === "light";
  const currency = restaurant?.currency ?? "USD";
  const silverBorder = isLight
    ? "rgba(148, 163, 184, 0.32)"
    : "rgba(168, 162, 158, 0.28)";
  const softFill = isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)";
  const softFillStrong = isLight
    ? "rgba(28, 25, 23, 0.05)"
    : "rgba(255,255,255,0.08)";
  const selectedFill = isLight
    ? "rgba(255, 102, 0, 0.08)"
    : "rgba(255, 102, 0, 0.16)";
  const selectedBorder = isLight
    ? "rgba(255, 102, 0, 0.35)"
    : "rgba(255, 102, 0, 0.45)";

  const [orders, setOrders] = useState<Order[]>([]);
  const ordersLenRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const filtersActive = sourceFilter !== "all" || dateFilter !== "all";


  useEffect(() => {
    ordersLenRef.current = orders.length;
  }, [orders.length]);

  const loadHistory = useCallback(
    async (opts?: { reset?: boolean }) => {
      if (!restaurant?.id) {
        setOrders([]);
        setLoading(false);
        setHasMore(false);
        return;
      }

      const reset = opts?.reset ?? false;
      const from = reset ? 0 : ordersLenRef.current;
      const to = from + PAGE_SIZE - 1;

      if (reset) setLoading(true);
      else setLoadingMore(true);

      let q = supabase
        .from("orders")
        .select(
          "id, table_id, status, items, order_number, comment, source, created_at, accepted_at, ready_at, finished_at, archived_at, tables (table_number, table_name)"
        )
        .eq("restaurant_id", restaurant.id)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });

      if (sourceFilter === "staff") {
        q = q.eq("source", "staff");
      } else if (sourceFilter === "qr") {
        q = q.or("source.is.null,source.neq.staff");
      }

      const bounds = dateFilterBounds(dateFilter);
      if (bounds.gte) q = q.gte("archived_at", bounds.gte);
      if (bounds.lt) q = q.lt("archived_at", bounds.lt);

      const { data, error } = await q.range(from, to);

      if (error) {
        console.warn("history load failed", error.message);
        if (reset) setOrders([]);
        setHasMore(false);
      } else {
        const rows = (data as Order[]) ?? [];
        setOrders((prev) => (reset ? rows : [...prev, ...rows]));
        setHasMore(rows.length >= PAGE_SIZE);
      }

      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    },
    [restaurant?.id, sourceFilter, dateFilter]
  );

  useEffect(() => {
    void loadHistory({ reset: true });
  }, [loadHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadHistory({ reset: true });
  }, [loadHistory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = orders;
    // Extra client guard for QR (exclude staff even if source quirks)
    if (sourceFilter === "qr") {
      list = list.filter((o) => o.source !== "staff");
    } else if (sourceFilter === "staff") {
      list = list.filter((o) => o.source === "staff");
    }
    if (!q) return list;
    return list.filter((order) => {
      const title = orderTitle(order, t).toLowerCase();
      const table = tableLabel(order, t).toLowerCase();
      const num = String(order.order_number ?? "");
      const comment = (order.comment ?? "").toLowerCase();
      return (
        title.includes(q) ||
        table.includes(q) ||
        num.includes(q) ||
        comment.includes(q)
      );
    });
  }, [orders, query, sourceFilter, t]);

  useEffect(() => {
    if (!filtered.length) {
      setSelected(null);
      return;
    }
    setSelected((prev) => {
      if (prev && filtered.some((o) => o.id === prev.id)) {
        return filtered.find((o) => o.id === prev.id) ?? prev;
      }
      return isSplit ? filtered[0] : null;
    });
  }, [filtered, isSplit]);

  const renderOrderDetails = (order: Order) => {
    const items = menuItems(order);
    const ink = colors.text;
    const muted = colors.textMuted;
    const orange = colors.sidebarOrange;
    const silver = silverBorder;
    const rowRule = isLight
      ? "rgba(148, 163, 184, 0.22)"
      : "rgba(168, 162, 158, 0.2)";

    return (
      <DetailBody>
        <BoardTop>
          <BoardOverline style={{ color: orange }}>
            {orderTitle(order, t)} · {sourceLabel(order, t)}
          </BoardOverline>
          <BoardTable style={{ color: ink }} numberOfLines={2}>
            {tableLabel(order, t)}
          </BoardTable>
        </BoardTop>

        <StatStrip style={{ borderColor: silver }}>
          <StatCell>
            <StatLabel style={{ color: muted }}>{t("historyArchived")}</StatLabel>
            <StatValue style={{ color: ink }} numberOfLines={2}>
              {formatWhen(order.archived_at, locale)}
            </StatValue>
          </StatCell>
          <StatDivider style={{ backgroundColor: silver }} />
          <StatCell>
            <StatLabel style={{ color: muted }}>{t("historyCreated")}</StatLabel>
            <StatValue style={{ color: ink }} numberOfLines={2}>
              {formatWhen(order.created_at, locale)}
            </StatValue>
          </StatCell>
        </StatStrip>

        {order.comment ? (
          <BoardNote>
            <StatLabel style={{ color: muted }}>{t("note")}</StatLabel>
            <NoteText style={{ color: ink }}>{order.comment}</NoteText>
          </BoardNote>
        ) : null}

        <ItemsCard style={{ borderColor: silver }}>
          <ItemsCardHead style={{ borderBottomColor: rowRule }}>
            <StatLabel style={{ color: muted }}>{t("historyOrderItems")}</StatLabel>
            <ItemsCount style={{ color: muted }}>{items.length}</ItemsCount>
          </ItemsCardHead>

          {items.length === 0 ? (
            <EmptyHint style={{ color: muted, paddingVertical: 18, paddingHorizontal: 14 }}>
              {t("historyNoItemsOnOrder")}
            </EmptyHint>
          ) : (
            items.map((item, idx) => {
              const price = Number(item.price ?? 0) || 0;
              const qty = Number(item.quantity ?? 1) || 1;
              return (
                <View key={`${order.id}-item-${idx}`}>
                  {idx > 0 ? (
                    <ItemRule style={{ backgroundColor: rowRule }} />
                  ) : null}
                  <ItemRow>
                    <QtyBadge>
                      <QtyBadgeText style={{ color: ink }}>×{qty}</QtyBadgeText>
                    </QtyBadge>
                    <ItemName style={{ color: ink }} numberOfLines={2}>
                      {item.name || t("item")}
                    </ItemName>
                    <ItemPrices>
                      {price > 0 && qty > 1 ? (
                        <ItemUnit style={{ color: muted }}>
                          {formatCurrency(price, currency)} {t("each")}
                        </ItemUnit>
                      ) : null}
                      <ItemAmt style={{ color: ink }}>
                        {formatCurrency(price * qty, currency)}
                      </ItemAmt>
                    </ItemPrices>
                  </ItemRow>
                </View>
              );
            })
          )}
        </ItemsCard>

        <BoardTotal style={{ borderColor: silver }}>
          <BoardTotalLabel style={{ color: muted }}>{t("historyOrderTotal")}</BoardTotalLabel>
          <BoardTotalValue style={{ color: ink }}>
            {formatCurrency(getOrderTotal(order.items), currency)}
          </BoardTotalValue>
        </BoardTotal>
      </DetailBody>
    );
  };

  const renderItem = ({ item: order }: { item: Order }) => {
    const total = getOrderTotal(order.items);
    const when = formatWhen(
      order.archived_at || order.finished_at || order.created_at,
      locale
    );
    const isActive = selected?.id === order.id;
    return (
      <HistoryCard
        onPress={() => setSelected(order)}
        activeOpacity={0.88}
        style={{
          borderColor: isActive ? selectedBorder : silverBorder,
          backgroundColor: isActive ? selectedFill : colors.surface,
        }}
      >
        <HistoryCardTop>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <HistoryTitle style={{ color: colors.text }} numberOfLines={1}>
              {orderTitle(order, t)}
            </HistoryTitle>
            <HistoryMeta style={{ color: colors.textMuted }} numberOfLines={1}>
              {tableLabel(order, t)} · {sourceLabel(order, t)}
            </HistoryMeta>
            <HistoryMeta style={{ color: colors.textMuted }} numberOfLines={1}>
              {when}
            </HistoryMeta>
          </View>
          <HistoryTotal style={{ color: colors.sidebarOrange }}>
            {formatCurrency(total, currency)}
          </HistoryTotal>
        </HistoryCardTop>
        {!isSplit ? (
          <HistoryFooter>
            <HistoryChip
              style={{
                backgroundColor: softFillStrong,
                borderColor: silverBorder,
              }}
            >
              <HistoryChipText style={{ color: colors.textMuted }}>
                {t("historyItemsCount", { count: menuItems(order).length })}
              </HistoryChipText>
            </HistoryChip>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </HistoryFooter>
        ) : null}
      </HistoryCard>
    );
  };

  const listPane = (
    <ListPane style={{ backgroundColor: colors.surface, borderColor: silverBorder }}>
      <SearchBar style={{ borderBottomColor: silverBorder }}>
        <SearchRow>
          <SearchField
            style={{
              borderColor: silverBorder,
              backgroundColor: softFill,
              flex: 1,
            }}
          >
            <Ionicons name="search" size={15} color={colors.textMuted} />
            <SearchInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("historySearchPlaceholder")}
              placeholderTextColor={colors.textMuted}
              style={{ color: colors.text }}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={15} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </SearchField>

          <FilterButton
            onPress={() => setFiltersOpen(true)}
            activeOpacity={0.85}
            style={{
              borderColor: filtersActive ? colors.sidebarOrange : silverBorder,
              backgroundColor: filtersActive ? selectedFill : softFill,
            }}
            accessibilityRole="button"
            accessibilityLabel={t("historyOpenFilters")}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={filtersActive ? colors.sidebarOrange : colors.text}
            />
            {filtersActive ? (
              <FilterDot style={{ backgroundColor: colors.sidebarOrange }} />
            ) : null}
          </FilterButton>
        </SearchRow>
      </SearchBar>

      {loading && !orders.length ? (
        <Centered>
          <ActivityIndicator size="large" color={colors.primary} />
        </Centered>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: isSplit ? 10 : 12,
            gap: 8,
            flexGrow: 1,
            paddingBottom: Math.max(insets.bottom, 12) + 8,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={() => {
            if (!loadingMore && hasMore && !query.trim()) {
              void loadHistory({ reset: false });
            }
          }}
          onEndReachedThreshold={0.35}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyWrap>
              <EmptyIcon
                style={{
                  backgroundColor: isLight
                    ? "rgba(255, 102, 0, 0.1)"
                    : "rgba(255, 102, 0, 0.16)",
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={22}
                  color={colors.sidebarOrange}
                />
              </EmptyIcon>
              <EmptyTitle style={{ color: colors.text }}>
                {query.trim() || filtersActive
                  ? t("historyNoMatches")
                  : t("historyNoHistory")}
              </EmptyTitle>
              <EmptyHint style={{ color: colors.textMuted }}>
                {query.trim() || filtersActive
                  ? t("historyTryFilter")
                  : t("historyArchivedAppear")}
              </EmptyHint>
            </EmptyWrap>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 14 }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </ListPane>
  );

  const detailPane = (
    <DetailPane
      style={{
        backgroundColor: colors.surface,
        borderColor: silverBorder,
      }}
    >
      {selected ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: isSplit ? 24 : 18,
            paddingBottom: Math.max(insets.bottom, 16) + 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          {renderOrderDetails(selected)}
        </ScrollView>
      ) : (
        <EmptyDetails>
          <EmptyIcon
            style={{
              backgroundColor: isLight
                ? "rgba(255, 102, 0, 0.1)"
                : "rgba(255, 102, 0, 0.16)",
            }}
          >
            <Ionicons
              name="receipt-outline"
              size={24}
              color={colors.sidebarOrange}
            />
          </EmptyIcon>
          <EmptyTitle style={{ color: colors.text }}>{t("historySelectOrder")}</EmptyTitle>
          <EmptyHint style={{ color: colors.textMuted }}>
            {t("historySelectOrderHint")}
          </EmptyHint>
        </EmptyDetails>
      )}
    </DetailPane>
  );

  return (
    <Screen style={{ backgroundColor: colors.bg }}>
      {isSplit ? (
        <SplitRow>
          <LeftCol>{listPane}</LeftCol>
          <RightCol>{detailPane}</RightCol>
        </SplitRow>
      ) : (
        <>
          <PhoneListWrap>{listPane}</PhoneListWrap>
          <Modal
            visible={!!selected}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setSelected(null)}
          >
            <ModalContainer style={{ backgroundColor: colors.surface }}>
              <ModalHeader
                style={{
                  borderBottomColor: silverBorder,
                  backgroundColor: colors.surface,
                  paddingTop: Math.max(insets.top * 0.2, 10),
                }}
              >
                <ModalTitle style={{ color: colors.text }} numberOfLines={1}>
                  {t("historyOrderDetails")}
                </ModalTitle>
                <CloseBtn
                  onPress={() => setSelected(null)}
                  style={{
                    backgroundColor: "transparent",
                    borderColor: silverBorder,
                  }}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </CloseBtn>
              </ModalHeader>
              {selected ? (
                <ScrollView
                  style={{ flex: 1, backgroundColor: colors.surface }}
                  contentContainerStyle={{
                    padding: 18,
                    paddingBottom: Math.max(insets.bottom, 16) + 20,
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  {renderOrderDetails(selected)}
                </ScrollView>
              ) : null}
            </ModalContainer>
          </Modal>
        </>
      )}

      <Modal
        visible={filtersOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <FilterOverlay>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setFiltersOpen(false)}
          />
          <FilterSheet
            style={{
              backgroundColor: colors.surface,
              borderColor: silverBorder,
              maxWidth: isSplit ? 440 : undefined,
              alignSelf: isSplit ? "center" : "stretch",
              width: isSplit ? "100%" : undefined,
              marginBottom: isSplit ? Math.max(insets.bottom, 24) : 0,
              borderRadius: isSplit ? 22 : 0,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              paddingBottom: Math.max(insets.bottom, 16) + (isSplit ? 8 : 4),
            }}
          >
            <FilterHandleWrap>
              <FilterHandle style={{ backgroundColor: silverBorder }} />
            </FilterHandleWrap>

            <FilterSheetHeader>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <FilterSheetTitle style={{ color: colors.text }}>
                  {t("historyFilterTitle")}
                </FilterSheetTitle>
                <FilterSheetSub style={{ color: colors.textMuted }}>
                  {t(
                    SOURCE_FILTERS.find((f) => f.id === sourceFilter)?.labelKey ??
                      "historySourceAll"
                  )}
                  {" · "}
                  {t(
                    DATE_FILTERS.find((f) => f.id === dateFilter)?.labelKey ??
                      "historyDateAny"
                  )}
                </FilterSheetSub>
              </View>
              {filtersActive ? (
                <FilterResetLink
                  onPress={() => {
                    setSourceFilter("all");
                    setDateFilter("all");
                  }}
                  hitSlop={8}
                >
                  <FilterResetText style={{ color: colors.sidebarOrange }}>
                    {t("reset")}
                  </FilterResetText>
                </FilterResetLink>
              ) : null}
              <CloseBtn
                onPress={() => setFiltersOpen(false)}
                style={{
                  backgroundColor: "transparent",
                  borderColor: silverBorder,
                }}
                accessibilityRole="button"
                accessibilityLabel={t("historyCloseFilters")}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </CloseBtn>
            </FilterSheetHeader>

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 8 }}
            >
              <FilterSection>
                <FilterLabel style={{ color: colors.textMuted }}>
                  {t("historyFilterSource")}
                </FilterLabel>
                <FilterOptionsCard style={{ borderColor: silverBorder }}>
                  {SOURCE_FILTERS.map((f, idx) => {
                    const active = sourceFilter === f.id;
                    return (
                      <View key={f.id}>
                        {idx > 0 ? (
                          <FilterOptionRule
                            style={{ backgroundColor: silverBorder }}
                          />
                        ) : null}
                        <FilterOption
                          onPress={() => setSourceFilter(f.id)}
                          activeOpacity={0.82}
                          style={{
                            backgroundColor: active ? selectedFill : "transparent",
                          }}
                        >
                          <FilterOptionIcon
                            style={{
                              borderColor: active
                                ? colors.sidebarOrange
                                : silverBorder,
                              backgroundColor: colors.surface,
                            }}
                          >
                            <Ionicons
                              name={f.icon}
                              size={18}
                              color={
                                active ? colors.sidebarOrange : colors.textMuted
                              }
                            />
                          </FilterOptionIcon>
                          <FilterOptionCopy>
                            <FilterOptionTitle style={{ color: colors.text }}>
                              {t(f.labelKey)}
                            </FilterOptionTitle>
                            <FilterOptionHint style={{ color: colors.textMuted }}>
                              {t(f.hintKey)}
                            </FilterOptionHint>
                          </FilterOptionCopy>
                          <FilterCheck
                            style={{
                              borderColor: active
                                ? colors.sidebarOrange
                                : silverBorder,
                              backgroundColor: active
                                ? colors.sidebarOrange
                                : "transparent",
                            }}
                          >
                            {active ? (
                              <Ionicons name="checkmark" size={12} color="#fff" />
                            ) : null}
                          </FilterCheck>
                        </FilterOption>
                      </View>
                    );
                  })}
                </FilterOptionsCard>
              </FilterSection>

              <FilterSection>
                <FilterLabel style={{ color: colors.textMuted }}>
                  {t("historyFilterDate")}
                </FilterLabel>
                <FilterOptionsCard style={{ borderColor: silverBorder }}>
                  {DATE_FILTERS.map((f, idx) => {
                    const active = dateFilter === f.id;
                    return (
                      <View key={f.id}>
                        {idx > 0 ? (
                          <FilterOptionRule
                            style={{
                              backgroundColor: silverBorder,
                              marginLeft: 14,
                            }}
                          />
                        ) : null}
                        <FilterOption
                          onPress={() => setDateFilter(f.id)}
                          activeOpacity={0.82}
                          style={{
                            backgroundColor: active ? selectedFill : "transparent",
                          }}
                        >
                          <FilterOptionCopy style={{ paddingLeft: 2 }}>
                            <FilterOptionTitle style={{ color: colors.text }}>
                              {t(f.labelKey)}
                            </FilterOptionTitle>
                            <FilterOptionHint style={{ color: colors.textMuted }}>
                              {t(f.hintKey)}
                            </FilterOptionHint>
                          </FilterOptionCopy>
                          <FilterCheck
                            style={{
                              borderColor: active
                                ? colors.sidebarOrange
                                : silverBorder,
                              backgroundColor: active
                                ? colors.sidebarOrange
                                : "transparent",
                            }}
                          >
                            {active ? (
                              <Ionicons name="checkmark" size={12} color="#fff" />
                            ) : null}
                          </FilterCheck>
                        </FilterOption>
                      </View>
                    );
                  })}
                </FilterOptionsCard>
              </FilterSection>
            </ScrollView>

            <FilterSheetFooter style={{ borderTopColor: silverBorder }}>
              <FilterDoneBtn
                onPress={() => setFiltersOpen(false)}
                activeOpacity={0.9}
                style={{ backgroundColor: colors.sidebarOrange }}
              >
                <FilterDoneText>{t("historyApplyFilters")}</FilterDoneText>
              </FilterDoneBtn>
            </FilterSheetFooter>
          </FilterSheet>
        </FilterOverlay>
      </Modal>
    </Screen>
  );
}

const Screen = styled.View`
  flex: 1;
`;

const SplitRow = styled.View`
  flex: 1;
  flex-direction: row;
  padding: 12px;
  gap: 10px;
`;

const LeftCol = styled.View`
  flex: 0.34;
  min-width: 0;
`;

const RightCol = styled.View`
  flex: 0.66;
  min-width: 0;
`;

const PhoneListWrap = styled.View`
  flex: 1;
  padding: 10px;
`;

const ListPane = styled.View`
  flex: 1;
  border-width: 1px;
  border-radius: 18px;
  overflow: hidden;
`;

const DetailPane = styled.View`
  flex: 1;
  border-width: 1px;
  border-radius: 18px;
  overflow: hidden;
`;

const SearchBar = styled.View`
  padding: 10px;
  border-bottom-width: 1px;
`;

const SearchRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const SearchField = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  border-width: 1px;
  border-radius: 12px;
  padding: 0 10px;
  min-height: 38px;
`;

const SearchInput = styled.TextInput`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  padding-vertical: 8px;
`;

const FilterButton = styled.TouchableOpacity`
  width: 38px;
  height: 38px;
  border-width: 1px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
`;

const FilterDot = styled.View`
  position: absolute;
  top: 7px;
  right: 7px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
`;

const FilterOverlay = styled.View`
  flex: 1;
  background-color: rgba(15, 14, 13, 0.42);
  justify-content: flex-end;
  padding-horizontal: 0px;
`;

const FilterSheet = styled.View`
  border-width: 1px;
  overflow: hidden;
  max-height: 86%;
`;

const FilterHandleWrap = styled.View`
  align-items: center;
  padding-top: 10px;
  padding-bottom: 2px;
`;

const FilterHandle = styled.View`
  width: 40px;
  height: 4px;
  border-radius: 999px;
`;

const FilterSheetHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 18px 14px;
`;

const FilterSheetTitle = styled.Text`
  font-size: 20px;
  font-weight: 900;
  letter-spacing: -0.4px;
`;

const FilterSheetSub = styled.Text`
  font-size: 13px;
  font-weight: 600;
`;

const FilterResetLink = styled.TouchableOpacity`
  padding-top: 4px;
`;

const FilterResetText = styled.Text`
  font-size: 14px;
  font-weight: 800;
`;

const FilterSection = styled.View`
  gap: 8px;
  margin-bottom: 16px;
`;

const FilterLabel = styled.Text`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding-left: 2px;
`;

const FilterOptionsCard = styled.View`
  border-width: 1px;
  border-radius: 16px;
  overflow: hidden;
`;

const FilterOption = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
`;

const FilterOptionRule = styled.View`
  height: 1px;
  margin-left: 54px;
`;

const FilterOptionIcon = styled.View`
  width: 36px;
  height: 36px;
  border-radius: 11px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const FilterOptionCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 2px;
`;

const FilterOptionTitle = styled.Text`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const FilterOptionHint = styled.Text`
  font-size: 12px;
  font-weight: 600;
`;

const FilterCheck = styled.View`
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border-width: 1.5px;
  align-items: center;
  justify-content: center;
`;

const FilterSheetFooter = styled.View`
  padding: 12px 18px 0;
  border-top-width: 1px;
`;

const FilterDoneBtn = styled.TouchableOpacity`
  border-radius: 14px;
  align-items: center;
  justify-content: center;
  padding: 14px;
`;

const FilterDoneText = styled.Text`
  font-size: 15px;
  font-weight: 800;
  color: #ffffff;
`;

const Centered = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
`;

const HistoryCard = styled.TouchableOpacity`
  border-width: 1px;
  border-radius: 14px;
  padding: 12px;
  gap: 10px;
`;

const HistoryCardTop = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
`;

const HistoryTitle = styled.Text`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const HistoryMeta = styled.Text`
  font-size: 11px;
  font-weight: 600;
`;

const HistoryTotal = styled.Text`
  font-size: 14px;
  font-weight: 800;
`;

const HistoryFooter = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const HistoryChip = styled.View`
  border-width: 1px;
  border-radius: 999px;
  padding: 3px 9px;
`;

const HistoryChipText = styled.Text`
  font-size: 11px;
  font-weight: 700;
`;

const EmptyWrap = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 36px 18px;
  gap: 8px;
`;

const EmptyDetails = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  gap: 8px;
`;

const EmptyIcon = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
`;

const EmptyTitle = styled.Text`
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.25px;
`;

const EmptyHint = styled.Text`
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  line-height: 18px;
`;

const DetailBody = styled.View`
  gap: 22px;
`;

const BoardTop = styled.View`
  gap: 6px;
`;

const BoardOverline = styled.Text`
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.2px;
`;

const BoardTable = styled.Text`
  font-size: 30px;
  font-weight: 900;
  letter-spacing: -0.8px;
  line-height: 34px;
`;

const StatStrip = styled.View`
  flex-direction: row;
  align-items: stretch;
  border-width: 1px;
  border-radius: 16px;
  overflow: hidden;
`;

const StatCell = styled.View`
  flex: 1;
  padding: 14px 12px;
  gap: 4px;
`;

const StatDivider = styled.View`
  width: 1px;
`;

const StatLabel = styled.Text`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
`;

const StatValue = styled.Text`
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const BoardNote = styled.View`
  gap: 6px;
`;

const NoteText = styled.Text`
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
`;

const ItemsCard = styled.View`
  border-width: 1px;
  border-radius: 16px;
  overflow: hidden;
`;

const ItemsCardHead = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom-width: 1px;
`;

const ItemsCount = styled.Text`
  font-size: 12px;
  font-weight: 700;
`;

const ItemRule = styled.View`
  height: 1px;
  margin-horizontal: 14px;
`;

const ItemRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
`;

const QtyBadge = styled.View`
  min-width: 28px;
  align-items: center;
  justify-content: center;
`;

const QtyBadgeText = styled.Text`
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const ItemName = styled.Text`
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.15px;
`;

const ItemPrices = styled.View`
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
`;

const ItemUnit = styled.Text`
  font-size: 11px;
  font-weight: 600;
`;

const ItemAmt = styled.Text`
  font-size: 14px;
  font-weight: 800;
`;

const BoardTotal = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  border-width: 1px;
  border-radius: 16px;
  padding: 16px 18px;
  margin-top: 2px;
`;

const BoardTotalLabel = styled.Text`
  font-size: 13px;
  font-weight: 700;
`;

const BoardTotalValue = styled.Text`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.3px;
`;

const ModalContainer = styled.View`
  flex: 1;
`;

const ModalHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom-width: 1px;
`;

const ModalTitle = styled.Text`
  flex: 1;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const CloseBtn = styled.TouchableOpacity`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;
