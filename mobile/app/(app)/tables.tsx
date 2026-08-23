import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import { useNavigation } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { supabase } from "@/src/services/supabase";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { StatusToast, type ToastPayload, type ToastTone } from "@/src/components/StatusToast";
import { DeleteConfirmModal } from "@/src/components/DeleteConfirmModal";
import { useFormSheetAboveKeyboard } from "@/src/hooks/useKeyboardBottomInset";

type Table = {
  id: string;
  table_number: number;
  table_name?: string | null;
  map_x?: number | null;
  map_y?: number | null;
};

const CUSTOMER_PORT = 5174;
const TABLE_SIZE = 60;
const MAP_PAD = 4;
const FLOOR_W = 1600;
const FLOOR_H = 1100;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.2;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

function getCustomerPort() {
  const url =
    Constants.expoConfig?.extra?.customerAppUrl ??
    process.env.EXPO_PUBLIC_CUSTOMER_APP_URL;
  if (!url) return CUSTOMER_PORT;
  try {
    const p = new URL(url).port;
    return p ? parseInt(p, 10) : CUSTOMER_PORT;
  } catch {
    return CUSTOMER_PORT;
  }
}

function isPrivateOrLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(hostname)
  );
}

function getDevLanIp(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const host = candidate.split(":")[0]?.trim();
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return host;
    }
  }
  return null;
}

function resolveCustomerBaseUrl(): string {
  const envUrl = (
    Constants.expoConfig?.extra?.customerAppUrl ??
    process.env.EXPO_PUBLIC_CUSTOMER_APP_URL ??
    ""
  ).replace(/\/$/, "");

  const lanIp = getDevLanIp();
  const port = getCustomerPort();

  let envIsDeployed = false;
  if (envUrl) {
    try {
      envIsDeployed = !isPrivateOrLocalHost(new URL(envUrl).hostname);
    } catch {
      envIsDeployed = false;
    }
  }

  if (envIsDeployed) return envUrl;
  if (lanIp) return `http://${lanIp}:${port}`;
  if (envUrl) return envUrl;
  return `http://localhost:${port}`;
}

function formatTableLabel(tableNumber: number, tableName?: string | null) {
  if (tableName?.trim()) return `${tableName.trim()} ${tableNumber}`;
  return `Table ${tableNumber}`;
}

