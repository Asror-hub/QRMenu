import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useFeedbackAlerts } from "@/src/context/FeedbackAlertsContext";
import { supabase } from "@/src/services/supabase";
import { formatCurrency } from "@/src/utils/currency";

const PAGE_SIZE = 40;
const STAR_COLOR = "#f59e0b";

const SELECT_FULL =
  "id, order_id, order_number, table_id, food_rating, service_rating, comment, created_at, tables(table_number), orders(items, comment)";
const SELECT_WITH_ORDERS =
  "id, order_id, order_number, table_id, food_rating, service_rating, comment, created_at, orders(items, comment)";
const SELECT_PLAIN =
  "id, order_id, order_number, table_id, food_rating, service_rating, comment, created_at";

type OrderItem = {
  name?: string;
  quantity?: number;
  price?: number;
  type?: string;
};

type OrderFeedback = {
  id: string;
  order_id?: string;
  order_number: number | null;
  table_id?: string | null;
  food_rating: number;
  service_rating: number;
  comment: string | null;
  created_at: string;
  tables?: { table_number?: number | null } | null;
  orders?: { items?: OrderItem[] | null; comment?: string | null } | null;
};

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

function getOrderItems(feedback: OrderFeedback) {
  const items = feedback?.orders?.items;
  if (!Array.isArray(items)) return [] as OrderItem[];
  return items.filter((item) => item?.type !== "waiter_call");
}

function getOrderTotal(items: OrderItem[] = []) {
  return items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <StarsRow>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= rating ? "star" : "star-outline"}
          size={size}
          color={n <= rating ? STAR_COLOR : "#a8a29e"}
        />
      ))}
    </StarsRow>
  );
}

