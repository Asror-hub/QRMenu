import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { supabase } from "../services/supabase";
import { useRestaurant } from "./RestaurantContext";
import { withAuthRetry } from "../utils/authSession";

export type OrderItem = { id?: string; name?: string; price?: number; quantity?: number; type?: string };
export type Order = {
  id: string;
  table_id: string;
  status: string;
  items: OrderItem[];
  order_number?: number | null;
  comment?: string | null;
  /** qr = customer QR menu; staff = waiter/admin submit order */
  source?: string | null;
  tables?: { table_number?: number; table_name?: string } | null;
  created_at?: string | null;
  accepted_at?: string | null;
  ready_at?: string | null;
  finished_at?: string | null;
  archived_at?: string | null;
};

/** Staff POS / submit-order carts should not drive Incoming Orders alerts. */
function isStaffSubmittedOrder(order: Order) {
  return order.source === "staff";
}

function isIncomingPendingOrder(order: Order) {
  return order.status === "pending" && !isStaffSubmittedOrder(order);
}

type OrdersContextValue = {
  orders: Order[];
  pendingOrdersCount: number;
  loadOrders: () => Promise<void>;
  soundEnabled: boolean;
  toggleSound: () => Promise<void>;
  updateStatus: (id: string, tableId: string, status: string) => Promise<void>;
  orderStatusChannelRef: React.MutableRefObject<ReturnType<typeof supabase.channel> | null>;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

async function playBeep() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      require("../../assets/sounds/notification.mp3"),
      { shouldPlay: true }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {
    // ignore
  }
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { restaurant } = useRestaurant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const prevOrderIdsRef = useRef(new Set<string>());
  const hasLoadedRef = useRef(false);
  const mountTimestampRef = useRef(Date.now());
  const pendingAlarmRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldRepeatForNewOrdersRef = useRef(false);
  const orderStatusChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const inFlightStatusUpdatesRef = useRef(new Set<string>());

  const loadOrders = useCallback(async () => {
    if (!restaurant?.id) return;
    const { data, error } = await withAuthRetry(() =>
      supabase
        .from("orders")
        .select("id, table_id, status, items, order_number, comment, source, created_at, accepted_at, ready_at, finished_at, archived_at, tables (table_number, table_name)")
        .eq("restaurant_id", restaurant.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
    );
    if (error) {
      console.warn("[Orders] load failed:", error.message);
      return;
    }
    setOrders((data as Order[] | null) ?? []);
  }, [restaurant?.id]);

  const toggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    await AsyncStorage.setItem("admin_sound_enabled", String(next));
  };

  const updateStatus = useCallback(async (id: string, tableId: string, status: string) => {
    if (inFlightStatusUpdatesRef.current.has(id)) {
      return;
    }
    inFlightStatusUpdatesRef.current.add(id);
    const now = new Date().toISOString();
    let prevSnapshot: Order[] = [];
    setOrders((prev) => {
      prevSnapshot = prev;
      return prev.map((order) =>
        order.id === id
          ? {
              ...order,
              status,
              accepted_at: status === "accepted" ? now : order.accepted_at,
              ready_at: status === "ready" ? now : order.ready_at,
              finished_at: status === "finish" ? now : order.finished_at,
            }
          : order
      );
    });

    const updates: Record<string, unknown> = { status };
    if (status === "accepted") updates.accepted_at = now;
    else if (status === "ready") updates.ready_at = now;
    else if (status === "finish") updates.finished_at = now;
    try {
      const { data, error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", id)
        .select("id, status")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error("Order status update matched no rows (check ownership / RLS).");
      }
      if (orderStatusChannelRef.current) {
        orderStatusChannelRef.current.send({
          type: "broadcast",
          event: "status",
          payload: { orderId: id, tableId, status },
        });
      }
      if (status === "accepted") {
        supabase.functions.invoke("send-order-to-pos", { body: { orderId: id } }).catch(() => {});
      }
      await loadOrders();
    } catch (err) {
      console.warn("[Orders] status update failed:", (err as Error)?.message ?? err);
      // Roll back optimistic UI to keep state accurate.
      setOrders(prevSnapshot);
      await loadOrders();
    } finally {
      inFlightStatusUpdatesRef.current.delete(id);
    }
  }, [loadOrders]);

  useEffect(() => {
    AsyncStorage.getItem("admin_sound_enabled").then((v) => {
      setSoundEnabled(v === "true");
    });
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!restaurant?.id) return;
    orderStatusChannelRef.current = supabase.channel("order-status");
    orderStatusChannelRef.current.subscribe();

    const channel = supabase
      .channel("orders-admin-mobile")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          loadOrders();
        }
      )
      .subscribe();
    const interval = setInterval(loadOrders, 10000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      if (orderStatusChannelRef.current) {
        supabase.removeChannel(orderStatusChannelRef.current);
        orderStatusChannelRef.current = null;
      }
    };
  }, [restaurant, loadOrders]);

  useEffect(() => {
    const nextIds = new Set(orders.map((o) => o.id));
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      prevOrderIdsRef.current = nextIds;
      return;
    }
    const newOrders = orders.filter((o) => !prevOrderIdsRef.current.has(o.id));
    const isInitialPopulation = prevOrderIdsRef.current.size === 0 && orders.length > 0;
    const isPastGracePeriod = Date.now() - mountTimestampRef.current > 3000;
    const anyNewPending = newOrders.some((o) => isIncomingPendingOrder(o));

    if (anyNewPending && soundEnabled && !isInitialPopulation && isPastGracePeriod) {
      playBeep();
      shouldRepeatForNewOrdersRef.current = true;
    }

    prevOrderIdsRef.current = nextIds;
  }, [orders, soundEnabled]);

  useEffect(() => {
    const hasPending = orders.some((o) => isIncomingPendingOrder(o));
    if (!hasPending) {
      shouldRepeatForNewOrdersRef.current = false;
    }
    const shouldRepeat =
      shouldRepeatForNewOrdersRef.current && soundEnabled && hasPending;
    if (shouldRepeat && !pendingAlarmRef.current) {
      pendingAlarmRef.current = setInterval(() => {
        playBeep();
      }, 3000);
    }
    if ((!soundEnabled || !hasPending || !shouldRepeatForNewOrdersRef.current) && pendingAlarmRef.current) {
      clearInterval(pendingAlarmRef.current);
      pendingAlarmRef.current = null;
    }
    return () => {
      if (pendingAlarmRef.current) {
        clearInterval(pendingAlarmRef.current);
        pendingAlarmRef.current = null;
      }
    };
  }, [orders, soundEnabled]);

  const pendingOrdersCount = orders.filter((o) => isIncomingPendingOrder(o)).length;

  const value: OrdersContextValue = {
    orders,
    pendingOrdersCount,
    loadOrders,
    soundEnabled,
    toggleSound,
    updateStatus,
    orderStatusChannelRef,
  };

  return (
    <OrdersContext.Provider value={value}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