function defaultPixelPos(index: number, mapW: number, mapH: number) {
  const cols = Math.max(1, Math.floor((mapW - MAP_PAD * 2) / (TABLE_SIZE + 14)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = MAP_PAD + col * (TABLE_SIZE + 14);
  const y = MAP_PAD + row * (TABLE_SIZE + 14);
  return {
    x: Math.min(x, Math.max(MAP_PAD, mapW - TABLE_SIZE - MAP_PAD)),
    y: Math.min(y, Math.max(MAP_PAD, mapH - TABLE_SIZE - MAP_PAD)),
  };
}

function pctToPx(pct: number | null | undefined, size: number, fallback: number) {
  if (pct == null || Number.isNaN(Number(pct))) return fallback;
  return (Number(pct) / 100) * size;
}

function pxToPct(px: number, size: number) {
  if (size <= 0) return 0;
  return Math.round((px / size) * 10000) / 100;
}

type FloorTableProps = {
  table: Table;
  index: number;
  zoom: number;
  colors: { text: string; surface: string; sidebarOrange: string };
  isLight: boolean;
  onMoveEnd: (id: string, xPct: number, yPct: number) => void;
  onDragChange: (dragging: boolean) => void;
};

function FloorTableNode({
  table,
  index,
  zoom,
  colors,
  isLight,
  onMoveEnd,
  onDragChange,
}: FloorTableProps) {
  const { t } = useLanguage();
  const size = TABLE_SIZE * zoom;
  const fallback = defaultPixelPos(index, FLOOR_W, FLOOR_H);
  const logicalX = pctToPx(table.map_x, FLOOR_W, fallback.x);
  const logicalY = pctToPx(table.map_y, FLOOR_H, fallback.y);

  const translateX = useSharedValue(logicalX * zoom);
  const translateY = useSharedValue(logicalY * zoom);
  const startX = useSharedValue(logicalX * zoom);
  const startY = useSharedValue(logicalY * zoom);
  const dragging = useSharedValue(0);
  const maxX = Math.max(0, FLOOR_W * zoom - size);
  const maxY = Math.max(0, FLOOR_H * zoom - size);

  useEffect(() => {
    translateX.value = pctToPx(table.map_x, FLOOR_W, fallback.x) * zoom;
    translateY.value = pctToPx(table.map_y, FLOOR_H, fallback.y) * zoom;
  }, [
    table.map_x,
    table.map_y,
    zoom,
    fallback.x,
    fallback.y,
    translateX,
    translateY,
  ]);

  const hapticStart = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const setDraggingJS = useCallback(
    (next: boolean) => {
      onDragChange(next);
    },
    [onDragChange]
  );

  const finishMove = useCallback(
    (x: number, y: number) => {
      const logicalMoveX = zoom > 0 ? x / zoom : x;
      const logicalMoveY = zoom > 0 ? y / zoom : y;
      const clampedX = Math.min(FLOOR_W - TABLE_SIZE, Math.max(0, logicalMoveX));
      const clampedY = Math.min(FLOOR_H - TABLE_SIZE, Math.max(0, logicalMoveY));
      onMoveEnd(table.id, pxToPct(clampedX, FLOOR_W), pxToPct(clampedY, FLOOR_H));
    },
    [onMoveEnd, table.id, zoom]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(280)
        .maxPointers(1)
        .onStart(() => {
          dragging.value = 1;
          startX.value = translateX.value;
          startY.value = translateY.value;
          runOnJS(hapticStart)();
          runOnJS(setDraggingJS)(true);
        })
        .onUpdate((e) => {
          translateX.value = Math.min(maxX, Math.max(0, startX.value + e.translationX));
          translateY.value = Math.min(maxY, Math.max(0, startY.value + e.translationY));
        })
        .onEnd(() => {
          dragging.value = 0;
          runOnJS(finishMove)(translateX.value, translateY.value);
          runOnJS(setDraggingJS)(false);
        })
        .onFinalize(() => {
          dragging.value = 0;
          runOnJS(setDraggingJS)(false);
        }),
    [
      maxX,
      maxY,
      hapticStart,
      finishMove,
      setDraggingJS,
      dragging,
      startX,
      startY,
      translateX,
      translateY,
    ]
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: dragging.value ? 1.06 : 1 },
    ],
    zIndex: dragging.value ? 20 : 1,
    opacity: dragging.value ? 0.95 : 1,
  }));

  const label = formatTableLabel(table.table_number, table.table_name);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size,
          },
          style,
        ]}
        accessibilityLabel={label}
      >
        <FloorTableCard
          style={{
            backgroundColor: isLight ? "#fff" : colors.surface,
            borderColor: colors.sidebarOrange,
          }}
        >
          <FloorTableNumber
            style={{ color: colors.sidebarOrange, fontSize: 15 * Math.min(zoom, 1.15) }}
          >
            {table.table_number}
          </FloorTableNumber>
          <FloorTableName
            style={{ color: colors.text, fontSize: 9 * Math.min(zoom, 1.15) }}
            numberOfLines={1}
          >
            {table.table_name?.trim() || t("table")}
          </FloorTableName>
        </FloorTableCard>
      </Animated.View>
    </GestureDetector>
  );
}