export default function FeedbacksScreen() {
  const { restaurant } = useRestaurant();
  const { colors, theme } = useTheme();
  const { t, locale } = useLanguage();
  const navigation = useNavigation();
  const {
    incomingIds,
    isIncoming,
    acknowledge,
    soundEnabled,
    toggleSound,
    lastEventAt,
  } = useFeedbackAlerts();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSplit = width >= 900;
  const isLight = theme === "light";
  const silverBorder = isLight
    ? "rgba(148, 163, 184, 0.32)"
    : "rgba(168, 162, 158, 0.28)";
  const softFill = isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)";
  const selectedFill = isLight
    ? "rgba(255, 102, 0, 0.08)"
    : "rgba(255, 102, 0, 0.14)";
  const selectedBorder = isLight
    ? "rgba(255, 102, 0, 0.45)"
    : "rgba(255, 102, 0, 0.55)";
  const highlightFill = isLight
    ? "rgba(245, 158, 11, 0.12)"
    : "rgba(245, 158, 11, 0.18)";
  const highlightBorder = isLight
    ? "rgba(245, 158, 11, 0.55)"
    : "rgba(245, 158, 11, 0.65)";

  const [feedbacks, setFeedbacks] = useState<OrderFeedback[]>([]);
  const feedbacksLenRef = useRef(0);
  const [selected, setSelected] = useState<OrderFeedback | null>(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const selectAttempts = useRef([SELECT_FULL, SELECT_WITH_ORDERS, SELECT_PLAIN]);
  const selectIndexRef = useRef(0);
  const currency = restaurant?.currency ?? "USD";
  const incomingPulse = useRef(new Animated.Value(0)).current;
  const hasIncomingCards = incomingIds.length > 0;

  useEffect(() => {
    feedbacksLenRef.current = feedbacks.length;
  }, [feedbacks.length]);

  useEffect(() => {
    if (!hasIncomingCards) {
      incomingPulse.stopAnimation();
      incomingPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(incomingPulse, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(incomingPulse, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [hasIncomingCards, incomingPulse]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            void toggleSound();
          }}
          style={{ paddingHorizontal: 10, paddingVertical: 6 }}
          accessibilityLabel={soundEnabled ? t("soundOn") : t("soundOff")}
        >
          <Ionicons
            name={soundEnabled ? "volume-high" : "volume-mute"}
            size={22}
            color={soundEnabled ? colors.primary : colors.textMuted}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, soundEnabled, toggleSound, t, colors.primary, colors.textMuted]);
  const loadFeedbacks = useCallback(
    async (opts?: { reset?: boolean }) => {
      if (!restaurant?.id) {
        setFeedbacks([]);
        setSelected(null);
        setLoading(false);
        setHasMore(false);
        return;
      }

      const reset = opts?.reset !== false;
      const from = reset ? 0 : feedbacksLenRef.current;
      if (reset) {
        setLoading(true);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      let rows: OrderFeedback[] = [];
      let lastError: { message?: string } | null = null;
      const attempts = selectAttempts.current;
      for (let i = selectIndexRef.current; i < attempts.length; i += 1) {
        const { data, error } = await supabase
          .from("order_feedbacks")
          .select(attempts[i])
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (!error) {
          selectIndexRef.current = i;
          rows = (data ?? []) as OrderFeedback[];
          lastError = null;
          break;
        }
        lastError = error;
      }

      if (lastError) {
        console.warn("feedbacks load failed", lastError.message);
        if (reset) {
          setFeedbacks([]);
          setSelected(null);
        }
      } else {
        setFeedbacks((prev) => (reset ? rows : [...prev, ...rows]));
        setHasMore(rows.length >= PAGE_SIZE);
        if (reset) {
          setSelected((prev) => {
            if (!rows.length) return null;
            if (!isSplit) return null;
            if (prev && rows.some((r) => r.id === prev.id)) {
              return rows.find((r) => r.id === prev.id) ?? rows[0];
            }
            return rows[0];
          });
        }
      }

      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    },
    [restaurant?.id, isSplit]
  );

  useEffect(() => {
    void loadFeedbacks({ reset: true });
  }, [loadFeedbacks]);

  useEffect(() => {
    if (!lastEventAt) return;
    const missing = incomingIds.some((id) => !feedbacks.some((f) => f.id === id));
    if (missing) {
      void loadFeedbacks({ reset: true });
    }
  }, [lastEventAt, incomingIds, feedbacks, loadFeedbacks]);

  useEffect(() => {
    if (!selected?.id) {
      setItemsOpen(false);
      return;
    }
    setItemsOpen(!isIncoming(selected.id));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- only when switching cards

  const onRefresh = () => {
    setRefreshing(true);
    void loadFeedbacks({ reset: true });
  };

  const averages = useMemo(() => {
    if (!feedbacks.length) return null;
    const foodSum = feedbacks.reduce((s, f) => s + (Number(f.food_rating) || 0), 0);
    const serviceSum = feedbacks.reduce(
      (s, f) => s + (Number(f.service_rating) || 0),
      0
    );
    return {
      food: foodSum / feedbacks.length,
      service: serviceSum / feedbacks.length,
      count: feedbacks.length,
    };
  }, [feedbacks]);

  const renderDetails = (item: OrderFeedback) => {
    const tableNum = item.tables?.table_number;
    const comment = item.comment?.trim();
    const orderItems = getOrderItems(item);
    const orderNote = item.orders?.comment?.trim();
    return (
      <DetailInner>
        <DetailHeaderRow>
          <DetailOrder style={{ color: colors.text }}>
            {t("feedbackOrder", { number: item.order_number ?? "—" })}
          </DetailOrder>
          {tableNum != null ? (
            <DetailTable
              style={{
                color: colors.text,
                borderColor: silverBorder,
                backgroundColor: softFill,
              }}
            >
              {t("table")} {tableNum}
            </DetailTable>
          ) : null}
        </DetailHeaderRow>

        <DetailWhen style={{ color: colors.textMuted }}>
          {formatWhen(item.created_at, locale)}
        </DetailWhen>

        <RatingCards>
          <RatingCard
            style={{
              borderColor: silverBorder,
              backgroundColor: softFill,
            }}
          >
            <RatingCardLabel style={{ color: colors.textMuted }}>
              {t("feedbackFood")}
            </RatingCardLabel>
            <RatingCardScore style={{ color: colors.text }}>
              {Number(item.food_rating) || 0}
            </RatingCardScore>
            <Stars value={item.food_rating} size={22} />
          </RatingCard>
          <RatingCard
            style={{
              borderColor: silverBorder,
              backgroundColor: softFill,
            }}
          >
            <RatingCardLabel style={{ color: colors.textMuted }}>
              {t("feedbackService")}
            </RatingCardLabel>
            <RatingCardScore style={{ color: colors.text }}>
              {Number(item.service_rating) || 0}
            </RatingCardScore>
            <Stars value={item.service_rating} size={22} />
          </RatingCard>
        </RatingCards>

        <CommentCard style={{ borderColor: silverBorder }}>
          <RatingCardLabel style={{ color: colors.textMuted }}>
            {t("feedbackComment")}
          </RatingCardLabel>
          <CommentBody
            style={{ color: comment ? colors.text : colors.textMuted }}
          >
            {comment || t("feedbackNoComment")}
          </CommentBody>
        </CommentCard>

        <ItemsCard style={{ borderColor: silverBorder }}>
          <ItemsToggle
            activeOpacity={0.8}
            onPress={() => setItemsOpen((open) => !open)}
          >
            <ItemsToggleLeft>
              <RatingCardLabel style={{ color: colors.textMuted }}>
                {t("historyOrderItems")}
              </RatingCardLabel>
              <ItemsCount style={{ color: colors.textMuted }}>
                {orderItems.length
                  ? t("historyItemsCount", { count: orderItems.length })
                  : t("historyNoItemsOnOrder")}
              </ItemsCount>
            </ItemsToggleLeft>
            <ChevronWrap
              style={{
                backgroundColor: softFill,
                borderColor: silverBorder,
                transform: [{ rotate: itemsOpen ? "180deg" : "0deg" }],
              }}
            >
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </ChevronWrap>
          </ItemsToggle>

          {itemsOpen ? (
            orderItems.length === 0 ? (
              <CommentBody style={{ color: colors.textMuted }}>
                {t("historyNoItemsOnOrder")}
              </CommentBody>
            ) : (
              <ItemsBody style={{ borderTopColor: silverBorder }}>
                {orderNote ? (
                  <OrderNote
                    style={{
                      borderColor: silverBorder,
                      backgroundColor: softFill,
                    }}
                  >
                    <RatingCardLabel style={{ color: colors.textMuted }}>
                      {t("note")}
                    </RatingCardLabel>
                    <CommentBody style={{ color: colors.text }}>{orderNote}</CommentBody>
                  </OrderNote>
                ) : null}
                {orderItems.map((line, index) => {
                  const price = Number(line.price || 0);
                  const quantity = Number(line.quantity || 0);
                  return (
                    <ItemRow key={`${item.id}-item-${index}`}>
                      <ItemLeft>
                        <QtyBadge
                          style={{
                            backgroundColor: softFill,
                            borderColor: silverBorder,
                          }}
                        >
                          <QtyText style={{ color: colors.text }}>x{quantity}</QtyText>
                        </QtyBadge>
                        <ItemName style={{ color: colors.text }} numberOfLines={2}>
                          {line.name || t("items")}
                        </ItemName>
                      </ItemLeft>
                      <ItemRight>
                        <LinePrice style={{ color: colors.textMuted }}>
                          {formatCurrency(price, currency, locale)}
                        </LinePrice>
                        <LineTotal style={{ color: colors.text }}>
                          {formatCurrency(price * quantity, currency, locale)}
                        </LineTotal>
                      </ItemRight>
                    </ItemRow>
                  );
                })}
                <OrderTotalRow style={{ borderTopColor: silverBorder }}>
                  <OrderTotalLabel style={{ color: colors.textMuted }}>
                    {t("historyOrderTotal")}
                  </OrderTotalLabel>
                  <OrderTotalValue style={{ color: colors.text }}>
                    {formatCurrency(getOrderTotal(orderItems), currency, locale)}
                  </OrderTotalValue>
                </OrderTotalRow>
              </ItemsBody>
            )
          ) : null}
        </ItemsCard>

        {isIncoming(item.id) ? (
          <AckButton
            onPress={() => acknowledge(item.id)}
            activeOpacity={0.88}
            style={{ backgroundColor: STAR_COLOR }}
          >
            <AckButtonText>{t("feedbackDismissAlert")}</AckButtonText>
          </AckButton>
        ) : null}
      </DetailInner>
    );
  };

  const renderItem = ({ item }: { item: OrderFeedback }) => {
    const active = selected?.id === item.id;
    const incoming = isIncoming(item.id);
    const tableNum = item.tables?.table_number;
    const idleBg = active ? selectedFill : colors.surface;
    const animatedBg = incoming
      ? incomingPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [idleBg, highlightFill],
        })
      : idleBg;
    const animatedBorder = incoming
      ? incomingPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [silverBorder, highlightBorder],
        })
      : active
        ? selectedBorder
        : silverBorder;
    const animatedScale = incoming
      ? incomingPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.015],
        })
      : 1;
    const badgeOpacity = incoming
      ? incomingPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.7, 1],
        })
      : 1;

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => {
          setSelected(item);
        }}
      >
        <AnimatedFeedbackCard
          style={{
            borderColor: animatedBorder,
            backgroundColor: animatedBg,
            transform: [{ scale: animatedScale }],
          }}
        >
          <CardTop>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <CardTitleRow>
                <CardTitle style={{ color: colors.text }} numberOfLines={1}>
                  {t("feedbackOrder", { number: item.order_number ?? "—" })}
                </CardTitle>
                {incoming ? (
                  <Animated.View style={{ opacity: badgeOpacity }}>
                    <NewBadge>
                      <NewBadgeText>{t("feedbackNew")}</NewBadgeText>
                    </NewBadge>
                  </Animated.View>
                ) : null}
              </CardTitleRow>
              <CardMeta style={{ color: colors.textMuted }} numberOfLines={1}>
                {tableNum != null
                  ? `${t("table")} ${tableNum} · ${formatWhen(item.created_at, locale)}`
                  : formatWhen(item.created_at, locale)}
              </CardMeta>
            </View>
            <ScorePill
              style={{
                backgroundColor: isLight
                  ? "rgba(245, 158, 11, 0.12)"
                  : "rgba(245, 158, 11, 0.18)",
              }}
            >
              <ScorePillText style={{ color: colors.text }}>
                {Number(item.service_rating) || 0}
              </ScorePillText>
              <Ionicons name="star" size={11} color={STAR_COLOR} />
            </ScorePill>
          </CardTop>

          <RatingRow>
            <RatingLabel style={{ color: colors.textMuted }}>
              {t("feedbackFood")}
            </RatingLabel>
            <Stars value={item.food_rating} size={13} />
          </RatingRow>
        </AnimatedFeedbackCard>
      </TouchableOpacity>
    );
  };

  const listPane = (
    <ListPane style={{ backgroundColor: colors.surface, borderColor: silverBorder }}>
      {loading && !feedbacks.length ? (
        <Centered>
          <ActivityIndicator size="large" color={colors.primary} />
        </Centered>
      ) : (
        <FlatList
          data={feedbacks}
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
            if (!loadingMore && hasMore) {
              void loadFeedbacks({ reset: false });
            }
          }}
          onEndReachedThreshold={0.35}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            averages ? (
              <AvgRow>
                <AvgPill
                  style={{
                    borderColor: silverBorder,
                    backgroundColor: softFill,
                  }}
                >
                  <AvgLabel style={{ color: colors.textMuted }}>
                    {t("feedbackAvgFood")}
                  </AvgLabel>
                  <AvgValueRow>
                    <AvgValue style={{ color: colors.text }}>
                      {averages.food.toFixed(1)}
                    </AvgValue>
                    <Ionicons name="star" size={12} color={STAR_COLOR} />
                  </AvgValueRow>
                </AvgPill>
                <AvgPill
                  style={{
                    borderColor: silverBorder,
                    backgroundColor: softFill,
                  }}
                >
                  <AvgLabel style={{ color: colors.textMuted }}>
                    {t("feedbackAvgService")}
                  </AvgLabel>
                  <AvgValueRow>
                    <AvgValue style={{ color: colors.text }}>
                      {averages.service.toFixed(1)}
                    </AvgValue>
                    <Ionicons name="star" size={12} color={STAR_COLOR} />
                  </AvgValueRow>
                </AvgPill>
              </AvgRow>
            ) : null
          }
          ListEmptyComponent={
            <EmptyWrap>
              <EmptyIcon
                style={{
                  backgroundColor: isLight
                    ? "rgba(245, 158, 11, 0.12)"
                    : "rgba(245, 158, 11, 0.18)",
                }}
              >
                <Ionicons name="star" size={22} color={STAR_COLOR} />
              </EmptyIcon>
              <EmptyTitle style={{ color: colors.text }}>
                {t("feedbacksEmpty")}
              </EmptyTitle>
              <EmptyHint style={{ color: colors.textMuted }}>
                {t("feedbacksEmptyHint")}
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
          {renderDetails(selected)}
        </ScrollView>
      ) : (
        <EmptyDetails>
          <EmptyIcon
            style={{
              backgroundColor: isLight
                ? "rgba(245, 158, 11, 0.12)"
                : "rgba(245, 158, 11, 0.18)",
            }}
          >
            <Ionicons name="star-outline" size={24} color={STAR_COLOR} />
          </EmptyIcon>
          <EmptyTitle style={{ color: colors.text }}>
            {t("feedbackSelect")}
          </EmptyTitle>
          <EmptyHint style={{ color: colors.textMuted }}>
            {t("feedbackSelectHint")}
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
                  {t("tileFeedbacks")}
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
                  {renderDetails(selected)}
                </ScrollView>
              ) : null}
            </ModalContainer>
          </Modal>
        </>
      )}
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

