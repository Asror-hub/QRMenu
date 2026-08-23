import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";
import { supabase } from "../services/supabase";
import { useRestaurant } from "../context/RestaurantContext";
import { useLanguage } from "../context/LanguageContext";
import { useFeedbackAlerts } from "../context/FeedbackAlertsContext";
import { TopBarSlotsContext } from "../components/Layout";
import { formatCurrency } from "../utils/currency";
import { cardItem, cardItemHover, cardPanel } from "../styles/cards";

const SELECT_FULL =
  "id, order_id, order_number, table_id, food_rating, service_rating, comment, created_at, tables(table_number), orders(items, comment)";
const SELECT_WITH_ORDERS =
  "id, order_id, order_number, table_id, food_rating, service_rating, comment, created_at, orders(items, comment)";
const SELECT_PLAIN =
  "id, order_id, order_number, table_id, food_rating, service_rating, comment, created_at";

function Stars({ value, size = "md" }) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <StarsRow $size={size} aria-label={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} $filled={n <= rating} $size={size} aria-hidden="true">
          ★
        </Star>
      ))}
    </StarsRow>
  );
}

function getOrderItems(feedback) {
  const items = feedback?.orders?.items;
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item?.type !== "waiter_call");
}

function getOrderTotal(items = []) {
  return items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
}

