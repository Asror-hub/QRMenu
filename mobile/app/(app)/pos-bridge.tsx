import { useCallback, useEffect, useRef, useState } from "react";
import { Text, Switch, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/services/supabase";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useTheme } from "@/src/context/ThemeContext";
import type { Order, OrderItem } from "@/src/context/OrdersContext";
import { formatCurrency } from "@/src/utils/currency";
import { PlanGate } from "@/src/components/PlanGate";

const PRINTED_IDS_KEY = "qrmenu_pos_bridge_printed_ids";
const ENABLED_KEY = "qrmenu_pos_bridge_enabled";
const MAX_STORED_IDS = 500;

function buildReceiptHtml(order: Order, restaurantName: string, currency: string): string {
  const tableLabel =
    order.tables?.table_name && order.tables?.table_number
      ? `${order.tables.table_name} ${order.tables.table_number}`
      : order.tables?.table_number
        ? `Table ${order.tables.table_number}`
        : `Table ${order.table_id ?? "—"}`;
  const time = order.accepted_at
    ? new Date(order.accepted_at).toLocaleString()
    : order.created_at
      ? new Date(order.created_at).toLocaleString()
      : "—";

  const itemsHtml = (order.items ?? [])
    .map((item: OrderItem) => {
      const qty = item.quantity ?? 1;
      const name = item.name ?? "—";
      const price = Number(item.price ?? 0) * qty;
      return `<tr><td>${qty}x ${name}</td><td style="text-align:right">${formatCurrency(price, currency)}</td></tr>`;
    })
    .join("");

  const total = (order.items ?? []).reduce(
    (sum: number, i: OrderItem) => sum + Number(i.price ?? 0) * Number(i.quantity ?? 0),
    0
  );
  const commentBlock = order.comment
    ? `<p><strong>Comment:</strong> ${order.comment}</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: monospace; font-size: 14px; padding: 12px; margin: 0; max-width: 300px; }
    h2 { margin: 0 0 8px 0; font-size: 16px; text-align: center; }
    p { margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; }
    .total { font-weight: bold; margin-top: 8px; border-top: 1px dashed #000; padding-top: 8px; }
    .center { text-align: center; }
  </style>
</head>
<body>
  <h2>${restaurantName}</h2>
  <p class="center"><strong>Order #${order.order_number ?? "—"}</strong></p>
  <p class="center">${tableLabel}</p>
  <p class="center" style="font-size:12px">${time}</p>
  <hr>
  <table>
    ${itemsHtml}
  </table>
  ${commentBlock}
  <p class="total">TOTAL: ${formatCurrency(total, currency)}</p>
  <hr>
  <p class="center" style="font-size:11px">QRMenu</p>
</body>
</html>
`;
}

function PosBridgeScreen() {
  const { restaurant } = useRestaurant();
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [enabledLoaded, setEnabledLoaded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastPrinted, setLastPrinted] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [printedIds, setPrintedIds] = useState<Set<string>>(new Set());
  const printedIdsRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadPrintedIds = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PRINTED_IDS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        const set = new Set(arr);
        setPrintedIds(set);
        printedIdsRef.current = set;
      }
    } catch {
      // ignore
    }
  }, []);

  const markPrinted = useCallback(async (id: string) => {
    setPrintedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      printedIdsRef.current = next;
      const arr = Array.from(next);
      if (arr.length > MAX_STORED_IDS) {
        arr.splice(0, arr.length - MAX_STORED_IDS);
      }
      AsyncStorage.setItem(PRINTED_IDS_KEY, JSON.stringify(arr)).catch(() => {});
      return new Set(arr);
    });
  }, []);

  const printOrder = useCallback(
    async (order: Order) => {
      if (!restaurant?.name) return;
      try {
        const html = buildReceiptHtml(order, restaurant.name, restaurant.currency ?? "USD");
        await Print.printAsync({
          html,
          printerUrl: undefined, // Use default/system printer
        });
        const time = new Date().toLocaleTimeString();
        setLastPrinted(`Order #${order.order_number ?? order.id} at ${time}`);
        setLastError(null);
        setActivityLog((prev) => [...prev.slice(-19), `[${time}] Printed: Order #${order.order_number ?? order.id}`]);
        await markPrinted(order.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLastError(msg);
        setActivityLog((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] Print error: ${msg}`]);
      }
    },
    [restaurant?.name, markPrinted]
  );

  const fetchAndPrint = useCallback(
    async (orderId: string) => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_id, status, items, order_number, comment, created_at, accepted_at, tables (table_number, table_name)")
        .eq("id", orderId)
        .single();

      if (error) {
        const msg = `Fetch failed: ${error.message}`;
        setLastError(msg);
        setActivityLog((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] Error: ${msg}`]);
        return;
      }
      if (!data || (data as { status: string }).status !== "accepted") return;
      await printOrder(data as Order);
    },
    [printOrder]
  );

  useEffect(() => {
    loadPrintedIds();
  }, [loadPrintedIds]);

  useEffect(() => {
    AsyncStorage.getItem(ENABLED_KEY).then((val) => {
      setEnabled(val === "true");
      setEnabledLoaded(true);
    });
  }, []);

  const saveEnabled = useCallback((value: boolean) => {
    setEnabled(value);
    AsyncStorage.setItem(ENABLED_KEY, value ? "true" : "false").catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled || !restaurant?.id) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel("pos-bridge-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        async (payload) => {
          const record = payload.new as { id: string; status: string; order_number?: number } | null;
          const orderNum = record?.order_number ?? "?";
          const time = new Date().toLocaleTimeString();
          const msg = `[${time}] Event: Order #${orderNum} status=${record?.status ?? "?"}`;
          setLastEvent(`Order #${orderNum} (${record?.status ?? "?"}) at ${time}`);
          setActivityLog((prev) => [...prev.slice(-19), msg]);

          if (!record || record.status !== "accepted") return;
          if (printedIdsRef.current.has(record.id)) {
            const skipMsg = `[${time}] Skipped Order #${orderNum} (already printed)`;
            setActivityLog((prev) => [...prev.slice(-19), skipMsg]);
            return;
          }
          fetchAndPrint(record.id);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, restaurant?.id, fetchAndPrint]);

  useEffect(() => {
    if (!enabled || !restaurant?.id) return;

    const poll = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, table_id, status, items, order_number, comment, created_at, accepted_at, tables (table_number, table_name)")
        .eq("restaurant_id", restaurant.id)
        .eq("status", "accepted");

      const orders = (data ?? []) as Order[];
      for (const order of orders) {
        if (printedIdsRef.current.has(order.id)) continue;
        const time = new Date().toLocaleTimeString();
        setActivityLog((prev) => [...prev.slice(-19), `[${time}] Poll: found Order #${order.order_number ?? order.id}, printing...`]);
        await fetchAndPrint(order.id);
      }
    };

    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [enabled, restaurant?.id, fetchAndPrint]);

  const toggleEnabled = (value: boolean) => {
    saveEnabled(value);
    if (!value) setLastError(null);
  };

  const handleTestPrint = async () => {
    if (!restaurant?.id || !restaurant?.name) {
      setLastError("Restaurant not loaded");
      return;
    }
    setTesting(true);
    setLastError(null);
    try {
      const { data } = await supabase
        .from("orders")
        .select("id, table_id, status, items, order_number, comment, created_at, accepted_at, tables (table_number, table_name)")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const order = data as Order | null;
      if (order && order.status === "accepted") {
        await printOrder(order);
      } else if (order) {
        await printOrder({ ...order, status: "accepted" } as Order);
      } else {
        const demoOrder: Order = {
          id: "test",
          table_id: "test",
          status: "accepted",
          order_number: 999,
          items: [
            { name: "Test Item 1", price: 5.99, quantity: 2 },
            { name: "Test Item 2", price: 3.50, quantity: 1 },
          ],
          tables: { table_number: 1, table_name: "Demo" },
          accepted_at: new Date().toISOString(),
        };
        await printOrder(demoOrder);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Container style={{ backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={{ backgroundColor: colors.surface, borderColor: colors.containerBorder }}>
          <CardHeader>
            <Ionicons name="print-outline" size={28} color={colors.sidebarOrange} />
            <CardTitle style={{ color: colors.text }}>Print orders automatically</CardTitle>
          </CardHeader>
          <CardDescription style={{ color: colors.textMuted }}>
            When enabled, accepted orders are printed to the device's default printer. Connect a
            Bluetooth or network printer in system settings first.
          </CardDescription>
          <ToggleRow>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>Enabled</Text>
            <Switch
              value={enabled}
              onValueChange={toggleEnabled}
              disabled={!enabledLoaded}
              trackColor={{ false: colors.containerBorder, true: "rgba(255,102,0,0.5)" }}
              thumbColor={enabled ? "#ff6600" : "#f4f3f4"}
            />
          </ToggleRow>
        </Card>

        {enabled && (
          <StatusCard style={{ backgroundColor: colors.surface, borderColor: colors.containerBorder }}>
            <StatusTitle style={{ color: colors.text }}>Status</StatusTitle>
            <StatusRow>
              <Ionicons name="radio-outline" size={20} color="#22c55e" />
              <Text style={{ color: colors.text, marginLeft: 8 }}>
                Listening for accepted orders
              </Text>
            </StatusRow>
            {lastEvent && (
              <StatusRow>
                <Ionicons name="pulse-outline" size={20} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginLeft: 8, flex: 1 }}>{lastEvent}</Text>
              </StatusRow>
            )}
            {lastPrinted && (
              <StatusRow>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginLeft: 8 }}>Last printed: {lastPrinted}</Text>
              </StatusRow>
            )}
            {lastError && (
              <StatusRow>
                <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
                <Text style={{ color: "#ef4444", marginLeft: 8 }}>{lastError}</Text>
              </StatusRow>
            )}
            <TestButton onPress={handleTestPrint} disabled={testing} style={{ backgroundColor: colors.surface, borderColor: colors.containerBorder }}>
              {testing ? (
                <ActivityIndicator size="small" color={colors.sidebarOrange} />
              ) : (
                <>
                  <Ionicons name="print" size={18} color={colors.sidebarOrange} />
                  <Text style={{ color: colors.sidebarOrange, fontWeight: "600", marginLeft: 8 }}>Test print</Text>
                </>
              )}
            </TestButton>
            <ActivityLogSection style={{ backgroundColor: colors.surface, borderColor: colors.containerBorder }}>
              <StatusTitle style={{ color: colors.text }}>Activity log</StatusTitle>
              {activityLog.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  No activity yet. Accept an order from admin, then wait a few seconds. Polling every 5 sec.
                </Text>
              ) : (
                activityLog.map((line, i) => (
                  <Text key={i} style={{ color: colors.text, fontSize: 12, fontFamily: "monospace", marginBottom: 4 }}>
                    {line}
                  </Text>
                ))
              )}
            </ActivityLogSection>
          </StatusCard>
        )}

        <HintCard style={{ backgroundColor: colors.surface, borderColor: colors.containerBorder }}>
          <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
          <HintText style={{ color: colors.textMuted }}>
            Keep this screen open for automatic printing. When you accept an order (admin or
            mobile Orders), "Last event" should update, then the receipt prints. If events don't
            appear, enable Realtime for the orders table in Supabase (Database → Replication).
          </HintText>
        </HintCard>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
});