const AvgRow = styled.View`
  flex-direction: row;
  gap: 8px;
  margin-bottom: 4px;
`;

const AvgPill = styled.View`
  flex: 1;
  border-width: 1px;
  border-radius: 14px;
  padding: 10px 12px;
  gap: 4px;
`;

const AvgLabel = styled.Text`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

const AvgValueRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 4px;
`;

const AvgValue = styled.Text`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.3px;
`;

const DetailPane = styled.View`
  flex: 1;
  border-width: 1px;
  border-radius: 18px;
  overflow: hidden;
`;

const Centered = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
`;

const FeedbackCard = styled.View`
  border-width: 1.5px;
  border-radius: 14px;
  padding: 12px;
  gap: 8px;
`;

const AnimatedFeedbackCard = Animated.createAnimatedComponent(FeedbackCard);

const CardTop = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
`;

const CardTitle = styled.Text`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
  flex-shrink: 1;
`;

const CardTitleRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const NewBadge = styled.View`
  padding: 2px 7px;
  border-radius: 999px;
  background-color: rgba(245, 158, 11, 0.2);
`;

const NewBadgeText = styled.Text`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #b45309;
`;

const CardMeta = styled.Text`
  font-size: 12px;
  font-weight: 600;
`;

const ScorePill = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 3px;
  padding: 6px 8px;
  border-radius: 10px;
