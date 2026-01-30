import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { supabase } from "../services/supabase";
import { useRestaurant } from "../context/RestaurantContext";

const Orders = () => {
  const { restaurant } = useRestaurant();
  const [orders, setOrders] = useState([]);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [expandedFilters, setExpandedFilters] = useState({});
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem("admin_sound_enabled") === "true"
  );
  const channelRef = useRef(null);
  const audioCtxRef = useRef(null);
  const prevOrderIdsRef = useRef(new Set());
  const hasLoadedRef = useRef(false);
  const pendingAlarmRef = useRef(null);

  const loadOrders = async () => {
    if (!restaurant?.id) return;
    const { data } = await supabase
      .from("orders")
      .select("id, table_id, status, items, order_number, comment, tables (table_number, table_name)")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
  };

  useEffect(() => {
    loadOrders();
  }, [restaurant]);

  useEffect(() => {
    if (!orders.length) return;
    const latestId = orders[0]?.id;
    const next = orders.reduce((acc, order) => {
      acc[order.id] = order.id === latestId;
      return acc;
    }, {});
    setExpandedOrders(next);
  }, [orders]);

  useEffect(() => {
    const nextIds = new Set(orders.map((order) => order.id));
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      prevOrderIdsRef.current = nextIds;
      return;
    }
    const hasNewOrder = orders.some((order) => !prevOrderIdsRef.current.has(order.id));
    if (hasNewOrder && soundEnabled) {
      playBeep();
    }
    prevOrderIdsRef.current = nextIds;
  }, [orders, soundEnabled]);

  useEffect(() => {
    const hasPending = orders.some((order) => order.status === "pending");
    if (soundEnabled && hasPending && !pendingAlarmRef.current) {
      pendingAlarmRef.current = setInterval(() => {
        playBeep();
      }, 6000);
    }

    if ((!soundEnabled || !hasPending) && pendingAlarmRef.current) {
      clearInterval(pendingAlarmRef.current);
      pendingAlarmRef.current = null;
    }

    return () => {
      if (pendingAlarmRef.current && (!soundEnabled || !hasPending)) {
        clearInterval(pendingAlarmRef.current);
        pendingAlarmRef.current = null;
      }
    };
  }, [orders, soundEnabled]);

  const playBeep = async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }
      const ctx = audioCtxRef.current;
      const playDualTone = (freqA, freqB, duration, delay = 0, type = "sine") => {
        const start = ctx.currentTime + delay;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.6, start + 0.02);
        gain.gain.setValueAtTime(0.6, start + duration - 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        gain.connect(ctx.destination);

        const oscA = ctx.createOscillator();
        oscA.type = type;
        oscA.frequency.value = freqA;
        oscA.connect(gain);
        oscA.start(start);
        oscA.stop(start + duration);

        const oscB = ctx.createOscillator();
        oscB.type = type;
        oscB.frequency.value = freqB;
        oscB.connect(gain);
        oscB.start(start);
        oscB.stop(start + duration);
      };
      // Modern ringtone: short melodic dual-tone sequence.
      playDualTone(523.25, 659.25, 0.1, 0); // C5 + E5
      playDualTone(587.33, 739.99, 0.1, 0.11); // D5 + F#5
      playDualTone(659.25, 830.61, 0.1, 0.22); // E5 + G#5
      playDualTone(783.99, 987.77, 0.1, 0.33); // G5 + B5
      playDualTone(659.25, 830.61, 0.1, 0.44); // E5 + G#5
    } catch {
      // ignore
    }
  };

  const enableSound = async () => {
    setSoundEnabled(true);
    localStorage.setItem("admin_sound_enabled", "true");
    await playBeep();
  };

  useEffect(() => {
    if (!restaurant?.id) return;

    channelRef.current = supabase.channel("order-status");
    channelRef.current.subscribe();

    const channel = supabase
      .channel("orders-admin")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        (payload) => {
          loadOrders();
          if (payload.eventType === "INSERT" && soundEnabled) {
            playBeep();
          }
        }
      )
      .subscribe();

    const interval = setInterval(loadOrders, 10000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [restaurant, soundEnabled]);

  const updateStatus = async (id, tableId, status) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "status",
        payload: { orderId: id, tableId, status }
      });
    }
    loadOrders();
  };

  const deleteOrder = async (id) => {
    await supabase.from("orders").delete().eq("id", id);
    loadOrders();
  };

  const toggleOrder = (id) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getOrderTotal = (items = []) =>
    items.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );

  const filters = useMemo(
    () => [
      { id: "pending", label: "New Orders", status: "pending" },
      { id: "accepted", label: "In Progress", status: "accepted" },
      { id: "ready", label: "Ready", status: "ready" },
      { id: "finish", label: "Finished", status: "finish" }
    ],
    []
  );

  const ordersByStatus = useMemo(
    () =>
      filters.reduce((acc, filter) => {
        acc[filter.status] = orders.filter((order) => order.status === filter.status);
        return acc;
      }, {}),
    [filters, orders]
  );

  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ?? orders[0] ?? null;

  useEffect(() => {
    if (!selectedOrder && orders.length) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrder]);

  const formatTableLabel = (order) => {
    const name = order.tables?.table_name;
    const number = order.tables?.table_number;
    if (name && number) return `${name} ${number}`;
    if (name) return name;
    if (number) return `Table ${number}`;
    return `Table ${order.table_id ?? "---"}`;
  };

  return (
    <Page>
      <FilterPane>
        {filters.map((filter) => {
          const isOpen = expandedFilters[filter.status] ?? true;
          const filtered = ordersByStatus[filter.status] ?? [];
          return (
            <FilterSection key={filter.id}>
              <FilterHeader>
                <FilterTitle>{filter.label}</FilterTitle>
                <ToggleButton
                  type="button"
                  aria-label={isOpen ? "Collapse section" : "Expand section"}
                  onClick={() =>
                    setExpandedFilters((prev) => ({
                      ...prev,
                      [filter.status]: !isOpen
                    }))
                  }
                >
                  <ChevronIcon $open={isOpen} viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </ChevronIcon>
                </ToggleButton>
              </FilterHeader>
              {isOpen && (
                <FilterList>
                  {filtered.length === 0 ? (
                    <EmptyState>No orders</EmptyState>
                  ) : (
                    filtered.map((order) => (
                      <FilterListRow key={order.id}>
                        <FilterOrderButton
                          type="button"
                          $active={order.id === selectedOrder?.id}
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          <div>
                            <strong>{formatTableLabel(order)}</strong>
                            <div>Order #{order.order_number ?? "---"}</div>
                          </div>
                          <strong>${getOrderTotal(order.items).toFixed(2)}</strong>
                        </FilterOrderButton>
                      </FilterListRow>
                    ))
                  )}
                </FilterList>
              )}
            </FilterSection>
          );
        })}
      </FilterPane>
      <DetailsPane>
        <HeaderRow>
          <Heading>Order Details</Heading>
          {!soundEnabled && (
            <SoundButton type="button" onClick={enableSound}>
              Enable sound
            </SoundButton>
          )}
        </HeaderRow>
        {selectedOrder ? (
          <DetailCard>
            <DetailHeader>
              <OrderTopRow>
                <OrderTag>#{selectedOrder.order_number ?? "---"}</OrderTag>
                <TableLabel>{formatTableLabel(selectedOrder)}</TableLabel>
              </OrderTopRow>
            </DetailHeader>
            <Items>
              {selectedOrder.comment && (
                <CommentBlock>
                  <strong>Comment</strong>
                  <span>{selectedOrder.comment}</span>
                </CommentBlock>
              )}
              {(selectedOrder.items ?? []).map((item, index) => {
                const price = Number(item.price || 0);
                const quantity = Number(item.quantity || 0);
                return (
                  <ItemRow key={`${selectedOrder.id}-${index}`}>
                    <ItemName>
                      <QtyBadge>x{quantity}</QtyBadge>
                      <span>{item.name}</span>
                    </ItemName>
                    <LineTotal>${(price * quantity).toFixed(2)}</LineTotal>
                  </ItemRow>
                );
              })}
            </Items>
            <OrderTotal>
              <span>Order Total</span>
              <strong>${getOrderTotal(selectedOrder.items).toFixed(2)}</strong>
            </OrderTotal>
            <Actions>
              {selectedOrder.status === "pending" && (
                <ActionButton
                  type="button"
                  onClick={() =>
                    updateStatus(selectedOrder.id, selectedOrder.table_id, "accepted")
                  }
                >
                  Accept
                </ActionButton>
              )}
              {selectedOrder.status === "accepted" && (
                <ActionButton
                  type="button"
                  onClick={() =>
                    updateStatus(selectedOrder.id, selectedOrder.table_id, "ready")
                  }
                >
                  Ready
                </ActionButton>
              )}
              {selectedOrder.status === "ready" && (
                <ActionButton
                  type="button"
                  onClick={() =>
                    updateStatus(selectedOrder.id, selectedOrder.table_id, "finish")
                  }
                >
                  Finish
                </ActionButton>
              )}
              {selectedOrder.status === "finish" && (
                <DeleteButton
                  type="button"
                  onClick={() => deleteOrder(selectedOrder.id)}
                >
                  Remove
                </DeleteButton>
              )}
            </Actions>
          </DetailCard>
        ) : (
          <EmptyState>Select an order to see details.</EmptyState>
        )}
      </DetailsPane>
    </Page>
  );
};