const Container = styled.View`
  flex: 1;
`;

const Card = styled.View`
  border-radius: 16px;
  border-width: 1px;
  padding: 20px;
  margin-bottom: 16px;
`;

const CardHeader = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const CardTitle = styled.Text`
  font-size: 18px;
  font-weight: 700;
`;

const CardDescription = styled.Text`
  font-size: 14px;
  line-height: 20px;
  margin-bottom: 16px;
  opacity: 0.85;
`;

const ToggleRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const StatusCard = styled.View`
  border-radius: 12px;
  border-width: 1px;
  padding: 16px;
  margin-bottom: 16px;
`;

const StatusTitle = styled.Text`
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
`;

const StatusRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 8px;
`;

const ActivityLogSection = styled.View`
  margin-top: 16px;
  padding: 12px;
  border-radius: 10px;
  border-width: 1px;
`;

const TestButton = styled(TouchableOpacity)`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  border-radius: 10px;
  border-width: 1px;
  margin-top: 12px;
`;

const HintCard = styled.View`
  flex-direction: row;
  gap: 12px;
  border-radius: 12px;
  border-width: 1px;
  padding: 14px;
`;

const HintText = styled.Text`
  flex: 1;
  font-size: 13px;
  line-height: 19px;
`;

export default function GatedPosBridgeScreen() {
  return (
    <PlanGate feature="pos">
      <PosBridgeScreen />
    </PlanGate>
  );
}