`;

const ScorePillText = styled.Text`
  font-size: 14px;
  font-weight: 800;
`;

const RatingRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const RatingLabel = styled.Text`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const StarsRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 2px;
`;

const EmptyWrap = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
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
  border-radius: 16px;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
`;

const EmptyTitle = styled.Text`
  font-size: 17px;
  font-weight: 800;
  text-align: center;
`;

const EmptyHint = styled.Text`
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  max-width: 260px;
  line-height: 18px;
`;

const DetailInner = styled.View`
  gap: 16px;
`;

const DetailHeaderRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
`;

const DetailOrder = styled.Text`
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.4px;
`;

const DetailTable = styled.Text`
  font-size: 13px;
  font-weight: 700;
  padding: 8px 12px;
  border-radius: 12px;
  border-width: 1px;
  overflow: hidden;
`;

const DetailWhen = styled.Text`
  font-size: 13px;
  font-weight: 600;
`;

const RatingCards = styled.View`
  flex-direction: row;
  gap: 10px;
`;

const RatingCard = styled.View`
  flex: 1;
  border-width: 1px;
  border-radius: 16px;
  padding: 14px;
  gap: 8px;
`;

const RatingCardLabel = styled.Text`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

const RatingCardScore = styled.Text`
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.6px;
`;