export default function Tables() {
  const navigation = useNavigation();
  const { restaurant } = useRestaurant();
  const { colors, theme } = useTheme();
  const { t } = useLanguage();
  const isLight = theme === "light";
  const hairline = isLight ? "rgba(28, 25, 23, 0.08)" : colors.containerBorder;
  const silverBorder = isLight ? "rgba(148, 163, 184, 0.55)" : "rgba(168, 162, 158, 0.35)";
  const { width } = useWindowDimensions();
  const formSheetKeyboardStyle = useFormSheetAboveKeyboard(200, 12);
  const isTablet = width >= 900;
  const gridGap = 12;
  const screenHorizontalPadding = 32;
  const columns = isTablet ? 6 : 2;
  const cardWidth = Math.max(
    120,
    (width - screenHorizontalPadding - gridGap * (columns - 1)) / columns
  );

  const [tables, setTables] = useState<Table[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [mapReady, setMapReady] = useState(false);
  const [draggingTable, setDraggingTable] = useState(false);
  const pinchBaseZoom = useRef(1);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState("");
  const [tableName, setTableName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const [tablePendingDelete, setTablePendingDelete] = useState<Table | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const toastSeq = useRef(0);
  const qrRefs = useRef<Record<string, { toDataURL: (cb: (url: string) => void) => void } | null>>({});

  const showToast = (message: string, tone: ToastTone = "success") => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, message, tone });
  };

  const baseUrl = resolveCustomerBaseUrl();

  const buildUrl = (tableId: string) =>
    restaurant?.id ? `${baseUrl}/r/${restaurant.id}/t/${tableId}` : "";

  const loadTables = useCallback(async () => {
    if (!restaurant?.id) return;
    const { data, error } = await supabase
      .from("tables")
      .select("id, table_number, table_name, map_x, map_y")
      .eq("restaurant_id", restaurant.id)
      .order("table_number", { ascending: true });
    if (error) {
      // Fallback if migration not applied yet
      const fallback = await supabase
        .from("tables")
        .select("id, table_number, table_name")
        .eq("restaurant_id", restaurant.id)
        .order("table_number", { ascending: true });
      if (fallback.error) {
        Alert.alert(t("tablesLoadFail"), fallback.error.message);
        return;
      }
      setTables(fallback.data ?? []);
      return;
    }
    setTables(data ?? []);
  }, [restaurant?.id, t]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const closeTableModal = () => {
    setTableModalOpen(false);
    setEditingTableId(null);
    setErrorMessage("");
  };

  const openAddTableModal = () => {
    setEditingTableId(null);
    setTableNumber("");
    setTableName("");
    setErrorMessage("");
    setTableModalOpen(true);
  };

  const openEditTableModal = (table: Table) => {
    setEditingTableId(table.id);
    setTableNumber(String(table.table_number ?? ""));
    setTableName(table.table_name ?? "");
    setErrorMessage("");
    setTableModalOpen(true);
  };

  const isEditing = editingTableId != null;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRightContainerStyle: {
        paddingRight: 6,
        paddingVertical: 2,
      },
      headerRight: () => (
        <HeaderAddButton
          onPress={openAddTableModal}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={t("tablesAddTable")}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </HeaderAddButton>
      ),
    });
  }, [navigation, t]);

  const nextMapSlot = () => {
    const pos = defaultPixelPos(tables.length, FLOOR_W, FLOOR_H);
    return {
      map_x: pxToPct(pos.x, FLOOR_W),
      map_y: pxToPct(pos.y, FLOOR_H),
    };
  };

  const handleSubmitTable = async () => {
    if (!restaurant?.id) {
      setErrorMessage(t("tablesErrorSignIn"));
      return;
    }
    const num = Number(tableNumber.trim());
    if (!Number.isInteger(num) || num < 1) {
      setErrorMessage(t("tablesErrorValidNumber"));
      return;
    }
    setLoading(true);
    setErrorMessage("");

    const payload: Record<string, unknown> = {
      table_number: num,
      table_name: tableName.trim() || null,
    };

    if (!editingTableId) {
      Object.assign(payload, nextMapSlot());
    }

    const { error } = editingTableId
      ? await supabase.from("tables").update(payload).eq("id", editingTableId)
      : await supabase.from("tables").insert({
          restaurant_id: restaurant.id,
          ...payload,
        });

    setLoading(false);
    if (error) {
      // Retry insert without map fields if columns missing
      if (!editingTableId && /map_x|map_y|column/i.test(error.message)) {
        const retry = await supabase.from("tables").insert({
          restaurant_id: restaurant.id,
          table_number: num,
          table_name: tableName.trim() || null,
        });
        if (retry.error) {
          setErrorMessage(retry.error.message);
          return;
        }
      } else {
        setErrorMessage(error.message);
        return;
      }
    }
    const wasEditing = editingTableId != null;
    closeTableModal();
    setTableNumber("");
    setTableName("");
    await loadTables();
    showToast(wasEditing ? t("tablesToastUpdated") : t("tablesToastAdded"));
  };

  const handleDeletePress = (table: Table) => {
    setTablePendingDelete(table);
  };

  const closeDeleteConfirm = () => {
    if (deleteLoading) return;
    setTablePendingDelete(null);
  };

  const confirmDeleteTable = async () => {
    if (!tablePendingDelete || !restaurant?.id) return;
    const table = tablePendingDelete;

    setDeleteLoading(true);
    const { error: unlinkError } = await supabase
      .from("orders")
      .update({ table_id: null })
      .eq("table_id", table.id);

    if (unlinkError) {
      setDeleteLoading(false);
      showToast(unlinkError.message || t("tablesToastDeleteFail"), "muted");
      return;
    }

    const { data, error } = await supabase
      .from("tables")
      .delete()
      .eq("id", table.id)
      .eq("restaurant_id", restaurant.id)
      .select("id");

    setDeleteLoading(false);

    if (error) {
      showToast(error.message || t("tablesToastDeleteFail"), "muted");
      return;
    }
    if (!data?.length) {
      showToast(t("tablesToastDeleteFail"), "muted");
      return;
    }

    setTablePendingDelete(null);
    delete qrRefs.current[table.id];
    await loadTables();
    showToast(t("tablesToastDeleted"));
  };

  const handleMoveEnd = async (id: string, xPct: number, yPct: number) => {
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, map_x: xPct, map_y: yPct } : t))
    );
    const { error } = await supabase
      .from("tables")
      .update({ map_x: xPct, map_y: yPct })
      .eq("id", id);
    if (error) {
      showToast(error.message || t("tablesToastSavePosFail"), "muted");
      await loadTables();
    }
  };

  const handleDownloadQR = async (tableId: string, tableNumber: number) => {
    const svgRef = qrRefs.current[tableId];
    if (!svgRef?.toDataURL) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("permissionNeeded"), t("tablesPermissionBody"));
        return;
      }
      svgRef.toDataURL((dataUrl: string) => {
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        const filename = `table-${tableNumber}-qr.png`;
        const fileUri = `${FileSystem.cacheDirectory ?? ""}${filename}`;
        if (!FileSystem.cacheDirectory) {
          Alert.alert(t("error"), t("tablesFsFail"));
          return;
        }
        FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 })
          .then(() => MediaLibrary.createAssetAsync(fileUri))
          .then(() => Alert.alert(t("saved"), t("tablesSavedBody")))
          .catch((err) => Alert.alert(t("error"), (err as Error).message || t("tablesSaveQrFail")));
      });
    } catch (err) {
      Alert.alert(t("error"), (err as Error).message || t("tablesSaveQrFail"));
    }
  };

  const onMapLayout = () => {
    setMapReady(true);
  };

  const zoomIn = () => setZoom((z) => clampZoom(z + ZOOM_STEP));
  const zoomOut = () => setZoom((z) => clampZoom(z - ZOOM_STEP));

  const capturePinchBase = useCallback(() => {
    pinchBaseZoom.current = zoom;
  }, [zoom]);

  const applyPinchScale = useCallback((scale: number) => {
    setZoom(clampZoom(pinchBaseZoom.current * scale));
  }, []);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          runOnJS(capturePinchBase)();
        })
        .onUpdate((e) => {
          runOnJS(applyPinchScale)(e.scale);
        }),
    [capturePinchBase, applyPinchScale]
  );

  const canvasW = FLOOR_W * zoom;
  const canvasH = FLOOR_H * zoom;

  return (
    <Screen style={{ backgroundColor: colors.bg }}>
      <ViewModeBar
        style={{
          borderBottomColor: silverBorder,
          backgroundColor: colors.surface,
        }}
      >
        <ViewModeCopy>
          <ViewModeTitle style={{ color: colors.text }}>
            {showQr ? t("tablesQrCodes") : t("tablesFloorMap")}
          </ViewModeTitle>
          <ViewModeHint style={{ color: colors.textMuted }}>
            {showQr ? t("tablesHintQr") : t("tablesHintMap")}
          </ViewModeHint>
        </ViewModeCopy>
        <ViewModeToggleBtn
          onPress={() => setShowQr((prev) => !prev)}
          activeOpacity={0.85}
          style={{
            borderColor: silverBorder,
            backgroundColor: colors.surface,
          }}
          accessibilityRole="button"
          accessibilityLabel={showQr ? t("tablesShowFloorMap") : t("tablesShowQr")}
        >
          <Ionicons
            name={showQr ? "map-outline" : "qr-code-outline"}
            size={16}
            color={colors.sidebarOrange}
          />
          <ViewModeToggleText style={{ color: colors.text }}>
            {showQr ? t("tablesFloorMap") : t("tablesQrCodes")}
          </ViewModeToggleText>
        </ViewModeToggleBtn>
      </ViewModeBar>

      {showQr ? (
        <Container contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <TableGrid>
            {tables.map((table) => (
              <TableCard
                key={table.id}
                style={{
                  backgroundColor: colors.surface,
                  width: cardWidth,
                  borderColor: silverBorder,
                  elevation: 0,
                  shadowOpacity: 0,
                }}
              >
                <QRWrapper
                  style={{
                    backgroundColor: "#ffffff",
                    borderColor: silverBorder,
                    elevation: 0,
                    shadowOpacity: 0,
                  }}
                  pointerEvents="box-none"
                >
                  {buildUrl(table.id) ? (
                    <QRCode
                      getRef={(ref) => {
                        qrRefs.current[table.id] = ref as {
                          toDataURL: (cb: (url: string) => void) => void;
                        } | null;
                      }}
                      value={buildUrl(table.id)}
                      size={120}
                      quietZone={12}
                      backgroundColor="#ffffff"
                      color="#1a1a2e"
                      ecl="H"
                    />
                  ) : null}
                </QRWrapper>
                <TableTitle style={{ color: colors.text }}>
                  {formatTableLabel(table.table_number, table.table_name)}
                </TableTitle>
                <UrlText style={{ color: colors.textMuted }} numberOfLines={2}>
                  {buildUrl(table.id)}
                </UrlText>
                <Actions>
                  <DownloadBtn onPress={() => handleDownloadQR(table.id, table.table_number)}>
                    <Ionicons name="download-outline" size={16} color="#fff" />
                    <DownloadBtnText>{t("tablesDownload")}</DownloadBtnText>
                  </DownloadBtn>
                  <IconBtn onPress={() => openEditTableModal(table)}>
                    <Ionicons name="pencil" size={14} color={colors.text} />
                  </IconBtn>
                  <DangerIconBtn
                    onPress={() => handleDeletePress(table)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel={`Delete ${formatTableLabel(table.table_number, table.table_name)}`}
                  >
                    <Ionicons name="trash" size={16} color={colors.danger} />
                  </DangerIconBtn>
                </Actions>
              </TableCard>
            ))}
          </TableGrid>
        </Container>
      ) : (
        <MapWrap style={{ padding: 12 }}>
          <FloorMap
            onLayout={onMapLayout}
            style={{
              backgroundColor: isLight ? "#f3f5f7" : colors.surface2,
              borderColor: silverBorder,
            }}
          >
            <GestureDetector gesture={pinchGesture}>
              <Animated.View style={{ flex: 1 }}>
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{
                    width: canvasW,
                    height: canvasH,
                  }}
                  scrollEnabled={!draggingTable}
                  bounces
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                >
                  <MapCanvas style={{ width: canvasW, height: canvasH }}>
                    <MapGridOverlay pointerEvents="none">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <MapGridLine
                          key={`h-${i}`}
                          style={{
                            top: `${((i + 1) / 11) * 100}%`,
                            backgroundColor: isLight
                              ? "rgba(148, 163, 184, 0.18)"
                              : "rgba(168, 162, 158, 0.14)",
                          }}
                        />
                      ))}
                      {Array.from({ length: 14 }).map((_, i) => (
                        <MapGridCol
                          key={`v-${i}`}
                          style={{
                            left: `${((i + 1) / 15) * 100}%`,
                            backgroundColor: isLight
                              ? "rgba(148, 163, 184, 0.18)"
                              : "rgba(168, 162, 158, 0.14)",
                          }}
                        />
                      ))}
                    </MapGridOverlay>

                    {mapReady &&
                      tables.map((table, index) => (
                        <FloorTableNode
                          key={table.id}
                          table={table}
                          index={index}
                          zoom={zoom}
                          colors={colors}
                          isLight={isLight}
                          onMoveEnd={handleMoveEnd}
                          onDragChange={setDraggingTable}
                        />
                      ))}

                    {!tables.length ? (
                      <EmptyMapHint style={{ color: colors.textMuted }}>
                        {t("tablesEmptyMap")}
                      </EmptyMapHint>
                    ) : null}
                  </MapCanvas>
                </ScrollView>
              </Animated.View>
            </GestureDetector>

            <ZoomControls pointerEvents="box-none">
              <ZoomBtn
                onPress={zoomOut}
                disabled={zoom <= MIN_ZOOM}
                activeOpacity={0.8}
                style={{
                  borderColor: silverBorder,
                  backgroundColor: isLight ? "#fff" : colors.surface,
                  opacity: zoom <= MIN_ZOOM ? 0.45 : 1,
                }}
                accessibilityLabel={t("tablesZoomOut")}
              >
                <Ionicons name="remove" size={20} color={colors.text} />
              </ZoomBtn>
              <ZoomLevel style={{ color: colors.textMuted }}>
                {Math.round(zoom * 100)}%
              </ZoomLevel>
              <ZoomBtn
                onPress={zoomIn}
                disabled={zoom >= MAX_ZOOM}
                activeOpacity={0.8}
                style={{
                  borderColor: silverBorder,
                  backgroundColor: isLight ? "#fff" : colors.surface,
                  opacity: zoom >= MAX_ZOOM ? 0.45 : 1,
                }}
                accessibilityLabel={t("tablesZoomIn")}
              >
                <Ionicons name="add" size={20} color={colors.text} />
              </ZoomBtn>
            </ZoomControls>
          </FloorMap>
        </MapWrap>
      )}

      <Modal
        visible={tableModalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeTableModal}
      >
        <FormOverlay>
          <Pressable style={{ flex: 1 }} onPress={closeTableModal} />
          <FormSheet
            style={{
              backgroundColor: colors.surface,
              borderColor: hairline,
              ...formSheetKeyboardStyle,
            }}
          >
            <FormHandle
              style={{
                backgroundColor: isLight ? "rgba(28,25,23,0.12)" : "rgba(255,255,255,0.2)",
              }}
            />
            <FormHeader>
              <FormTitle style={{ color: colors.text }}>
                {isEditing ? t("tablesEditTable") : t("tablesAddTable")}
              </FormTitle>
              <FormClose onPress={closeTableModal} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </FormClose>
            </FormHeader>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
            >
              <FormField>
                <FormLabel style={{ color: colors.textMuted }}>{t("tablesTableNumber")}</FormLabel>
                <FormInput
                  style={{
                    backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                    color: colors.text,
                    borderColor: hairline,
                  }}
                  value={tableNumber}
                  onChangeText={setTableNumber}
                  placeholder={t("tablesNumberPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  autoFocus={!isEditing}
                />
              </FormField>

              <FormField>
                <FormLabel style={{ color: colors.textMuted }}>{t("tablesNameOptional")}</FormLabel>
                <FormInput
                  style={{
                    backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                    color: colors.text,
                    borderColor: hairline,
                  }}
                  value={tableName}
                  onChangeText={setTableName}
                  placeholder={t("tablesNamePlaceholder")}
                  placeholderTextColor={colors.textMuted}
                />
              </FormField>

              {errorMessage ? (
                <ErrorText style={{ color: colors.danger }}>{errorMessage}</ErrorText>
              ) : null}

              <FormActions>
                <FormCancelBtn
                  onPress={closeTableModal}
                  style={{
                    borderColor: hairline,
                    backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                  }}
                >
                  <FormCancelText style={{ color: colors.text }}>{t("cancel")}</FormCancelText>
                </FormCancelBtn>
                <FormSaveBtn onPress={handleSubmitTable} disabled={loading}>
                  <FormSaveText>
                    {loading
                      ? isEditing
                        ? t("saving")
                        : t("adding")
                      : isEditing
                        ? t("save")
                        : t("tablesAddTable")}
                  </FormSaveText>
                </FormSaveBtn>
              </FormActions>
            </ScrollView>
          </FormSheet>
        </FormOverlay>
      </Modal>

      <DeleteConfirmModal
        visible={tablePendingDelete != null}
        title={t("tablesDeleteTitle")}
        message={
          tablePendingDelete
            ? t("tablesDeleteMessage", {
                label: formatTableLabel(
                  tablePendingDelete.table_number,
                  tablePendingDelete.table_name
                ),
              })
            : ""
        }
        loading={deleteLoading}
        onCancel={closeDeleteConfirm}
        onConfirm={confirmDeleteTable}
        colors={colors}
        isLight={isLight}
        hairline={hairline}
      />

      <StatusToast toast={toast} onHide={() => setToast(null)} />
    </Screen>
  );
}