const Heading = styled.h1`
  margin: 0;
  font-size: 26px;
  font-weight: 600;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
`;

const SoundButton = styled.button`
  border: 1px solid rgba(99, 102, 241, 0.4);
  background: rgba(99, 102, 241, 0.2);
  color: #fff;
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
`;

const Page = styled.div`
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 22px;
  align-items: start;
  min-height: 90vh;
`;

const FilterPane = styled.aside`
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 18px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  height: 90vh;
  overflow-y: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
`;

const FilterList = styled.div`
  display: grid;
  gap: 10px;
`;

const FilterListRow = styled.div`
  display: grid;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const FilterSection = styled.div`
  display: grid;
  gap: 12px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
    margin-bottom: 0;
  }
`;

const FilterHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const FilterTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
`;

const FilterOrderButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ $active }) => ($active ? "#fff" : "var(--text)")};
  padding: 12px 12px;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  background: ${({ $active }) => ($active ? "rgba(99, 102, 241, 0.22)" : "transparent")};
`;

const DetailsPane = styled.aside`
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 26px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 24px;
  height: 90vh;
  overflow-y: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
`;

const DetailCard = styled.div`
  display: grid;
  gap: 16px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(140deg, rgba(17, 24, 39, 0.95), rgba(15, 23, 42, 0.85));
  box-shadow: var(--shadow-sm);
