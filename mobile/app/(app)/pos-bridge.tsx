import { useCallback, useEffect, useRef, useState } from "react";
import { Text, Switch, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/services/supabase";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import type { Order } from "@/src/context/OrdersContext";
import { PlanGate } from "@/src/components/PlanGate";
import {
  loadSavedPrinter,
  pickPrinter,
  printOrderTicket,
  type SavedPrinter,
} from "@/src/utils/receiptPrint";

const PRINTED_IDS_KEY = "qrmenu_pos_bridge_printed_ids";
const ENABLED_KEY = "qrmenu_pos_bridge_enabled";
const MAX_STORED_IDS = 500;

function PosBridgeScreen() {
  const { restaurant } = useRestaurant();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(false);
  const [enabledLoaded, setEnabledLoaded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [printer, setPrinter] = useState<SavedPrinter | null>(null);
  const [lastPrinted, setLastPrinted] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [printedIds, setPrintedIds] = useState<Set<string>>(new Set());
  const printedIdsRef = useRef<Set<string>>(new Set());
  const printerUrlRef = useRef<string | null>(null);
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
      if (Platform.OS === "ios" && !printerUrlRef.current) {
        setLastError(t("posBridgeNeedPrinter"));
        return;
      }
      try {
        await printOrderTicket(
          order,
          restaurant.name,
          restaurant.currency ?? "USD",
          printerUrlRef.current
        );
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
    [restaurant?.name, restaurant?.currency, markPrinted, t]
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
    loadSavedPrinter().then((saved) => {
      setPrinter(saved);
      printerUrlRef.current = saved?.url ?? null;
    });
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

  const handleChoosePrinter = useCallback(async () => {
    setPicking(true);
    setLastError(null);
    const picked = await pickPrinter();
    setPicking(false);
    if (!picked) return;
    setPrinter(picked);
    printerUrlRef.current = picked.url;
  }, []);

  const toggleEnabled = async (value: boolean) => {
    if (value && Platform.OS === "ios" && !printerUrlRef.current) {
      const picked = await pickPrinter();
      if (!picked) {
        setLastError(t("posBridgeNeedPrinter"));
        return;
      }
      setPrinter(picked);
      printerUrlRef.current = picked.url;
    }
    saveEnabled(value);
    if (!value) setLastError(null);
  };

  const handleTestPrint = async () => {
    if (!restaurant?.id || !restaurant?.name) {
      setLastError(t("posBridgeRestaurantMissing"));
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
            <CardTitle style={{ color: colors.text }}>{t("posBridgeAutoTitle")}</CardTitle>
          </CardHeader>
          <CardDescription style={{ color: colors.textMuted }}>
            {t("posBridgeAutoDesc")}
          </CardDescription>
          {Platform.OS === "ios" ? (
            <TestButton
              onPress={handleChoosePrinter}
              disabled={picking}
              style={{ backgroundColor: colors.surface, borderColor: colors.containerBorder, marginTop: 0, marginBottom: 16 }}
            >
              {picking ? (
                <ActivityIndicator size="small" color={colors.sidebarOrange} />
              ) : (
                <>
                  <Ionicons name="print-outline" size={18} color={colors.sidebarOrange} />
                  <Text style={{ color: colors.sidebarOrange, fontWeight: "600", marginLeft: 8 }}>
                    {printer ? t("posBridgeChangePrinter") : t("posBridgeChoosePrinter")}
                  </Text>
                </>
              )}
            </TestButton>
          ) : null}
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 16 }}>
            {printer ? printer.name : t("posBridgeNoPrinter")}
          </Text>
          <ToggleRow>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>{t("posBridgeEnabled")}</Text>
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
                {t("posBridgeListening")}
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
                  <Text style={{ color: colors.sidebarOrange, fontWeight: "600", marginLeft: 8 }}>{t("posBridgeTestPrint")}</Text>
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
            {Platform.OS === "ios" ? t("posBridgeHintIos") : t("posBridgeHintAndroid")}
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