const Screen = styled.View`
  flex: 1;
`;

const ViewModeBar = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom-width: 1px;
`;

const ViewModeCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 2px;
`;

const ViewModeTitle = styled.Text`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const ViewModeHint = styled.Text`
  font-size: 12px;
  font-weight: 500;
`;

const ViewModeToggleBtn = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  border-width: 1px;
  border-radius: 12px;
  padding: 8px 12px;
`;

const ViewModeToggleText = styled.Text`
  font-size: 13px;
  font-weight: 800;
`;

const MapWrap = styled.View`
  flex: 1;
  min-height: 0;
`;

const FloorMap = styled.View`
  flex: 1;
  border-width: 1px;
  border-radius: 22px;
  overflow: hidden;
  min-height: 420px;
`;

const MapCanvas = styled.View`
  position: relative;
`;

const ZoomControls = styled.View`
  position: absolute;
  right: 12px;
  bottom: 12px;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const ZoomBtn = styled.TouchableOpacity`
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const ZoomLevel = styled.Text`
  min-width: 40px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
`;

const MapGridOverlay = styled.View`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`;

const MapGridLine = styled.View`
  position: absolute;
  left: 0;
  right: 0;
  height: ${StyleSheet.hairlineWidth}px;
`;

const MapGridCol = styled.View`
  position: absolute;
  top: 0;
  bottom: 0;
  width: ${StyleSheet.hairlineWidth}px;
`;