function formatWhen(iso, locale, t) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return t("feedbackJustNow");
  if (diffMins < 60) return t("feedbackMinutesAgo", { n: diffMins });
  if (diffHours < 24) return t("feedbackHoursAgo", { n: diffHours });
  if (diffDays < 7) return t("feedbackDaysAgo", { n: diffDays });

  return date.toLocaleString(locale || undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAbsolute(iso, locale) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale || undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tableLabel(item, t) {
  const fromJoin = item?.tables?.table_number;
  if (fromJoin != null) return t("feedbackTable", { number: fromJoin });
  return null;
}

const Feedbacks = () => {
  const { restaurant } = useRestaurant();
  const { t, locale } = useLanguage();
  const { actionsEl: topBarActionsEl } = useContext(TopBarSlotsContext);
  const {
    incomingIds,
    isIncoming,
    acknowledge,
    soundEnabled,
    toggleSound,
    lastEventAt,
  } = useFeedbackAlerts();
  const currency = restaurant?.currency ?? "USD";
  const [feedbacks, setFeedbacks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFeedbacks = useCallback(async () => {
    if (!restaurant?.id) {
      setFeedbacks([]);
      setSelected(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const attempts = [SELECT_FULL, SELECT_WITH_ORDERS, SELECT_PLAIN];
      let data = null;
      let queryError = null;

      for (const select of attempts) {
        const result = await supabase
          .from("order_feedbacks")
          .select(select)
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false });
        data = result.data;
        queryError = result.error;
        if (!queryError) break;
      }

      if (queryError) throw queryError;

      const next = data ?? [];
      setFeedbacks(next);
      setSelected((prev) => {
        if (!prev) return next[0] ?? null;
        return next.find((item) => item.id === prev.id) ?? next[0] ?? null;
      });
    } catch (err) {
      console.warn("[admin Feedbacks] load failed:", err?.message ?? err);
      setFeedbacks([]);
      setSelected(null);
      setError(err instanceof Error ? err.message : t("feedbacksLoadError"));
    } finally {
      setLoading(false);
    }
  }, [restaurant?.id, t]);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  useEffect(() => {
    if (!lastEventAt) return;
    const missing = incomingIds.some((id) => !feedbacks.some((f) => f.id === id));
    if (missing) {
      void loadFeedbacks();
    }
  }, [lastEventAt, incomingIds, feedbacks, loadFeedbacks]);

  const averages = useMemo(() => {
    if (!feedbacks.length) return null;
    const foodSum = feedbacks.reduce((s, f) => s + (Number(f.food_rating) || 0), 0);
    const serviceSum = feedbacks.reduce((s, f) => s + (Number(f.service_rating) || 0), 0);
    return {
      food: foodSum / feedbacks.length,
      service: serviceSum / feedbacks.length,
      count: feedbacks.length,
    };
  }, [feedbacks]);

  const selectFeedback = (item) => {
    setSelected(item);
    setMobileDetailOpen(true);
  };

  useEffect(() => {
    if (!selected?.id) {
      setItemsOpen(false);
      return;
    }
    setItemsOpen(!isIncoming(selected.id));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- only when switching cards

  return (
    <PageShell>
      {topBarActionsEl &&
        createPortal(
          <SoundIconButton
            type="button"
            $active={soundEnabled}
            onClick={toggleSound}
            aria-label={soundEnabled ? t("soundOn") : t("soundOff")}
          >
            {soundEnabled ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M23 9l-6 6M17 9l6 6" />
              </svg>
            )}
            <span>{soundEnabled ? t("soundOn") : t("soundOff")}</span>
          </SoundIconButton>,
          topBarActionsEl
        )}
      <Page>
        <ListPane>
          <ListHeader>
            <ListHeaderText>
              <ListTitle>{t("feedbacksTitle")}</ListTitle>
              <ListSubtitle>
                {averages
                  ? t("feedbacksCount", { count: averages.count })
                  : t("feedbacksSubtitle")}
              </ListSubtitle>
            </ListHeaderText>
            <RefreshButton type="button" onClick={loadFeedbacks} disabled={loading}>
              {loading ? t("loading") : t("feedbacksRefresh")}
            </RefreshButton>
          </ListHeader>

          {averages ? (
            <AvgRow>
              <AvgPill>
                <AvgLabel>{t("feedbackAvgFood")}</AvgLabel>
                <AvgValue>
                  {averages.food.toFixed(1)}
                  <AvgStar aria-hidden="true">★</AvgStar>
                </AvgValue>
              </AvgPill>
              <AvgPill>
                <AvgLabel>{t("feedbackAvgService")}</AvgLabel>
                <AvgValue>
                  {averages.service.toFixed(1)}
                  <AvgStar aria-hidden="true">★</AvgStar>
                </AvgValue>
              </AvgPill>
            </AvgRow>
          ) : null}

          <ListScroll>
            {loading && !feedbacks.length ? (
              <EmptyState>{t("loading")}</EmptyState>
            ) : error ? (
              <EmptyState>{t("feedbacksLoadErrorDetail", { message: error })}</EmptyState>
            ) : feedbacks.length === 0 ? (
              <EmptyState>{t("feedbacksEmpty")}</EmptyState>
            ) : (
              feedbacks.map((item) => {
                const active = selected?.id === item.id;
                const incoming = isIncoming(item.id);
                const table = tableLabel(item, t);
                return (
                  <ListButton
                    key={item.id}
                    type="button"
                    $active={active}
                    $highlight={incoming}
                    onClick={() => selectFeedback(item)}
                  >
                    <ListButtonMain>
                      <strong>
                        {t("feedbackOrder", { number: item.order_number ?? "—" })}
                        {incoming ? <IncomingTag>{t("feedbackNew")}</IncomingTag> : null}
                      </strong>
                      <ListMeta>
                        <span>{table || t("feedbackNoTable")}</span>
                        <span>{formatWhen(item.created_at, locale, t)}</span>
                      </ListMeta>
                      <ListStarsPreview>
                        <MiniLabel>{t("feedbackFood")}</MiniLabel>
                        <Stars value={item.food_rating} size="sm" />
                      </ListStarsPreview>
                    </ListButtonMain>
                    <ScoreBadge title={t("feedbackService")}>
                      {Number(item.service_rating) || 0}
                      <span>★</span>
                    </ScoreBadge>
                  </ListButton>
                );
              })
            )}
          </ListScroll>
        </ListPane>

        <DetailsPane $mobileOpen={mobileDetailOpen}>
          <MobileBackBar>
            <MobileBackButton type="button" onClick={() => setMobileDetailOpen(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M15 19l-7-7 7-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{t("feedbacksAll")}</span>
            </MobileBackButton>
          </MobileBackBar>

          {selected ? (
            <DetailCard>
              <DetailBody>
                <DetailHeader>
                  <OrderTag>
                    {t("feedbackOrder", { number: selected.order_number ?? "—" })}
                  </OrderTag>
                  {tableLabel(selected, t) ? (
                    <TableBadge>{tableLabel(selected, t)}</TableBadge>
                  ) : null}
                </DetailHeader>

                <DetailWhen title={formatAbsolute(selected.created_at, locale)}>
                  {formatWhen(selected.created_at, locale, t)}
                </DetailWhen>

                <RatingCards>
                  <RatingCard>
                    <RatingCardLabel>{t("feedbackFood")}</RatingCardLabel>
                    <RatingCardScore>{Number(selected.food_rating) || 0}</RatingCardScore>
                    <Stars value={selected.food_rating} size="lg" />
                  </RatingCard>
                  <RatingCard>
                    <RatingCardLabel>{t("feedbackService")}</RatingCardLabel>
                    <RatingCardScore>{Number(selected.service_rating) || 0}</RatingCardScore>
                    <Stars value={selected.service_rating} size="lg" />
                  </RatingCard>
                </RatingCards>

                <CommentBlock>
                  <CommentLabel>{t("feedbackComment")}</CommentLabel>
                  <CommentText $muted={!selected.comment?.trim()}>
                    {selected.comment?.trim() || t("feedbackNoComment")}
                  </CommentText>
                </CommentBlock>

                {(() => {
                  const orderItems = getOrderItems(selected);
                  const orderNote = selected.orders?.comment?.trim();
                  const count = orderItems.length;
                  return (
                    <ItemsBlock>
                      <ItemsToggle
                        type="button"
                        onClick={() => setItemsOpen((open) => !open)}
                        aria-expanded={itemsOpen}
                        aria-label={itemsOpen ? t("collapseSection") : t("expandSection")}
                      >
                        <ItemsToggleLeft>
                          <CommentLabel as="span">{t("items")}</CommentLabel>
                          <ItemsCount>
                            {count
                              ? t("feedbackItemsCount", { count })
                              : t("feedbackNoItems")}
                          </ItemsCount>
                        </ItemsToggleLeft>
                        <Chevron $open={itemsOpen} aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path
                              d="M6 9l6 6 6-6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </Chevron>
                      </ItemsToggle>

                      {itemsOpen ? (
                        count === 0 ? (
                          <CommentText $muted>{t("feedbackNoItems")}</CommentText>
                        ) : (
                          <ItemsBody>
                            {orderNote ? (
                              <OrderNote>
                                <strong>{t("note")}</strong>
                                <span>{orderNote}</span>
                              </OrderNote>
                            ) : null}
                            {orderItems.map((item, index) => {
                              const price = Number(item.price || 0);
                              const quantity = Number(item.quantity || 0);
                              return (
                                <ItemRow key={`${selected.id}-item-${index}`}>
                                  <ItemName>
                                    <QtyBadge>x{quantity}</QtyBadge>
                                    <span>{item.name || t("itemFallback")}</span>
                                  </ItemName>
                                  <LineTotals>
                                    <LinePrice>
                                      {formatCurrency(price, currency, locale)}
                                    </LinePrice>
                                    <LineTotal>
                                      {formatCurrency(price * quantity, currency, locale)}
                                    </LineTotal>
                                  </LineTotals>
                                </ItemRow>
                              );
                            })}
                            <OrderTotal>
                              <span>{t("orderTotal")}</span>
                              <strong>
                                {formatCurrency(getOrderTotal(orderItems), currency, locale)}
                              </strong>
                            </OrderTotal>
                          </ItemsBody>
                        )
                      ) : null}
                    </ItemsBlock>
                  );
                })()}

                {isIncoming(selected.id) ? (
                  <AckButton type="button" onClick={() => acknowledge(selected.id)}>
                    {t("feedbackDismissAlert")}
                  </AckButton>
                ) : null}
              </DetailBody>
            </DetailCard>
          ) : (
            <EmptyDetails>
              <EmptyDetailsTitle>{t("feedbackSelect")}</EmptyDetailsTitle>
              <EmptyDetailsHint>{t("feedbackSelectHint")}</EmptyDetailsHint>
            </EmptyDetails>
          )}
        </DetailsPane>
      </Page>
    </PageShell>
  );
};

const PageShell = styled.div`
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
`;

const Page = styled.div`
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 22px;
  align-items: start;
  min-height: 0;
  height: 100%;
  overflow: hidden;

  @media (max-width: 1180px) {
    grid-template-columns: 280px 1fr;
    gap: 16px;
  }

  @media (max-width: 900px) {
    grid-template-columns: 240px 1fr;
    gap: 12px;
  }

  @media (max-width: 760px) {
    position: relative;
    grid-template-columns: 1fr;
    gap: 0;
    align-items: stretch;
    overflow: hidden;
  }
`;

const ListPane = styled.aside`
  ${cardPanel}
  border-radius: var(--radius-lg);
  padding: 16px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;

  @media (max-width: 900px) {
    padding: 14px;
  }

  [data-theme="light"] & {
    box-shadow: none;
  }
`;

const ListHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
`;

const ListHeaderText = styled.div`
  min-width: 0;
`;

const ListTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 700;
`;

const ListSubtitle = styled.p`
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
`;

const RefreshButton = styled.button`
  border: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--surface) 92%, var(--bg) 8%);
  color: var(--text);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;

  &:disabled {
    opacity: 0.65;
    cursor: default;
  }
`;

const AvgRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  flex-shrink: 0;
`;

const AvgPill = styled.div`
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--surface) 88%, var(--bg) 12%);
`;

const AvgLabel = styled.span`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
`;

const AvgValue = styled.span`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.03em;
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const AvgStar = styled.span`
  color: #f59e0b;
  font-size: 13px;
`;

const ListScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: 8px;
  align-content: start;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
`;

const feedbackPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4);
    border-color: rgba(245, 158, 11, 0.55);
  }
  50% {
    transform: scale(1.015);
    box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.95);
  }
`;

const newBadgePulse = keyframes`
  0%, 100% { opacity: 0.75; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.06); }
`;

const ListButton = styled.button`
  ${cardItem}
  ${cardItemHover}
  border: 1px solid
    ${({ $highlight }) => ($highlight ? "rgba(245, 158, 11, 0.55)" : "transparent")};
  border-left: 4px solid
    ${({ $active, $highlight }) =>
      $highlight ? "#f59e0b" : $active ? "var(--sidebar-orange)" : "transparent"};
  background: ${({ $active, $highlight }) =>
    $highlight
      ? "linear-gradient(180deg, color-mix(in srgb, #f59e0b 18%, var(--surface)), color-mix(in srgb, var(--surface) 90%, #f59e0b 10%))"
      : $active
        ? "linear-gradient(180deg, color-mix(in srgb, var(--primary) 14%, var(--surface)), color-mix(in srgb, var(--surface) 90%, var(--button-overlay) 10%))"
        : undefined};
  color: var(--orders-text);
  padding: 12px;
  cursor: pointer;
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  animation: ${({ $highlight }) =>
    $highlight ? css`${feedbackPulse} 1.4s ease-in-out infinite` : "none"};
  transform-origin: center;

  [data-theme="light"] & {
    border: 1px solid
      ${({ $highlight }) =>
        $highlight ? "rgba(245, 158, 11, 0.55)" : "var(--orders-container-border)"};
    border-left: 3px solid
      ${({ $active, $highlight }) =>
        $highlight ? "#f59e0b" : $active ? "var(--sidebar-orange)" : "var(--orders-container-border)"};
    border-radius: 12px;
    background: ${({ $active, $highlight }) =>
      $highlight
        ? "linear-gradient(180deg, color-mix(in srgb, #f59e0b 14%, var(--surface)), var(--surface))"
        : $active
          ? "linear-gradient(180deg, color-mix(in srgb, var(--primary) 10%, var(--surface)), var(--surface))"
          : "var(--surface)"};
    box-shadow: ${({ $active, $highlight }) =>
      $highlight
        ? "0 0 0 1.5px color-mix(in srgb, #f59e0b 45%, transparent)"
        : $active
          ? "0 0 0 1.5px color-mix(in srgb, var(--primary) 35%, transparent)"
          : "0 1px 2px rgba(28, 25, 23, 0.04)"};

    &:hover {
      transform: ${({ $highlight }) => ($highlight ? undefined : "translateY(-1px)")};
    }
  }
`;

const IncomingTag = styled.span`
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  vertical-align: middle;
  background: rgba(245, 158, 11, 0.18);
  color: #b45309;
  animation: ${newBadgePulse} 1.4s ease-in-out infinite;
`;

const SoundIconButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--orders-container-border);
  background: ${({ $active }) =>
    $active
      ? "color-mix(in srgb, var(--primary) 14%, var(--surface))"
      : "var(--surface)"};
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  svg {
    width: 16px;
    height: 16px;
  }
`;

const AckButton = styled.button`
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 14px;
  background: #f59e0b;
  color: #111827;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;

  &:hover {
    filter: brightness(1.05);
  }
`;

const ListButtonMain = styled.div`
  min-width: 0;
  display: grid;
  gap: 4px;

  strong {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
`;

const ListMeta = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
`;

const ListStarsPreview = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
`;

const MiniLabel = styled.span`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
`;

const ScoreBadge = styled.span`
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-content: center;
  gap: 0;
  font-size: 15px;
  font-weight: 800;
  background: color-mix(in srgb, #f59e0b 14%, var(--surface));
  color: var(--text);
  line-height: 1;

  span {
    color: #f59e0b;
    font-size: 11px;
  }
`;

const EmptyState = styled.p`
  margin: 18px 8px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
`;

const DetailsPane = styled.aside`
  ${cardPanel}
  border-radius: var(--radius-lg);
  padding: 24px;
  position: sticky;
  top: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;

  @media (max-width: 1180px) {
    padding: 18px;
    gap: 12px;
  }

  @media (max-width: 900px) {
    padding: 14px;
  }

  @media (max-width: 760px) {
    position: absolute;
    inset: 0;
    z-index: 5;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    transform: translateX(${({ $mobileOpen }) => ($mobileOpen ? "0" : "100%")});
    opacity: ${({ $mobileOpen }) => ($mobileOpen ? 1 : 0)};
    visibility: ${({ $mobileOpen }) => ($mobileOpen ? "visible" : "hidden")};
    transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.28s ease, visibility 0.32s;
    box-shadow: -18px 0 40px rgba(2, 6, 23, 0.28);
  }

  [data-theme="light"] & {
    box-shadow: none;
    border: 1px solid var(--orders-container-border);

    @media (max-width: 760px) {
      background: var(--orders-bg);
    }
  }
`;

const MobileBackBar = styled.div`
  display: none;

  @media (max-width: 760px) {
    display: flex;
    flex-shrink: 0;
    align-items: center;
  }
`;

const MobileBackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--orders-container-border);
  background: var(--surface);
  color: var(--orders-text);
  border-radius: 999px;
  padding: 7px 14px 7px 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  svg {
    width: 18px;
    height: 18px;
  }
`;

const DetailCard = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const DetailBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: 18px;
  align-content: start;
  padding-right: 4px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
  }
`;

const DetailHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const OrderTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 12%, var(--surface));
  color: var(--text);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
`;

const TableBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--orders-container-border);
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
`;

const DetailWhen = styled.p`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
`;

const RatingCards = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const RatingCard = styled.div`
  border: 1px solid var(--orders-container-border);
  border-radius: 16px;
  padding: 16px;
  display: grid;
  gap: 8px;
  justify-items: start;
  background: color-mix(in srgb, var(--surface) 92%, var(--bg) 8%);
`;

const RatingCardLabel = styled.span`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
`;

const RatingCardScore = styled.span`
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--text);
`;

const CommentBlock = styled.div`
  border: 1px solid var(--orders-container-border);
  border-radius: 16px;
  padding: 16px;
  display: grid;
  gap: 8px;