const CommentCard = styled.View`
  border-width: 1px;
  border-radius: 16px;
  padding: 14px;
  gap: 8px;
`;

const AckButton = styled.TouchableOpacity`
  height: 46px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
`;

const AckButtonText = styled.Text`
  font-size: 14px;
  font-weight: 800;
  color: #111827;
`;

const ItemsCard = styled.View`
  border-width: 1px;
  border-radius: 16px;
  padding: 12px 14px;
  gap: 10px;
`;

const ItemsToggle = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const ItemsToggleLeft = styled.View`
  flex: 1;
  min-width: 0;
  gap: 2px;
`;

const ItemsCount = styled.Text`
  font-size: 12px;
  font-weight: 600;
`;

const ChevronWrap = styled.View`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const ItemsBody = styled.View`
  gap: 10px;
  padding-top: 10px;
  border-top-width: 1px;
`;

const OrderNote = styled.View`
  border-width: 1px;
  border-radius: 12px;
  padding: 10px 12px;
  gap: 4px;
`;

const ItemRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-vertical: 6px;
`;

const ItemLeft = styled.View`
  flex: 1;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const QtyBadge = styled.View`
  min-width: 30px;
  height: 26px;
  padding-horizontal: 6px;
  border-radius: 8px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const QtyText = styled.Text`
  font-size: 12px;
  font-weight: 800;
`;

const ItemName = styled.Text`
  flex: 1;
  font-size: 14px;
  font-weight: 700;
`;

const ItemRight = styled.View`
  align-items: flex-end;
  gap: 2px;
`;

const LinePrice = styled.Text`
  font-size: 11px;
  font-weight: 600;
`;

const LineTotal = styled.Text`
  font-size: 13px;
  font-weight: 800;
`;

const OrderTotalRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
  margin-top: 2px;
  border-top-width: 1px;
`;

const OrderTotalLabel = styled.Text`
  font-size: 13px;
  font-weight: 700;
`;

const OrderTotalValue = styled.Text`
  font-size: 16px;
  font-weight: 800;
`;

const CommentBody = styled.Text`
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
`;

const ModalContainer = styled.View`
  flex: 1;
`;

const ModalHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom-width: 1px;
`;

const ModalTitle = styled.Text`
  flex: 1;
  min-width: 0;
  font-size: 17px;
  font-weight: 700;
`;

const CloseBtn = styled.TouchableOpacity`
  width: 34px;
  height: 34px;
  border-radius: 17px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;