`;

const DetailHeader = styled.div`
  display: grid;
  gap: 8px;
  font-size: 15px;
`;

const EmptyState = styled.p`
  margin: 0;
  color: var(--text-muted);
`;

const List = styled.div`
  display: grid;
  gap: 16px;
`;

const OrderTag = styled.span`
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.28);
  color: #fff;
  font-size: 12px;
`;

const OrderTopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const TableLabel = styled.span`
  font-weight: 600;
`;

const ToggleButton = styled.button`
  border: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.6);
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--text);
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    border-color: rgba(99, 102, 241, 0.5);
    background: rgba(99, 102, 241, 0.12);
    transform: translateY(-1px);
  }
`;

const ChevronIcon = styled.svg`
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
  transform: rotate(${({ $open }) => ($open ? "0deg" : "-90deg")});
`;

const Items = styled.div`
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
`;

const CommentBlock = styled.div`
  display: grid;
  gap: 4px;
  background: var(--surface-2);
  border-radius: 12px;
  padding: 12px 14px;
  color: var(--text);
  border: 1px solid rgba(148, 163, 184, 0.12);

  strong {
    font-size: 13px;
    color: var(--text-muted);
  }
`;

const ItemRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  font-size: 15px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.12);

  &:last-child {
    border-bottom: none;
  }
`;

const ItemName = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
`;

const QtyBadge = styled.span`
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(99, 102, 241, 0.2);
  color: #e0e7ff;
  border: 1px solid rgba(99, 102, 241, 0.4);
`;

const LineTotal = styled.span`
  font-weight: 600;
  font-size: 15px;
`;

const OrderTotal = styled.div`
  display: grid;
  justify-items: end;
  gap: 4px;
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: stretch;
`;

const ActionButton = styled.button`
  border: 1px solid rgba(99, 102, 241, 0.4);
  background: rgba(99, 102, 241, 0.2);
  color: #fff;
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  flex: 1;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const DeleteButton = styled.button`
  border: 1px solid rgba(239, 68, 68, 0.5);
  background: rgba(239, 68, 68, 0.2);
  color: #fff;
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
`;

export default Orders;