const EmptyMapHint = styled.Text`
  position: absolute;
  align-self: center;
  top: 46%;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  padding: 0 24px;
`;

const FloorTableCard = styled.View`
  flex: 1;
  border-radius: 18px;
  border-width: 1.5px;
  align-items: center;
  justify-content: center;
  padding: 6px;
  gap: 2px;
  ${Platform.OS === "ios"
    ? `
    shadow-color: #1c1917;
    shadow-opacity: 0.08;
    shadow-radius: 6px;
    shadow-offset: 0px 2px;
  `
    : `
    elevation: 0;
  `}
`;

const FloorTableNumber = styled.Text`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.3px;
`;

const FloorTableName = styled.Text`
  font-size: 9px;
  font-weight: 600;
  max-width: 100%;
`;

const Container = styled.ScrollView`
  flex: 1;
`;
const HeaderAddButton = styled.TouchableOpacity`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  align-items: center;
  justify-content: center;
  background: #ff6600;
`;

const FormOverlay = styled.View`
  flex: 1;
  background: rgba(0, 0, 0, 0.45);
  justify-content: flex-end;
`;
const FormSheet = styled.View`
  width: 100%;
  max-height: 85%;
  flex-shrink: 1;
  border-top-left-radius: 28px;
  border-top-right-radius: 28px;
  border-width: 1px;
  border-bottom-width: 0;
  overflow: hidden;
`;
const FormHandle = styled.View`
  align-self: center;
  width: 40px;
  height: 4px;
  border-radius: 999px;
  margin-top: 10px;
  margin-bottom: 4px;
`;
const FormHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 8px 20px 12px;
`;
const FormTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.3px;
`;
const FormClose = styled.TouchableOpacity`
  position: absolute;
  right: 16px;
  top: 4px;
  width: 36px;
  height: 36px;
  border-radius: 18px;
  align-items: center;
  justify-content: center;
`;
const FormField = styled.View`
  margin-bottom: 14px;
  gap: 6px;
`;
const FormLabel = styled.Text`
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.1px;
`;
const FormInput = styled.TextInput`
  border-radius: 16px;
  padding: 14px 16px;
  border-width: 1px;
  font-size: 15px;
  font-weight: 500;
`;
const ErrorText = styled.Text`
  font-size: 13px;
  margin-bottom: 8px;
`;
const FormActions = styled.View`
  flex-direction: row;
  gap: 10px;
  margin-top: 8px;
`;
const FormCancelBtn = styled.TouchableOpacity`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 14px 16px;
  border-radius: 999px;
  border-width: 1px;
`;
const FormCancelText = styled.Text`
  font-size: 15px;
  font-weight: 800;
`;
const FormSaveBtn = styled.TouchableOpacity<{ disabled?: boolean }>`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 14px 16px;
  border-radius: 999px;
  background: #ff6600;
  opacity: ${(p) => (p.disabled ? 0.6 : 1)};
`;
const FormSaveText = styled.Text`
  color: #fff;
  font-size: 15px;
  font-weight: 800;
`;

const TableGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-start;
`;
const TableCard = styled.View`
  flex: 0 1 auto;
  min-width: 0;
  padding: 16px;
  border-radius: 16px;
  border-width: 1px;
  align-items: center;
`;
const QRWrapper = styled.View`
  padding: 12px;
  border-radius: 12px;
  border-width: 1px;
  margin-bottom: 12px;
`;
const TableTitle = styled.Text`
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 4px;
`;
const UrlText = styled.Text`
  font-size: 10px;
  text-align: center;
  margin-bottom: 12px;
`;
const Actions = styled.View`
  flex-direction: row;
  gap: 6px;
  align-items: center;
`;
const DownloadBtn = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #ff6600;
`;
const DownloadBtnText = styled.Text`
  color: #fff;
  font-size: 12px;
  font-weight: 700;
`;
const IconBtn = styled.TouchableOpacity`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
  background: rgba(28, 25, 23, 0.06);
`;
const DangerIconBtn = styled.TouchableOpacity`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
  border-width: ${StyleSheet.hairlineWidth}px;
  border-color: rgba(239, 68, 68, 0.5);
`;