`;

const ItemsBlock = styled.div`
  border: 1px solid var(--orders-container-border);
  border-radius: 16px;
  padding: 12px 16px;
  display: grid;
  gap: 10px;
`;

const ItemsToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 4px 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
`;

const ItemsToggleLeft = styled.span`
  display: grid;
  gap: 2px;
  min-width: 0;
`;

const ItemsCount = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
`;

const Chevron = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--surface) 88%, var(--bg) 12%);
  transform: rotate(${({ $open }) => ($open ? "180deg" : "0deg")});
  transition: transform 0.18s ease;

  svg {
    width: 16px;
    height: 16px;
  }
`;

const ItemsBody = styled.div`
  display: grid;
  gap: 10px;
  padding-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--orders-container-border) 70%, transparent);
`;

const OrderNote = styled.div`
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 88%, var(--bg) 12%);
  font-size: 13px;

  strong {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  span {
    color: var(--text);
    line-height: 1.4;
  }
`;

const ItemRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--orders-container-border) 70%, transparent);

  &:last-of-type {
    border-bottom: 0;
    padding-bottom: 0;
  }
`;

const ItemName = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const QtyBadge = styled.span`
  flex-shrink: 0;
  min-width: 28px;
  height: 24px;
  padding: 0 6px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  background: color-mix(in srgb, var(--primary) 12%, var(--surface));
  color: var(--text);
`;

const LineTotals = styled.div`
  display: grid;
  justify-items: end;
  gap: 2px;
  flex-shrink: 0;
`;

const LinePrice = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
`;

const LineTotal = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
`;

const OrderTotal = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
  margin-top: 2px;
  border-top: 1px solid var(--orders-container-border);
  font-size: 14px;

  span {
    font-weight: 600;
    color: var(--text-muted);
  }

  strong {
    font-size: 16px;
    font-weight: 800;
    color: var(--text);
  }
`;

const CommentLabel = styled.span`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
`;

const CommentText = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: ${({ $muted }) => ($muted ? "var(--text-muted)" : "var(--text)")};
  white-space: pre-wrap;
`;

const EmptyDetails = styled.div`
  flex: 1;
  display: grid;
  place-content: center;
  gap: 8px;
  text-align: center;
  padding: 24px;
`;

const EmptyDetailsTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
`;

const EmptyDetailsHint = styled.p`
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  max-width: 280px;
`;

const StarsRow = styled.span`
  display: inline-flex;
  gap: ${({ $size }) => ($size === "lg" ? "4px" : "2px")};
  line-height: 1;
`;

const Star = styled.span`
  color: ${({ $filled }) => ($filled ? "#f59e0b" : "#d6d3d1")};
  font-size: ${({ $size }) =>
    $size === "lg" ? "22px" : $size === "sm" ? "12px" : "14px"};
`;

export default Feedbacks;
