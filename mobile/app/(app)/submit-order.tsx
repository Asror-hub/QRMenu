import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/src/services/supabase";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { useOrders, type Order, type OrderItem } from "@/src/context/OrdersContext";
import { formatCurrency } from "@/src/utils/currency";
import { printOrderTicket } from "@/src/utils/receiptPrint";
import { PlanGate } from "@/src/components/PlanGate";

type Category = {
  id: string;
  name: string | null;
  available?: boolean | null;
  order_index?: number | null;
};

type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  available?: boolean | null;
  sold_out?: boolean | null;
  category_id: string;
};

/** TEMP: flip to false / delete this block when demo data is no longer needed. */
const USE_DEMO_MENU_DATA = true;

const DEMO_CATEGORY_NAMES = [
  "Appetizers",
  "Salads",
  "Soups",
  "Pasta",
  "Grill",
  "Seafood",
  "Sides",
  "Desserts Extra",
  "Breakfast",
  "Burgers",
  "Pizza",
  "Wraps",
  "Kids Menu",
  "Beverages Plus",
  "Coffee Bar",
  "Chef Specials",
] as const;

const DEMO_ITEM_NAMES_BY_CATEGORY: Record<string, string[]> = {
  Appetizers: [
    "Bruschetta",
    "Mozzarella Sticks",
    "Stuffed Mushrooms",
    "Chicken Wings",
    "Nachos",
    "Spring Rolls",
    "Calamari",
    "Hummus Plate",
  ],
  Salads: [
    "Caesar Salad",
    "Greek Salad",
    "Garden Salad",
    "Cobb Salad",
    "Caprese",
    "Quinoa Bowl",
    "Spinach Salad",
    "Waldorf Salad",
  ],
  Soups: [
    "Tomato Soup",
    "Chicken Noodle",
    "Mushroom Cream",
    "Lentil Soup",
    "Clam Chowder",
    "Onion Soup",
    "Minestrone",
    "Pumpkin Soup",
  ],
  Pasta: [
    "Spaghetti Carbonara",
    "Penne Arrabbiata",
    "Fettuccine Alfredo",
    "Lasagna",
    "Pesto Linguine",
    "Seafood Pasta",
    "Bolognese",
    "Ravioli",
  ],
  Grill: [
    "Grilled Steak",
    "BBQ Ribs",
    "Chicken Skewer",
    "Lamb Chops",
    "Mixed Grill",
    "Grilled Sausage",
    "Pork Chop",
    "Turkey Steak",
  ],
  Seafood: [
    "Salmon Fillet",
    "Fish & Chips",
    "Shrimp Scampi",
    "Grilled Sea Bass",
    "Lobster Tail",
    "Crab Cakes",
    "Tuna Steak",
    "Mussels Pot",
  ],
  Sides: [
    "Garlic Bread",
    "Fries",
    "Mashed Potato",
    "Coleslaw",
    "Rice Pilaf",
    "Grilled Veggies",
    "Onion Rings",
    "Sweet Potato Fries",
  ],
  "Desserts Extra": [
    "Tiramisu Cup",
    "Chocolate Cake",
    "Cheesecake",
    "Ice Cream Trio",
    "Fruit Tart",
    "Brownie",
    "Panna Cotta",
    "Apple Pie",
  ],
  Breakfast: [
    "Eggs Benedict",
    "Pancake Stack",
    "Avocado Toast",
    "Omelette",
    "French Toast",
    "Breakfast Burrito",
    "Granola Bowl",
    "Shakshuka",
  ],
  Burgers: [
    "Classic Burger",
    "Cheese Burger",
    "Bacon Burger",
    "Veggie Burger",
    "Chicken Burger",
    "Double Smash",
    "Mushroom Swiss",
    "Spicy Jalapeño",
  ],
  Pizza: [
    "Margherita",
    "Pepperoni",
    "Four Cheese",
    "Veggie Supreme",
    "BBQ Chicken",
    "Hawaiian",
    "Meat Lovers",
    "Truffle Mushroom",
  ],
  Wraps: [
    "Chicken Wrap",
    "Falafel Wrap",
    "Tuna Wrap",
    "Club Wrap",
    "Veggie Wrap",
    "Shawarma Wrap",
    "Caesar Wrap",
    "Steak Wrap",
  ],
  "Kids Menu": [
    "Mini Burger",
    "Chicken Nuggets",
    "Kids Pasta",
    "Fish Fingers",
    "Mac & Cheese",
    "Mini Pizza",
    "Kids Fries",
    "Fruit Cup",
  ],
  "Beverages Plus": [
    "Fresh Lemonade",
    "Iced Tea",
    "Orange Juice",
    "Sparkling Water",
    "Milkshake",
    "Smoothie",
    "Soda",
    "Ginger Beer",
  ],
  "Coffee Bar": [
    "Espresso",
    "Americano",
    "Cappuccino",
    "Latte",
    "Flat White",
    "Mocha",
    "Cold Brew",
    "Hot Chocolate",
  ],
  "Chef Specials": [
    "Truffle Risotto",
    "Duck Confit",
    "Wagyu Slider",
    "Lobster Pasta",
    "Lamb Tagine",
    "Beef Wellington",
    "Catch of the Day",
    "Seasonal Plate",
  ],
};

const DEMO_CATEGORIES: Category[] = DEMO_CATEGORY_NAMES.map((name, index) => ({
  id: `demo-cat-${index + 1}`,
  name,
  available: true,
  order_index: 100 + index,
}));

const DEMO_ITEMS: MenuItem[] = DEMO_CATEGORIES.flatMap((cat, catIndex) => {
  const names =
    DEMO_ITEM_NAMES_BY_CATEGORY[cat.name ?? ""] ??
    Array.from({ length: 8 }, (_, i) => `Demo Item ${i + 1}`);
  return names.slice(0, 8).map((name, itemIndex) => ({
    id: `demo-item-${catIndex + 1}-${itemIndex + 1}`,
    name,
    description: `Demo · ${cat.name}`,
    price: Number((4 + ((catIndex * 8 + itemIndex) % 17) * 1.25).toFixed(2)),
    category_id: cat.id,
    available: true,
  }));
});

type TableRow = {
  id: string;
  table_number: number;
  table_name?: string | null;
  map_x?: number | null;
  map_y?: number | null;
};

type CartLine = {
  /** Unique row key (menu id for new lines, orderId:index for existing). */
  lineKey: string;
  id: string;
  name: string;
  /** Current unit price charged (after override / discount). */
  price: number;
  /** Original menu unit price. */
  basePrice: number;
  quantity: number;
  note?: string;
  /** Percent off basePrice (0–100). Cleared when price is set manually. */
  discountPercent?: number;
  /** Set when this line is from an existing active order on the table. */
  orderId?: string;
  itemIndex?: number;
};

type StoredOrderItem = OrderItem & {
  note?: string;
  discount?: number;
  base_price?: number;
};

type LineEditField = "note" | "price" | "discount";

const ORDER_MENU_STAGGER_MS = 30;
const ORDER_MENU_ITEM_MS = 180;
const ORDER_MENU_ITEM_SIZE = 48;
const ORDER_MENU_GAP = 12;
const ORDER_MENU_COUNT = 5;
const ORDER_MENU_BOTTOM_OFFSET = 24;
const ORDER_MENU_EDGE_PAD = 12;

type FloatingMenuPlacement = "above" | "below";

function orderMenuBlockHeight(count = ORDER_MENU_COUNT) {
  return count * ORDER_MENU_ITEM_SIZE + Math.max(0, count - 1) * ORDER_MENU_GAP;
}

function resolveFloatingMenuPlacement(
  anchorY: number,
  anchorHeight: number,
  itemCount: number,
  screenHeight: number
): FloatingMenuPlacement {
  const needed = orderMenuBlockHeight(itemCount) + ORDER_MENU_BOTTOM_OFFSET;
  const spaceAbove = Math.max(0, anchorY - ORDER_MENU_EDGE_PAD);
  const spaceBelow = Math.max(
    0,
    screenHeight - (anchorY + anchorHeight) - ORDER_MENU_EDGE_PAD
  );
  if (spaceAbove >= needed) return "above";
  if (spaceBelow >= needed) return "below";
  return spaceAbove >= spaceBelow ? "above" : "below";
}

function floatingMenuStaggerDelay(
  index: number,
  total: number,
  placement: FloatingMenuPlacement,
  mode: "open" | "close"
) {
  // Above: last item is nearest the trigger. Below: first item is nearest.
  // Open fans out from the trigger; close collapses toward it.
  const delayIndex =
    placement === "above"
      ? mode === "open"
        ? total - 1 - index
        : index
      : mode === "open"
        ? index
        : total - 1 - index;
  return delayIndex * ORDER_MENU_STAGGER_MS;
}

function StaggerMenuOption({
  progress,
  disabled,
  onPress,
  children,
}: {
  progress: SharedValue<number>;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value * (disabled ? 0.45 : 1),
  }));

  return (
    <Animated.View style={style}>
      <FloatingEditOption
        onPress={onPress}
        activeOpacity={0.85}
        disabled={disabled}
      >
        {children}
      </FloatingEditOption>
    </Animated.View>
  );
}

type RightMode = "map" | "categories" | "items" | "orders";

const FLOOR_W = 1600;
const FLOOR_H = 1100;
const TABLE_SIZE = 60;
const MIN_MAP_ZOOM = 0.5;
const MAX_MAP_ZOOM = 2.5;
const MAP_ZOOM_STEP = 0.2;

function clampMapZoom(value: number) {
  return Math.min(
    MAX_MAP_ZOOM,
    Math.max(MIN_MAP_ZOOM, Math.round(value * 100) / 100)
  );
}

function isActiveOrderStatus(status: string) {
  return status === "pending" || status === "accepted" || status === "ready";
}

function orderLineItems(order: Order) {
  return (order.items ?? []).filter(
    (i) => (i as OrderItem & { type?: string })?.type !== "waiter_call"
  );
}

function orderItemCount(order: Order) {
  return orderLineItems(order).reduce(
    (sum, i) => sum + (Number(i.quantity ?? 1) || 1),
    0
  );
}

function orderTotal(order: Order) {
  return orderLineItems(order).reduce((sum, i) => {
    const price = Number(i.price ?? 0) || 0;
    const qty = Number(i.quantity ?? 1) || 1;
    return sum + price * qty;
  }, 0);
}

function formatAmount(amount: number | string | null | undefined) {
  const value = Number(amount ?? 0);
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}

function formatMapOrderTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isWaiterCallOrder(order: Order) {
  return (order.items ?? []).some(
    (item: OrderItem & { type?: string }) => item?.type === "waiter_call"
  );
}

function isAvailable(value: boolean | null | undefined) {
  return value !== false;
}

function isSoldOut(value: boolean | null | undefined) {
  return value === true;
}

function tableLabel(t: TableRow) {
  return t.table_name?.trim()
    ? `${t.table_name.trim()} ${t.table_number}`
    : `Table ${t.table_number}`;
}

function defaultPos(index: number) {
  const cols = Math.max(1, Math.floor((FLOOR_W - 24) / (TABLE_SIZE + 14)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: 12 + col * (TABLE_SIZE + 14),
    y: 12 + row * (TABLE_SIZE + 14),
  };
}

function pctToPx(pct: number | null | undefined, size: number, fallback: number) {
  if (pct == null || Number.isNaN(Number(pct))) return fallback;
  return (Number(pct) / 100) * size;
}

function buildExistingLinesFromOrders(tableOrders: Order[]): CartLine[] {
  const lines: CartLine[] = [];
  for (const order of tableOrders) {
    for (const [idx, raw] of (order.items ?? []).entries()) {
      const item = raw as StoredOrderItem;
      if (item?.type === "waiter_call") continue;
      const price = Number(item.price ?? 0) || 0;
      const basePrice =
        item.base_price != null && Number.isFinite(Number(item.base_price))
          ? Number(item.base_price)
          : price;
      const discountPercent =
        item.discount != null && Number.isFinite(Number(item.discount))
          ? Number(item.discount)
          : undefined;
      lines.push({
        lineKey: `${order.id}:${idx}`,
        id: String(item.id ?? `${order.id}-${idx}`),
        name: item.name?.trim() || "Item",
        price,
        basePrice,
        quantity: Number(item.quantity ?? 1) || 1,
        note: typeof item.note === "string" && item.note.trim() ? item.note : undefined,
        discountPercent,
        orderId: order.id,
        itemIndex: idx,
      });
    }
  }
  return lines;
}

function toStoredItem(line: CartLine): StoredOrderItem {
  return {
    id: line.id,
    name: line.name,
    quantity: line.quantity,
    price: line.price,
    ...(line.note ? { note: line.note } : null),
    ...(line.discountPercent != null
      ? { discount: line.discountPercent, base_price: line.basePrice }
      : line.price !== line.basePrice
        ? { base_price: line.basePrice }
        : null),
  };
}

function mergeOrderItems(orders: Order[]): StoredOrderItem[] {
  const byId = new Map<string, StoredOrderItem>();
  const withoutId: StoredOrderItem[] = [];

  for (const order of orders) {
    for (const raw of order.items ?? []) {
      const item = raw as StoredOrderItem;
      if (item?.type === "waiter_call") continue;
      const id = item.id != null ? String(item.id) : "";
      if (!id) {
        withoutId.push({ ...item, quantity: Number(item.quantity ?? 1) || 1 });
        continue;
      }
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, {
          ...item,
          id,
          quantity: Number(item.quantity ?? 1) || 1,
          price: Number(item.price ?? 0) || 0,
        });
        continue;
      }
      byId.set(id, {
        ...prev,
        quantity: (Number(prev.quantity ?? 0) || 0) + (Number(item.quantity ?? 0) || 0),
        note: [prev.note, item.note].filter(Boolean).join(" · ") || prev.note,
      });
    }
  }

  return [...byId.values(), ...withoutId];
}

function mergeOrderComments(orders: Order[]): string | null {
  const parts = orders
    .map((o) => o.comment?.trim())
    .filter((c): c is string => !!c);
  if (!parts.length) return null;
  return [...new Set(parts)].join(" · ");
}

function SubmitOrderScreen() {
  const navigation = useNavigation();
  const { restaurant } = useRestaurant();
  const { t } = useLanguage();
  const { colors, theme } = useTheme();
  const { orders, loadOrders } = useOrders();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 900;
  const isLight = theme === "light";
  const currency = restaurant?.currency ?? "USD";
  const silverBorder = isLight
    ? "rgba(148, 163, 184, 0.32)"
    : "rgba(168, 162, 158, 0.28)";
  const softFill = isLight ? "rgba(28, 25, 23, 0.03)" : "rgba(255,255,255,0.05)";
  const softFillStrong = isLight
    ? "rgba(28, 25, 23, 0.05)"
    : "rgba(255,255,255,0.08)";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [rightMode, setRightMode] = useState<RightMode>("map");
  const [floorView, setFloorView] = useState<"map" | "orders">("map");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [comment, setComment] = useState("");
  const [orderDiscountPercent, setOrderDiscountPercent] = useState<number | undefined>();
  const [mapZoom, setMapZoom] = useState(1);
  const pinchBaseZoom = useRef(1);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [editLineKey, setEditLineKey] = useState<string | null>(null);
  const [editStep, setEditStep] = useState<LineEditField>("note");
  const [editDrafts, setEditDrafts] = useState({
    note: "",
    price: "",
    discount: "",
  });
  const [savingExisting, setSavingExisting] = useState(false);
  const [orderMenuOpen, setOrderMenuOpen] = useState(false);
  const [orderEditStep, setOrderEditStep] = useState<"menu" | "note" | "discount">("menu");
  const [orderEditDraft, setOrderEditDraft] = useState("");
  const [orderMenuAnchor, setOrderMenuAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [cartDimBounds, setCartDimBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [cartFooterBounds, setCartFooterBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const orderMenuBtnRef = useRef<View | null>(null);
  const cartPaneRef = useRef<View | null>(null);
  const cartFooterRef = useRef<View | null>(null);
  const [orderMenuMounted, setOrderMenuMounted] = useState(false);
  const orderMenuPlacementRef = useRef<FloatingMenuPlacement>("above");
  const orderMenuItem0 = useSharedValue(0);
  const orderMenuItem1 = useSharedValue(0);
  const orderMenuItem2 = useSharedValue(0);
  const orderMenuItem3 = useSharedValue(0);
  const orderMenuItem4 = useSharedValue(0);
  const orderMenuItemAnims = useMemo(
    () => [
      orderMenuItem0,
      orderMenuItem1,
      orderMenuItem2,
      orderMenuItem3,
      orderMenuItem4,
    ],
    [orderMenuItem0, orderMenuItem1, orderMenuItem2, orderMenuItem3, orderMenuItem4]
  );
  const orderMenuClosingRef = useRef(false);
  const cartSheetProgress = useSharedValue(0);
  const cartSheetDragStart = useSharedValue(0);
  const cartSheetVisible = useSharedValue(0);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const isStackedLayout = !isTablet;
  const cartCollapsedH = 62 + (isStackedLayout ? Math.max(insets.bottom, 8) : 0);
  const cartExpandedH = Math.max(
    cartCollapsedH + 120,
    Math.round(height - Math.max(insets.top, 12) - 48)
  );
  const [cartEmptyFocus, setCartEmptyFocus] = useState<{
    title: string;
    hint: string;
  } | null>(null);
  /** When true, hide active table orders in the cart and compose a fresh separate order. */
  const [composingNewOrder, setComposingNewOrder] = useState(false);

  const loadData = useCallback(async () => {
    if (!restaurant?.id) {
      setCategories([]);
      setItems([]);
      setTables([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [catRes, itemRes, tableRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, available, order_index")
        .eq("restaurant_id", restaurant.id)
        .order("order_index", { ascending: true }),
      supabase
        .from("menu_items")
        .select(
          "id, name, description, price, image_url, available, sold_out, category_id, order_index"
        )
        .eq("restaurant_id", restaurant.id)
        .order("order_index", { ascending: true }),
      supabase
        .from("tables")
        .select("id, table_number, table_name, map_x, map_y")
        .eq("restaurant_id", restaurant.id)
        .order("table_number", { ascending: true }),
    ]);

    let nextTables = (tableRes.data as TableRow[]) ?? [];
    if (tableRes.error) {
      const fallback = await supabase
        .from("tables")
        .select("id, table_number, table_name")
        .eq("restaurant_id", restaurant.id)
        .order("table_number", { ascending: true });
      nextTables = (fallback.data as TableRow[]) ?? [];
    }

    const nextCategories = ((catRes.data as Category[]) ?? []).filter((c) =>
      isAvailable(c.available)
    );
    const nextItems = ((itemRes.data as MenuItem[]) ?? []).filter(
      (i) => isAvailable(i.available) && !isSoldOut(i.sold_out)
    );

    // TEMP demo menu — remove when USE_DEMO_MENU_DATA is no longer needed.
    setCategories(
      USE_DEMO_MENU_DATA
        ? [...nextCategories, ...DEMO_CATEGORIES]
        : nextCategories
    );
    setItems(USE_DEMO_MENU_DATA ? [...nextItems, ...DEMO_ITEMS] : nextItems);
    setTables(nextTables);
    setLoading(false);
  }, [restaurant?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const lastActiveOrderAtByTable = useMemo(() => {
    const latest = new Map<string, string>();
    for (const order of orders) {
      if (
        !order.table_id ||
        !isActiveOrderStatus(order.status) ||
        isWaiterCallOrder(order) ||
        !order.created_at
      ) {
        continue;
      }
      const prev = latest.get(order.table_id);
      if (!prev || new Date(order.created_at).getTime() > new Date(prev).getTime()) {
        latest.set(order.table_id, order.created_at);
      }
    }
    return latest;
  }, [orders]);

  const activeOrdersByTable = useMemo(() => {
    type TableBucket = {
      table: TableRow;
      orders: Order[];
      itemCount: number;
      total: number;
    };
    const buckets = new Map<string, TableBucket>();
    for (const order of orders) {
      if (
        !order.table_id ||
        !isActiveOrderStatus(order.status) ||
        isWaiterCallOrder(order)
      ) {
        continue;
      }
      const table = tables.find((t) => t.id === order.table_id);
      if (!table) continue;
      const existing = buckets.get(order.table_id);
      const itemCount = orderItemCount(order);
      const total = orderTotal(order);
      if (existing) {
        existing.orders.push(order);
        existing.itemCount += itemCount;
        existing.total += total;
      } else {
        buckets.set(order.table_id, {
          table,
          orders: [order],
          itemCount,
          total,
        });
      }
    }
    for (const bucket of buckets.values()) {
      bucket.orders.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aTime - bTime;
      });
    }
    return Array.from(buckets.values()).sort(
      (a, b) => a.table.table_number - b.table.table_number
    );
  }, [orders, tables]);

  const activeOrdersSummary = useMemo(() => {
    const tableCount = activeOrdersByTable.length;
    const orderCount = activeOrdersByTable.reduce(
      (sum, bucket) => sum + bucket.orders.length,
      0
    );
    return { tableCount, orderCount };
  }, [activeOrdersByTable]);

  const activeOrderCards = useMemo(
    () =>
      activeOrdersByTable.flatMap(({ table, orders: tableOrders }) =>
        tableOrders.map((order) => ({
          table,
          order,
          itemCount: orderItemCount(order),
          total: orderTotal(order),
          items: orderLineItems(order),
        }))
      ),
    [activeOrdersByTable]
  );

  const activeOrderColumns = useMemo(() => {
    const colCount = 3;
    const cols: (typeof activeOrderCards)[] = Array.from(
      { length: colCount },
      () => []
    );
    const heights = Array.from({ length: colCount }, () => 0);
    for (const card of activeOrderCards) {
      let shortest = 0;
      for (let i = 1; i < heights.length; i += 1) {
        if (heights[i] < heights[shortest]) shortest = i;
      }
      cols[shortest].push(card);
      // Approximate visual weight so short cards pack under each other.
      heights[shortest] += 2 + Math.max(1, card.items.length);
    }
    return cols;
  }, [activeOrderCards]);

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId) ?? null,
    [tables, selectedTableId]
  );

  const activeOrdersForSelectedTable = useMemo(() => {
    if (!selectedTableId) return [] as Order[];
    return orders
      .filter(
        (order) =>
          order.table_id === selectedTableId &&
          isActiveOrderStatus(order.status) &&
          !isWaiterCallOrder(order)
      )
      .slice()
      .sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return at - bt;
      });
  }, [orders, selectedTableId]);

  const canJoinOrders = activeOrdersForSelectedTable.length >= 2;

  // Keep existing table-order lines in the cart (editable), preserve new draft lines.
  // Skip existing lines while composing a separate new order for the same table.
  useEffect(() => {
    const existing =
      selectedTableId && !composingNewOrder
        ? buildExistingLinesFromOrders(activeOrdersForSelectedTable)
        : [];
    setCart((prev) => {
      const newLines = prev.filter((line) => !line.orderId);
      const same =
        existing.length === prev.filter((l) => l.orderId).length &&
        existing.every((line, i) => {
          const cur = prev.filter((l) => l.orderId)[i];
          return (
            cur &&
            cur.lineKey === line.lineKey &&
            cur.quantity === line.quantity &&
            cur.price === line.price &&
            cur.note === line.note &&
            cur.discountPercent === line.discountPercent
          );
        });
      if (same && newLines.length === prev.filter((l) => !l.orderId).length) {
        return prev;
      }
      return [...existing, ...newLines];
    });
  }, [selectedTableId, activeOrdersForSelectedTable, composingNewOrder]);

  const categoryItems = useMemo(
    () => items.filter((i) => i.category_id === selectedCategoryId),
    [items, selectedCategoryId]
  );

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      map.set(cat.id, cat.name?.trim() || "Category");
    }
    return map;
  }, [categories]);

  const itemSearchResults = useMemo(() => {
    const q = itemSearchQuery.trim().toLowerCase();
    if (!q) return [] as MenuItem[];
    return items
      .filter((item) => {
        const name = item.name.toLowerCase();
        const desc = (item.description ?? "").toLowerCase();
        const cat = (categoryNameById.get(item.category_id) ?? "").toLowerCase();
        return name.includes(q) || desc.includes(q) || cat.includes(q);
      })
      .slice(0, 50);
  }, [categoryNameById, itemSearchQuery, items]);

  const openItemSearch = useCallback(() => {
    setItemSearchQuery("");
    setItemSearchOpen(true);
  }, []);

  const closeItemSearch = useCallback(() => {
    setItemSearchOpen(false);
    setItemSearchQuery("");
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRightContainerStyle: {
        paddingRight: 8,
      },
      headerRight: () => (
        <TouchableOpacity
          onPress={openItemSearch}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={t("submitSearchMenu")}
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: softFillStrong,
            borderWidth: 1,
            borderColor: silverBorder,
          }}
        >
          <Ionicons name="search" size={18} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [
    colors.text,
    navigation,
    openItemSearch,
    silverBorder,
    softFillStrong,
  ]);


  const newCartLines = useMemo(() => cart.filter((line) => !line.orderId), [cart]);
  const existingCartLines = useMemo(() => cart.filter((line) => !!line.orderId), [cart]);

  const canvasW = FLOOR_W * mapZoom;
  const canvasH = FLOOR_H * mapZoom;

  const zoomInMap = () => setMapZoom((z) => clampMapZoom(z + MAP_ZOOM_STEP));
  const zoomOutMap = () => setMapZoom((z) => clampMapZoom(z - MAP_ZOOM_STEP));

  const capturePinchBase = useCallback(() => {
    pinchBaseZoom.current = mapZoom;
  }, [mapZoom]);

  const applyPinchScale = useCallback((scale: number) => {
    setMapZoom(clampMapZoom(pinchBaseZoom.current * scale));
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

  const cartSheetRange = Math.max(1, cartExpandedH - cartCollapsedH);

  const setCartSheetOpenJS = useCallback((open: boolean) => {
    setCartSheetOpen(open);
  }, []);

  const closeCartSheet = useCallback(() => {
    setCartSheetOpen(false);
    cartSheetProgress.value = withTiming(0, { duration: 240 });
  }, [cartSheetProgress]);

  const cartSheetPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .onBegin(() => {
          cartSheetDragStart.value = cartSheetProgress.value;
        })
        .onUpdate((e) => {
          const next =
            cartSheetDragStart.value + -e.translationY / cartSheetRange;
          cartSheetProgress.value = Math.min(1, Math.max(0, next));
        })
        .onEnd((e) => {
          const open =
            cartSheetProgress.value > 0.35 || e.velocityY < -500;
          if (open) runOnJS(setCartSheetOpenJS)(true);
          cartSheetProgress.value = withTiming(
            open ? 1 : 0,
            { duration: 240 },
            (finished) => {
              if (finished && !open) runOnJS(setCartSheetOpenJS)(false);
            }
          );
        }),
    [
      cartSheetDragStart,
      cartSheetProgress,
      cartSheetRange,
      setCartSheetOpenJS,
    ]
  );

  const cartSheetTapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        const open = cartSheetProgress.value < 0.5;
        if (open) runOnJS(setCartSheetOpenJS)(true);
        cartSheetProgress.value = withTiming(
          open ? 1 : 0,
          { duration: 240 },
          (finished) => {
            if (finished && !open) runOnJS(setCartSheetOpenJS)(false);
          }
        );
      }),
    [cartSheetProgress, setCartSheetOpenJS]
  );

  const cartSheetHeaderGesture = useMemo(
    () => Gesture.Exclusive(cartSheetPanGesture, cartSheetTapGesture),
    [cartSheetPanGesture, cartSheetTapGesture]
  );

  const cartSheetStyle = useAnimatedStyle(() => {
    const h =
      (cartCollapsedH +
        (cartExpandedH - cartCollapsedH) * cartSheetProgress.value) *
      cartSheetVisible.value;
    return {
      position: "absolute" as const,
      left: 0,
      right: 0,
      bottom: 0,
      height: h,
      maxHeight: h,
      zIndex: 50,
      elevation: 24,
      overflow: "hidden" as const,
      opacity: cartSheetVisible.value,
    };
  });

  // Collapse cart sheet when leaving stacked layout (e.g. rotate to landscape tablet).
  useEffect(() => {
    if (!isStackedLayout) {
      cartSheetProgress.value = 0;
      cartSheetVisible.value = 1;
      setCartSheetOpen(false);
    }
  }, [cartSheetProgress, cartSheetVisible, isStackedLayout]);

  const cartHasItems =
    existingCartLines.length > 0 || newCartLines.length > 0;
  const cartItemQty = useMemo(
    () =>
      [...existingCartLines, ...newCartLines].reduce(
        (sum, line) => sum + line.quantity,
        0
      ),
    [existingCartLines, newCartLines]
  );

  // Mobile / portrait: keep cart hidden until something is in it.
  useEffect(() => {
    if (!isStackedLayout) return;
    if (cartHasItems) {
      cartSheetVisible.value = withTiming(1, { duration: 240 });
    } else {
      cartSheetProgress.value = withTiming(0, { duration: 160 });
      cartSheetVisible.value = withTiming(0, { duration: 220 });
      setCartSheetOpen(false);
    }
  }, [
    cartHasItems,
    cartSheetProgress,
    cartSheetVisible,
    isStackedLayout,
  ]);

  const assignTable = (table: TableRow) => {
    setSelectedTableId(table.id);
    setRightMode("categories");
    setSelectedCategoryId(null);
    setCartEmptyFocus(null);
    setComposingNewOrder(false);
  };

  const changeTable = () => {
    setRightMode("map");
    setSelectedCategoryId(null);
    setComposingNewOrder(false);
  };

  const openCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setRightMode("items");
  };

  const backToCategories = () => {
    setSelectedCategoryId(null);
    setRightMode("categories");
  };

  const addItem = (item: MenuItem) => {
    const unit = Number(item.price ?? 0);
    setCartEmptyFocus(null);
    setCart((prev) => {
      const existing = prev.find((line) => !line.orderId && line.id === item.id);
      if (existing) {
        return prev.map((line) =>
          line.lineKey === existing.lineKey
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }
      return [
        ...prev,
        {
          lineKey: `new:${item.id}`,
          id: item.id,
          name: item.name,
          price: unit,
          basePrice: unit,
          quantity: 1,
        },
      ];
    });
  };

  const persistExistingOrderItems = async (
    orderId: string,
    nextItems: StoredOrderItem[]
  ) => {
    setSavingExisting(true);
    const payload: Record<string, unknown> = { items: nextItems };
    if (!nextItems.length) {
      const nowIso = new Date().toISOString();
      payload.status = "finish";
      payload.finished_at = nowIso;
      payload.archived_at = nowIso;
    }
    const { error } = await supabase
      .from("orders")
      .update(payload)
      .eq("id", orderId);
    setSavingExisting(false);
    if (error) {
      Alert.alert("Error", error.message || "Could not update order items.");
      await loadOrders();
      return false;
    }
    await loadOrders();
    return true;
  };

  const updateExistingLine = async (
    line: CartLine,
    nextLine: CartLine | null
  ) => {
    if (!line.orderId || line.itemIndex == null) return;
    const order = orders.find((o) => o.id === line.orderId);
    if (!order) return;

    // Optimistic local update
    setCart((prev) => {
      if (!nextLine || nextLine.quantity <= 0) {
        return prev.filter((l) => l.lineKey !== line.lineKey);
      }
      return prev.map((l) => (l.lineKey === line.lineKey ? nextLine : l));
    });

    const items = [...((order.items ?? []) as StoredOrderItem[])];
    if (line.itemIndex < 0 || line.itemIndex >= items.length) {
      await loadOrders();
      return;
    }
    if (!nextLine || nextLine.quantity <= 0) {
      items.splice(line.itemIndex, 1);
    } else {
      items[line.itemIndex] = toStoredItem(nextLine);
    }
    await persistExistingOrderItems(line.orderId, items);
  };

  const changeQty = (lineKey: string, delta: number) => {
    const line = cart.find((l) => l.lineKey === lineKey);
    if (!line || savingExisting) return;

    if (line.orderId) {
      const quantity = line.quantity + delta;
      void updateExistingLine(
        line,
        quantity > 0 ? { ...line, quantity } : null
      );
      return;
    }

    setCart((prev) =>
      prev
        .map((l) =>
          l.lineKey === lineKey ? { ...l, quantity: l.quantity + delta } : l
        )
        .filter((l) => l.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart((prev) => prev.filter((line) => !!line.orderId));
    setComment("");
    setOrderDiscountPercent(undefined);
    closeLineEdit();
    closeOrderMenu();
  };

  const closeOrderMenu = useCallback(() => {
    orderMenuClosingRef.current = false;
    setOrderMenuOpen(false);
    setOrderEditStep("menu");
    setOrderEditDraft("");
    setOrderMenuAnchor(null);
    setCartDimBounds(null);
    setCartFooterBounds(null);
    setOrderMenuMounted(false);
    orderMenuItemAnims.forEach((anim) => {
      anim.value = 0;
    });
  }, [orderMenuItemAnims]);

  const playOrderMenuOpen = useCallback(() => {
    orderMenuClosingRef.current = false;
    const total = orderMenuItemAnims.length;
    const placement = orderMenuPlacementRef.current;
    orderMenuItemAnims.forEach((anim, index) => {
      anim.value = 0;
      anim.value = withDelay(
        floatingMenuStaggerDelay(index, total, placement, "open"),
        withTiming(1, { duration: ORDER_MENU_ITEM_MS })
      );
    });
  }, [orderMenuItemAnims]);

  const animateCloseOrderMenu = useCallback(
    (after?: () => void) => {
      if (orderMenuClosingRef.current) return;
      orderMenuClosingRef.current = true;
      const total = orderMenuItemAnims.length;
      const placement = orderMenuPlacementRef.current;
      let lastIndex = 0;
      let lastDelay = -1;
      for (let i = 0; i < total; i++) {
        const delay = floatingMenuStaggerDelay(i, total, placement, "close");
        if (delay >= lastDelay) {
          lastDelay = delay;
          lastIndex = i;
        }
      }
      orderMenuItemAnims.forEach((anim, index) => {
        const delay = floatingMenuStaggerDelay(index, total, placement, "close");
        const isLast = index === lastIndex;
        anim.value = withDelay(
          delay,
          withTiming(0, { duration: ORDER_MENU_ITEM_MS }, (finished) => {
            if (!finished || !isLast) return;
            if (after) runOnJS(after)();
            else runOnJS(closeOrderMenu)();
          })
        );
      });
    },
    [closeOrderMenu, orderMenuItemAnims]
  );

  useEffect(() => {
    if (orderMenuOpen && orderEditStep === "menu" && orderMenuMounted) {
      playOrderMenuOpen();
    }
  }, [orderMenuOpen, orderEditStep, orderMenuMounted, playOrderMenuOpen]);

  const openOrderMenu = () => {
    const btn = orderMenuBtnRef.current;
    const cart = cartPaneRef.current;
    const footer = cartFooterRef.current;

    const openWith = (
      anchor: typeof orderMenuAnchor,
      cartBounds: typeof cartDimBounds,
      footerBounds: typeof cartFooterBounds
    ) => {
      orderMenuItemAnims.forEach((anim) => {
        anim.value = 0;
      });
      if (anchor) {
        orderMenuPlacementRef.current = resolveFloatingMenuPlacement(
          anchor.y,
          anchor.height,
          ORDER_MENU_COUNT,
          height
        );
      } else {
        orderMenuPlacementRef.current = "above";
      }
      setOrderMenuAnchor(anchor);
      setCartDimBounds(cartBounds);
      setCartFooterBounds(footerBounds);
      setOrderMenuOpen(true);
      setOrderEditStep("menu");
      setOrderEditDraft("");
      setOrderMenuMounted(true);
    };

    const measureFooter = (
      cartBounds: typeof cartDimBounds,
      anchor: typeof orderMenuAnchor
    ) => {
      if (!footer) {
        openWith(anchor, cartBounds, null);
        return;
      }
      footer.measureInWindow((x, y, w, h) => {
        openWith(anchor, cartBounds, { x, y, width: w, height: h });
      });
    };

    const measureCart = (anchor: typeof orderMenuAnchor) => {
      if (!cart) {
        measureFooter(null, anchor);
        return;
      }
      cart.measureInWindow((x, y, w, h) => {
        measureFooter({ x, y, width: w, height: h }, anchor);
      });
    };

    if (btn) {
      btn.measureInWindow((x, y, w, h) => {
        measureCart({ x, y, width: w, height: h });
      });
      return;
    }
    measureCart(null);
  };

  const openOrderEditField = (field: "note" | "discount") => {
    animateCloseOrderMenu(() => {
      setOrderMenuMounted(false);
      setOrderEditStep(field);
      if (field === "note") setOrderEditDraft(comment);
      else
        setOrderEditDraft(
          orderDiscountPercent != null ? String(orderDiscountPercent) : ""
        );
      orderMenuClosingRef.current = false;
    });
  };

  const saveOrderEdit = () => {
    if (orderEditStep === "note") {
      setComment(orderEditDraft.trim());
      closeOrderMenu();
      return;
    }
    if (orderEditStep === "discount") {
      const pct = Number(orderEditDraft.replace(",", "."));
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        Alert.alert("Invalid discount", "Enter a percent between 0 and 100.");
        return;
      }
      setOrderDiscountPercent(pct === 0 ? undefined : pct);
      closeOrderMenu();
    }
  };

  const handleCancelOrder = () => {
    animateCloseOrderMenu(() => {
      closeOrderMenu();
      if (!selectedTableId) return;

      Alert.alert(
        t("submitAlertCancelTitle"),
        t("submitAlertCancelBody"),
        [
          { text: t("submitAlertKeep"), style: "cancel" },
          {
            text: t("submitAlertCancelOrder"),
            style: "destructive",
            onPress: () => {
              resetAfterSubmit({
                title: t("submitCartEmpty"),
                hint: t("submitPickTableNext"),
              });
            },
          },
        ]
      );
    });
  };

  const handleJoinOrders = () => {
    animateCloseOrderMenu(() => {
      closeOrderMenu();
      if (!selectedTableId) {
        Alert.alert(t("submitAlertSelectTable"), t("submitAlertTapTable"));
        return;
      }
      if (activeOrdersForSelectedTable.length < 2) {
        Alert.alert(
          "Nothing to join",
          "This table needs at least two active orders (including QR orders) to join."
        );
        return;
      }

      const numbers = activeOrdersForSelectedTable
        .map((o) => `#${o.order_number ?? "—"}`)
        .join(", ");

      Alert.alert(
        t("submitJoinOrders"),
        `${t("submitAlertJoinTitle")} (${numbers})`,
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("submitAlertJoin"),
            onPress: () => {
              void (async () => {
                setSavingExisting(true);
                const [primary, ...rest] = activeOrdersForSelectedTable;
                const mergedItems = mergeOrderItems(activeOrdersForSelectedTable);
                const mergedComment = mergeOrderComments(
                  activeOrdersForSelectedTable
                );

                const { error: primaryError } = await supabase
                  .from("orders")
                  .update({
                    items: mergedItems,
                    comment: mergedComment,
                  })
                  .eq("id", primary.id);

                if (primaryError) {
                  setSavingExisting(false);
                  Alert.alert(
                    "Error",
                    primaryError.message || "Could not join orders."
                  );
                  return;
                }

                const nowIso = new Date().toISOString();
                for (const order of rest) {
                  await supabase
                    .from("orders")
                    .update({
                      items: [],
                      status: "finish",
                      finished_at: order.finished_at ?? nowIso,
                      accepted_at: order.accepted_at ?? nowIso,
                      archived_at: nowIso,
                      comment: `Joined into #${primary.order_number ?? primary.id}`,
                    })
                    .eq("id", order.id);
                }

                setSavingExisting(false);
                setComposingNewOrder(false);
                await loadOrders();
                setCartEmptyFocus(null);
              })();
            },
          },
        ]
      );
    });
  };

  const handleSubmitSeparateOrder = () => {
    animateCloseOrderMenu(() => {
      closeOrderMenu();
      if (!selectedTableId) {
        Alert.alert(t("submitAlertSelectTable"), t("submitAlertTapTable"));
        setRightMode("map");
        return;
      }

      const startFreshCart = () => {
        setComposingNewOrder(true);
        setCart([]);
        setComment("");
        setOrderDiscountPercent(undefined);
        setCartEmptyFocus({
          title: t("submitNewOrder"),
          hint: selectedTable
            ? `${t("submitEmptyCartForTable", { table: tableLabel(selectedTable) })} · ${t("submitAddSeparate")}`
            : t("submitAddSeparate"),
        });
        setSelectedCategoryId(null);
        setRightMode("categories");
      };

      // If draft items already exist, submit them as a separate order first, then open a fresh cart.
      if (newCartLines.length) {
        void (async () => {
          setSubmitting(true);
          const order = await createOrder("pending");
          setSubmitting(false);
          if (!order) return;
          startFreshCart();
          await loadOrders();
        })();
        return;
      }

      // Close active orders from the cart UI and open an empty cart for the same table.
      startFreshCart();
    });
  };

  const editingLine = useMemo(
    () => cart.find((l) => l.lineKey === editLineKey) ?? null,
    [cart, editLineKey]
  );

  const closeLineEdit = useCallback(() => {
    setEditLineKey(null);
    setEditStep("note");
    setEditDrafts({ note: "", price: "", discount: "" });
  }, []);

  const openLineEdit = (line: CartLine) => {
    if (savingExisting) return;
    setEditLineKey(line.lineKey);
    setEditStep("note");
    setEditDrafts({
      note: line.note ?? "",
      price: String(line.price),
      discount:
        line.discountPercent != null ? String(line.discountPercent) : "",
    });
  };

  const saveLineEdit = () => {
    if (!editLineKey || !editingLine) return;
    const key = editLineKey;
    const source = editingLine;

    const note = editDrafts.note.trim();
    const priceRaw = Number(editDrafts.price.replace(",", "."));
    if (!Number.isFinite(priceRaw) || priceRaw < 0) {
      Alert.alert("Invalid price", "Enter a valid price of 0 or more.");
      setEditStep("price");
      return;
    }

    const discountRaw = editDrafts.discount.trim();
    let discountPercent: number | undefined;
    let price = priceRaw;

    if (discountRaw !== "") {
      const pct = Number(discountRaw.replace(",", "."));
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        Alert.alert("Invalid discount", "Enter a percent between 0 and 100.");
        setEditStep("discount");
        return;
      }
      discountPercent = pct === 0 ? undefined : pct;
      if (discountPercent != null) {
        price =
          Math.round(source.basePrice * (1 - discountPercent / 100) * 100) /
          100;
      } else {
        price = source.basePrice;
      }
    }

    // Manual price edit clears discount unless discount field is intentionally set.
    // If user edited price while discount was empty, keep the typed price.
    if (discountRaw === "") {
      discountPercent = undefined;
      price = priceRaw;
    }

    const next: CartLine = {
      ...source,
      note: note || undefined,
      price,
      discountPercent,
    };

    closeLineEdit();

    if (source.orderId) {
      void updateExistingLine(source, next);
      return;
    }

    setCart((prev) =>
      prev.map((line) => (line.lineKey === key ? next : line))
    );
  };

  const createOrder = async (status: "pending" | "accepted") => {
    if (!restaurant?.id) {
      Alert.alert("Error", "Restaurant not loaded.");
      return null;
    }
    if (!selectedTableId) {
      Alert.alert(t("submitAlertSelectTable"), t("submitAlertTapTable"));
      setRightMode("map");
      return null;
    }
    if (!newCartLines.length) {
      return null;
    }

    const payload = newCartLines.map((line) => {
      const stored = toStoredItem(line);
      if (orderDiscountPercent == null || orderDiscountPercent <= 0) return stored;
      const discounted =
        Math.round(Number(stored.price ?? 0) * (1 - orderDiscountPercent / 100) * 100) /
        100;
      return {
        ...stored,
        price: discounted,
        discount: orderDiscountPercent,
        base_price: Number(stored.base_price ?? stored.price ?? 0),
      };
    });
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        table_id: selectedTableId,
        items: payload,
        comment: comment.trim() || null,
        status,
        source: "staff",
        ...(status === "accepted" ? { accepted_at: nowIso } : null),
      })
      .select("id, order_number, status, items, comment, created_at, accepted_at, table_id")
      .single();

    if (error || !data) {
      Alert.alert("Error", error?.message || "Could not create order.");
      return null;
    }

    const table = tables.find((t) => t.id === selectedTableId) ?? null;
    return {
      ...(data as Order),
      tables: table
        ? {
            table_number: table.table_number,
            table_name: table.table_name ?? undefined,
          }
        : null,
    };
  };

  const closeActiveTableOrders = async () => {
    if (!selectedTableId || !activeOrdersForSelectedTable.length) return [] as Order[];
    const nowIso = new Date().toISOString();
    const closed: Order[] = [];
    for (const order of activeOrdersForSelectedTable) {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "finish",
          finished_at: order.finished_at ?? nowIso,
          accepted_at: order.accepted_at ?? nowIso,
          archived_at: nowIso,
        })
        .eq("id", order.id);
      if (!error) {
        closed.push({
          ...order,
          status: "finish",
          finished_at: order.finished_at ?? nowIso,
          accepted_at: order.accepted_at ?? nowIso,
          archived_at: nowIso,
        });
      }
    }
    return closed;
  };

  const buildTableReceiptOrder = (
    primary: Order | null,
    closedOrders: Order[]
  ): Order | null => {
    const table = tables.find((t) => t.id === selectedTableId) ?? null;
    const tableMeta = table
      ? {
          table_number: table.table_number,
          table_name: table.table_name ?? undefined,
        }
      : null;

    const parts = [...closedOrders, ...(primary ? [primary] : [])];
    if (!parts.length) return null;

    const items = parts.flatMap((o) => o.items ?? []);
    const comments = parts
      .map((o) => o.comment?.trim())
      .filter(Boolean)
      .join(" · ");

    return {
      id: primary?.id ?? parts[0].id,
      table_id: selectedTableId!,
      status: "accepted",
      items,
      order_number: primary?.order_number ?? parts[0].order_number,
      comment: comments || comment.trim() || null,
      created_at: primary?.created_at ?? parts[0].created_at,
      accepted_at: new Date().toISOString(),
      tables: tableMeta,
    };
  };

  const resetAfterSubmit = (emptyMessage?: { title: string; hint: string }) => {
    clearCart();
    setSelectedTableId(null);
    setSelectedCategoryId(null);
    setComposingNewOrder(false);
    setRightMode("map");
    setCartEmptyFocus(
      emptyMessage ?? {
        title: t("submitCartEmpty"),
        hint: t("submitPickTableNext"),
      }
    );
    void loadOrders();
  };

  const handleSubmitOrder = async () => {
    if (submitting || savingExisting) return;
    if (!selectedTableId) {
      Alert.alert(t("submitAlertSelectTable"), t("submitAlertTapTable"));
      setRightMode("map");
      return;
    }

    const hasNew = newCartLines.length > 0;
    const hasExisting = existingCartLines.length > 0;

    // Composing a separate order for this table: submit draft and keep an empty cart on the same table.
    if (composingNewOrder) {
      if (!hasNew) {
        setCartEmptyFocus({
          title: t("submitNewOrder"),
          hint: selectedTable
            ? `${t("submitEmptyCartForTable", { table: tableLabel(selectedTable) })} · ${t("submitAddSeparate")}`
            : t("submitAddSeparate"),
        });
        return;
      }
      setSubmitting(true);
      const order = await createOrder("pending");
      setSubmitting(false);
      if (!order) return;
      setCart([]);
      setComment("");
      setOrderDiscountPercent(undefined);
      setCartEmptyFocus({
        title: t("submitNewOrder"),
        hint: `${t("submitOrderSent")} · ${t("submitAddSeparate")}`,
      });
      setSelectedCategoryId(null);
      setRightMode("categories");
      await loadOrders();
      return;
    }

    if (!hasNew && !hasExisting) {
      resetAfterSubmit({
        title: t("submitCartEmpty"),
        hint: t("submitPickTableTake"),
      });
      return;
    }

    if (hasNew) {
      setSubmitting(true);
      const order = await createOrder("pending");
      setSubmitting(false);
      if (!order) return;
      resetAfterSubmit({
        title: t("submitCartEmpty"),
        hint: `${t("submitOrderSent")} · ${t("submitPickTableNext")}`,
      });
      return;
    }

    resetAfterSubmit({
      title: t("submitCartEmpty"),
      hint: t("submitChangesSaved"),
    });
  };

  const handleCheckoutPrint = async () => {
    if (submitting || savingExisting) return;
    if (!selectedTableId) {
      Alert.alert(t("submitAlertSelectTable"), t("submitAlertTapTable"));
      setRightMode("map");
      return;
    }

    const hasNew = newCartLines.length > 0;
    const hasExisting = activeOrdersForSelectedTable.length > 0;

    if (!hasNew && !hasExisting) {
      resetAfterSubmit({
        title: t("submitCartEmpty"),
        hint: t("submitPickTableTake"),
      });
      return;
    }

    setSubmitting(true);
    let created: Order | null = null;
    if (hasNew) {
      created = await createOrder("accepted");
      if (!created) {
        setSubmitting(false);
        return;
      }
    }

    const closed = await closeActiveTableOrders();

    if (created) {
      try {
        await supabase.functions.invoke("send-order-to-pos", {
          body: { orderId: created.id },
        });
      } catch {
        // continue to print
      }
      const nowIso = new Date().toISOString();
      await supabase
        .from("orders")
        .update({
          status: "finish",
          finished_at: nowIso,
          archived_at: nowIso,
          accepted_at: created.accepted_at ?? nowIso,
        })
        .eq("id", created.id);
      created = {
        ...created,
        status: "finish",
        finished_at: nowIso,
        archived_at: nowIso,
      };
    }

    const receiptOrder = buildTableReceiptOrder(created, closed);
    setSubmitting(false);

    if (receiptOrder) {
      try {
        await printOrderTicket(
          receiptOrder,
          restaurant?.name ?? "Restaurant",
          currency
        );
      } catch (e) {
        Alert.alert(
          "Print failed",
          (e as Error).message || "Could not open the print dialog."
        );
      }
    }

    resetAfterSubmit({
      title: t("submitCartEmpty"),
      hint: created
        ? `Table checked out · #${created.order_number ?? "—"} · pick a table for the next guest`
        : "Table checked out · select a table for the next order",
    });
  };

  const leftPaneWidth = isTablet ? Math.min(420, Math.round(width * 0.38)) : width;
  const rightPaneWidth = isTablet ? width - leftPaneWidth : width;
  // Portrait tablets are often < 900 wide, so treat them as tablet for item grid density.
  const isTabletPortrait =
    height > width && Math.min(width, height) >= 600;
  const catCols = isTablet || isTabletPortrait ? 3 : 2;
  const itemCols = isTablet || isTabletPortrait ? 3 : 2;
  const activeOrderCols = 3;
  const catCardWidth = Math.floor(
    (rightPaneWidth - 28 - 12 * (catCols - 1)) / catCols
  );
  const itemCardWidth = Math.floor(
    (rightPaneWidth - 28 - 12 * (itemCols - 1)) / itemCols
  );
  const activeOrderCardWidth = Math.floor(
    (rightPaneWidth - 28 - 12 * (activeOrderCols - 1)) / activeOrderCols
  );

  if (loading) {
    return (
      <Screen style={{ backgroundColor: colors.bg, justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  const cartPanel = (
    <Animated.View
      pointerEvents={isStackedLayout && !cartHasItems ? "none" : "auto"}
      style={[
        isStackedLayout
          ? cartSheetStyle
          : {
              width: leftPaneWidth,
              flexGrow: 0,
              flexShrink: 0,
              minHeight: 0,
              minWidth: leftPaneWidth,
            },
      ]}
    >
      <CartPane
        ref={cartPaneRef}
        collapsable={false}
        style={{
          flex: 1,
          width: isTablet ? leftPaneWidth : undefined,
          borderRightWidth: isTablet ? 1 : 0,
          borderTopWidth: isTablet ? 0 : 1,
          borderColor: silverBorder,
          backgroundColor: isLight ? "#ffffff" : colors.surface,
          shadowColor: "#000",
          shadowOpacity: isStackedLayout && cartSheetOpen ? 0.18 : 0,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -6 },
          elevation: isStackedLayout && cartSheetOpen ? 16 : 0,
        }}
      >
        {isStackedLayout ? (
          <View>
            <GestureDetector gesture={cartSheetHeaderGesture}>
              <Animated.View>
                <CartMiniBar
                  style={{
                    borderBottomColor: silverBorder,
                    backgroundColor: isLight ? "#ffffff" : colors.surface,
                    paddingBottom: cartSheetOpen
                      ? 10
                      : Math.max(insets.bottom, 8),
                    paddingRight: cartSheetOpen ? 52 : 16,
                  }}
                >
                  <CartSheetHandle
                    style={{
                      backgroundColor: isLight
                        ? "rgba(28, 25, 23, 0.18)"
                        : "rgba(255,255,255,0.28)",
                      marginBottom: 10,
                    }}
                  />
                  <CartMiniRow>
                    <CartHeaderLeft>
                      <CartTitle style={{ color: colors.text }}>{t("submitCart")}</CartTitle>
                      <CartCountPill
                        style={{
                          backgroundColor: colors.sidebarOrange,
                        }}
                      >
                        <CartCountText style={{ color: "#fff" }}>
                          {cartItemQty}
                        </CartCountText>
                      </CartCountPill>
                    </CartHeaderLeft>
                    {!cartSheetOpen ? (
                      <Ionicons
                        name="chevron-up"
                        size={20}
                        color={colors.textMuted}
                      />
                    ) : null}
                  </CartMiniRow>
                </CartMiniBar>
              </Animated.View>
            </GestureDetector>
            {cartSheetOpen ? (
              <CartCloseBtn
                onPress={closeCartSheet}
                activeOpacity={0.85}
                hitSlop={8}
                style={{
                  backgroundColor: softFillStrong,
                  borderColor: silverBorder,
                }}
                accessibilityLabel={t("submitCloseCart")}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </CartCloseBtn>
            ) : null}
          </View>
        ) : (
          <CartHeader
            style={{
              borderBottomColor: silverBorder,
              backgroundColor: isLight ? "#ffffff" : colors.surface,
            }}
          >
            <CartHeaderLeft>
              <CartTitle style={{ color: colors.text }}>{t("submitCart")}</CartTitle>
              {(existingCartLines.length > 0 || newCartLines.length > 0) && (
                <CartCountPill
                  style={{
                    backgroundColor: isLight
                      ? "rgba(28, 25, 23, 0.06)"
                      : "rgba(255,255,255,0.08)",
                  }}
                >
                  <CartCountText style={{ color: colors.textMuted }}>
                    {existingCartLines.length + newCartLines.length}
                  </CartCountText>
                </CartCountPill>
              )}
            </CartHeaderLeft>
            {selectedTable ? (
              <TableBadge
                onPress={changeTable}
                activeOpacity={0.85}
                style={{
                  borderColor: isLight
                    ? "rgba(255, 102, 0, 0.28)"
                    : "rgba(255, 102, 0, 0.4)",
                  backgroundColor: isLight
                    ? "rgba(255, 102, 0, 0.08)"
                    : "rgba(255, 102, 0, 0.16)",
                }}
              >
                <TableBadgeDot style={{ backgroundColor: colors.sidebarOrange }} />
                <TableBadgeText
                  style={{ color: colors.sidebarOrange }}
                  numberOfLines={1}
                >
                  {tableLabel(selectedTable)}
                </TableBadgeText>
              </TableBadge>
            ) : (
              <TableBadge
                onPress={() => setRightMode("map")}
                activeOpacity={0.85}
                style={{
                  borderColor: silverBorder,
                  backgroundColor: softFill,
                }}
              >
                <TableBadgeText
                  style={{ color: colors.textMuted }}
                  numberOfLines={1}
                >
                  {t("submitSelectTable")}
                </TableBadgeText>
              </TableBadge>
            )}
          </CartHeader>
        )}

        {isStackedLayout && cartSheetOpen && selectedTable ? (
          <CartExpandedMeta
            style={{
              borderBottomColor: silverBorder,
              backgroundColor: isLight ? "#ffffff" : colors.surface,
            }}
          >
            <TableBadge
              onPress={changeTable}
              activeOpacity={0.85}
              style={{
                borderColor: isLight
                  ? "rgba(255, 102, 0, 0.28)"
                  : "rgba(255, 102, 0, 0.4)",
                backgroundColor: isLight
                  ? "rgba(255, 102, 0, 0.08)"
                  : "rgba(255, 102, 0, 0.16)",
              }}
            >
              <TableBadgeDot style={{ backgroundColor: colors.sidebarOrange }} />
              <TableBadgeText
                style={{ color: colors.sidebarOrange }}
                numberOfLines={1}
              >
                {tableLabel(selectedTable)}
              </TableBadgeText>
            </TableBadge>
          </CartExpandedMeta>
        ) : null}

      {(!isStackedLayout || cartSheetOpen) && (
        <>
      <ScrollView
        style={{ flex: 1, backgroundColor: isLight ? "#ffffff" : colors.surface }}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingBottom: 12,
          gap: 2,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {[...existingCartLines, ...newCartLines].map((line) => {
          const isExisting = !!line.orderId;
          return (
            <CartRow
              key={line.lineKey}
              style={{
                borderBottomColor: silverBorder,
                paddingVertical: isStackedLayout ? 16 : 12,
                gap: isStackedLayout ? 12 : 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <CartRowName
                  style={{
                    color: colors.text,
                    fontSize: isStackedLayout ? 19 : 17,
                    lineHeight: isStackedLayout ? 24 : undefined,
                  }}
                  numberOfLines={2}
                >
                  {line.name}
                </CartRowName>
                {line.note ||
                (line.discountPercent != null && line.discountPercent > 0) ? (
                  <CartRowMeta
                    style={{
                      color: colors.textMuted,
                      fontSize: isStackedLayout ? 14 : 12,
                      marginTop: isStackedLayout ? 4 : 3,
                    }}
                    numberOfLines={2}
                  >
                    {[
                      line.discountPercent != null && line.discountPercent > 0
                        ? `−${line.discountPercent}%`
                        : null,
                      line.note || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </CartRowMeta>
                ) : null}
              </View>
              <QtyControls style={{ gap: isStackedLayout ? 8 : 6 }}>
                <EditBtn
                  onPress={() => openLineEdit(line)}
                  style={{
                    backgroundColor: colors.sidebarOrange,
                    borderColor: colors.sidebarOrange,
                    opacity: isExisting && savingExisting ? 0.55 : 1,
                    width: isStackedLayout ? 34 : 28,
                    height: isStackedLayout ? 34 : 28,
                  }}
                  hitSlop={6}
                  disabled={isExisting && savingExisting}
                >
                  <Ionicons
                    name="create-outline"
                    size={isStackedLayout ? 16 : 14}
                    color="#fff"
                  />
                </EditBtn>
                <QtyBtn
                  onPress={() => changeQty(line.lineKey, -1)}
                  style={{
                    borderColor: silverBorder,
                    backgroundColor: softFill,
                    width: isStackedLayout ? 34 : 28,
                    height: isStackedLayout ? 34 : 28,
                  }}
                  disabled={isExisting && savingExisting}
                >
                  <Ionicons
                    name="remove"
                    size={isStackedLayout ? 17 : 15}
                    color={colors.text}
                  />
                </QtyBtn>
                <QtyValue
                  style={{
                    color: colors.text,
                    fontSize: isStackedLayout ? 16 : 14,
                    minWidth: isStackedLayout ? 20 : 16,
                  }}
                >
                  {line.quantity}
                </QtyValue>
                <QtyBtn
                  onPress={() => changeQty(line.lineKey, 1)}
                  style={{
                    borderColor: silverBorder,
                    backgroundColor: softFill,
                    width: isStackedLayout ? 34 : 28,
                    height: isStackedLayout ? 34 : 28,
                  }}
                  disabled={isExisting && savingExisting}
                >
                  <Ionicons
                    name="add"
                    size={isStackedLayout ? 17 : 15}
                    color={colors.text}
                  />
                </QtyBtn>
              </QtyControls>
            </CartRow>
          );
        })}
      </ScrollView>

      <CartFooter
        ref={cartFooterRef}
        collapsable={false}
        style={{
          borderTopColor: silverBorder,
          paddingBottom: isTablet ? 12 : Math.max(insets.bottom, 10),
        }}
      >
        <FooterActions>
          <FooterLeft>
            <IconActionBtn
              onPress={handleSubmitOrder}
              activeOpacity={0.88}
              style={{
                backgroundColor: isLight ? "#16a34a" : "#22c55e",
                borderColor: isLight ? "#15803d" : "#16a34a",
                opacity: submitting ? 0.75 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-down" size={22} color="#fff" />
              )}
            </IconActionBtn>
            <View
              ref={(node) => {
                orderMenuBtnRef.current = node;
              }}
              collapsable={false}
            >
              <IconActionBtn
                onPress={openOrderMenu}
                activeOpacity={0.88}
                style={{
                  backgroundColor: isLight ? "#4f46e5" : "#6366f1",
                  borderColor: isLight ? "#4338ca" : "#4f46e5",
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
              </IconActionBtn>
            </View>
          </FooterLeft>
          <CheckoutBtn
            onPress={handleCheckoutPrint}
            activeOpacity={0.88}
            style={{
              backgroundColor: colors.sidebarOrange,
              borderColor: isLight ? "#e65c00" : colors.sidebarOrange,
              opacity: submitting ? 0.75 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="print-outline" size={18} color="#fff" />
            )}
            <ActionBtnText style={{ color: "#fff" }}>{t("submitCheckout")}</ActionBtnText>
          </CheckoutBtn>
        </FooterActions>
      </CartFooter>
        </>
      )}
    </CartPane>
    </Animated.View>
  );

  const rightPanel = (
    <RightPane style={{ backgroundColor: colors.bg }}>
      {rightMode === "map" ? (
        <>
          <PaneHeader>
            <View style={{ gap: 4, flex: 1, minWidth: 0 }}>
              <PaneTitle style={{ color: colors.text }}>
                {floorView === "map" ? t("submitSelectTable") : t("submitActiveOrders")}
              </PaneTitle>
              <PaneHint style={{ color: colors.textMuted }}>
                {floorView === "map"
                  ? t("submitMapHint")
                  : activeOrdersSummary.tableCount
                    ? `${activeOrdersSummary.tableCount} table${
                        activeOrdersSummary.tableCount === 1 ? "" : "s"
                      } · ${activeOrdersSummary.orderCount} active order${
                        activeOrdersSummary.orderCount === 1 ? "" : "s"
                      }`
                    : t("submitNoOpenTables")}
              </PaneHint>
            </View>
            <FloorViewBtn
              onPress={() =>
                setFloorView((prev) => (prev === "map" ? "orders" : "map"))
              }
              activeOpacity={0.85}
              style={{
                borderColor: silverBorder,
                backgroundColor: softFill,
              }}
              accessibilityLabel={
                floorView === "map" ? t("submitOpenActiveOrders") : t("submitOpenTableMap")
              }
            >
              <Ionicons
                name={floorView === "map" ? "list-outline" : "map-outline"}
                size={15}
                color={colors.text}
              />
              <FloorViewBtnText style={{ color: colors.text }}>
                {floorView === "map" ? t("submitOrdersTab") : t("submitMapTab")}
              </FloorViewBtnText>
            </FloorViewBtn>
          </PaneHeader>

          {floorView === "map" ? (
            <MapViewport>
              <GestureDetector gesture={pinchGesture}>
                <Animated.View style={{ flex: 1 }}>
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                      width: canvasW,
                      height: canvasH,
                    }}
                    bounces
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                  >
                    <MapStage
                      style={{
                        width: canvasW,
                        height: canvasH,
                        backgroundColor: isLight ? "#f3f5f7" : colors.surface2,
                        borderColor: silverBorder,
                        borderRadius: 0,
                        borderWidth: 0,
                      }}
                    >
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

                      {tables.map((table, index) => {
                        const fallback = defaultPos(index);
                        const size = TABLE_SIZE * mapZoom;
                        const x =
                          pctToPx(table.map_x, FLOOR_W, fallback.x) * mapZoom;
                        const y =
                          pctToPx(table.map_y, FLOOR_H, fallback.y) * mapZoom;
                        const selected = table.id === selectedTableId;
                        const lastOrderAt = lastActiveOrderAtByTable.get(table.id);
                        const hasActiveOrder = !!lastOrderAt;
                        const lastOrderTime = formatMapOrderTime(lastOrderAt);
                        const busyFill = isLight
                          ? "rgba(37, 99, 235, 0.12)"
                          : "rgba(96, 165, 250, 0.2)";
                        const busyBorder = isLight ? "#2563eb" : "#60a5fa";
                        const customName = table.table_name?.trim() || "";
                        const fontZoom = Math.min(mapZoom, 1.15);
                        return (
                          <View
                            key={table.id}
                            style={{
                              position: "absolute",
                              left: x,
                              top: y,
                              width: size,
                              alignItems: "center",
                            }}
                          >
                            <Pressable
                              onPress={() => assignTable(table)}
                              style={{
                                width: size,
                                height: size,
                                borderRadius: 18,
                                borderWidth: 1.5,
                                borderColor: selected
                                  ? colors.sidebarOrange
                                  : hasActiveOrder
                                    ? busyBorder
                                    : colors.sidebarOrange,
                                backgroundColor: selected
                                  ? isLight
                                    ? "rgba(255, 102, 0, 0.16)"
                                    : "rgba(255, 102, 0, 0.24)"
                                  : hasActiveOrder
                                    ? busyFill
                                    : isLight
                                      ? "#ffffff"
                                      : colors.surface,
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 6,
                                gap: 2,
                                ...Platform.select({
                                  ios: {
                                    shadowColor: "#1c1917",
                                    shadowOpacity: 0.08,
                                    shadowRadius: 6,
                                    shadowOffset: { width: 0, height: 2 },
                                  },
                                  android: { elevation: 0 },
                                  default: {},
                                }),
                              }}
                            >
                              <MapTableNumber
                                style={{
                                  color: selected
                                    ? colors.sidebarOrange
                                    : hasActiveOrder
                                      ? busyBorder
                                      : colors.sidebarOrange,
                                  fontSize: 15 * fontZoom,
                                }}
                              >
                                {table.table_number}
                              </MapTableNumber>
                              <MapTableName
                                style={{
                                  color: colors.text,
                                  fontSize: 9 * fontZoom,
                                }}
                                numberOfLines={1}
                              >
                                {customName || t("table")}
                              </MapTableName>
                            </Pressable>
                            {hasActiveOrder && lastOrderTime ? (
                              <MapTableTime
                                style={{
                                  color: selected
                                    ? colors.sidebarOrange
                                    : colors.textMuted,
                                  fontSize: 10 * fontZoom,
                                  marginTop: 4 * fontZoom,
                                  lineHeight: 12 * fontZoom,
                                }}
                                numberOfLines={1}
                              >
                                {lastOrderTime}
                              </MapTableTime>
                            ) : null}
                          </View>
                        );
                      })}
                      {!tables.length ? (
                        <EmptyHint
                          style={{
                            color: colors.textMuted,
                            textAlign: "center",
                            marginTop: 40,
                          }}
                        >
                          {t("submitNoTablesYet")}
                        </EmptyHint>
                      ) : null}
                    </MapStage>
                  </ScrollView>
                </Animated.View>
              </GestureDetector>

              <MapZoomBar
                pointerEvents="box-none"
                style={{
                  borderColor: silverBorder,
                  backgroundColor: isLight ? "#ffffff" : colors.surface,
                  ...Platform.select({
                    ios: {
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                    },
                    android: { elevation: 4 },
                    default: {},
                  }),
                }}
              >
                <MapZoomBtn
                  onPress={zoomOutMap}
                  disabled={mapZoom <= MIN_MAP_ZOOM}
                  activeOpacity={0.8}
                  accessibilityLabel={t("tablesZoomOut")}
                  style={{ opacity: mapZoom <= MIN_MAP_ZOOM ? 0.4 : 1 }}
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </MapZoomBtn>
                <MapZoomLevel style={{ color: colors.textMuted }}>
                  {Math.round(mapZoom * 100)}%
                </MapZoomLevel>
                <MapZoomBtn
                  onPress={zoomInMap}
                  disabled={mapZoom >= MAX_MAP_ZOOM}
                  activeOpacity={0.8}
                  accessibilityLabel={t("tablesZoomIn")}
                  style={{ opacity: mapZoom >= MAX_MAP_ZOOM ? 0.4 : 1 }}
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </MapZoomBtn>
              </MapZoomBar>
            </MapViewport>
          ) : (
            <ScrollView
              contentContainerStyle={{
                padding: 14,
                paddingBottom: 28,
              }}
              showsVerticalScrollIndicator={false}
            >
              {activeOrderCards.length ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  {activeOrderColumns.map((column, colIndex) => (
                    <View
                      key={`orders-col-${colIndex}`}
                      style={{ width: activeOrderCardWidth, gap: 12 }}
                    >
                      {column.map(({ table, order, total, items }) => {
                        const selected = table.id === selectedTableId;
                        return (
                          <ActiveTableCard
                            key={order.id}
                            onPress={() => assignTable(table)}
                            activeOpacity={0.88}
                            style={{
                              borderColor: selected
                                ? colors.sidebarOrange
                                : silverBorder,
                              backgroundColor: isLight
                                ? "#ffffff"
                                : colors.surface,
                            }}
                          >
                            <ActiveTableCardHeader>
                              <ActiveTableHeaderCopy>
                                <ActiveTableName
                                  style={{ color: colors.text }}
                                  numberOfLines={1}
                                >
                                  Table {table.table_number}
                                </ActiveTableName>
                              </ActiveTableHeaderCopy>
                              <ActiveTableOrderIndex
                                style={{
                                  color: selected
                                    ? colors.sidebarOrange
                                    : colors.textMuted,
                                }}
                              >
                                #{order.order_number ?? "—"}
                              </ActiveTableOrderIndex>
                            </ActiveTableCardHeader>

                            <ActiveTableOrdersList
                              style={{
                                borderTopColor: silverBorder,
                              }}
                            >
                              {items.length ? (
                                items.map((item, idx) => {
                                  const qty = Number(item.quantity ?? 1) || 1;
                                  return (
                                    <ActiveTableOrderRow
                                      key={`${order.id}-${item.id ?? idx}`}
                                    >
                                      <ActiveItemQty
                                        style={{ color: colors.textMuted }}
                                      >
                                        {qty}×
                                      </ActiveItemQty>
                                      <ActiveItemName
                                        style={{ color: colors.text }}
                                        numberOfLines={2}
                                      >
                                        {item.name?.trim() || "Item"}
                                      </ActiveItemName>
                                      <ActiveItemPrice
                                        style={{ color: colors.textMuted }}
                                      >
                                        {formatAmount(
                                          (Number(item.price ?? 0) || 0) * qty
                                        )}
                                      </ActiveItemPrice>
                                    </ActiveTableOrderRow>
                                  );
                                })
                              ) : (
                                <ActiveTableMore
                                  style={{ color: colors.textMuted }}
                                >
                                  {t("submitNoItems")}
                                </ActiveTableMore>
                              )}
                            </ActiveTableOrdersList>

                            <ActiveTableCardFooter>
                              <ActiveTableTotalLabel
                                style={{ color: colors.textMuted }}
                              >
                                {t("submitTotal")}
                              </ActiveTableTotalLabel>
                              <ActiveTableTotalValue
                                style={{ color: colors.text }}
                              >
                                {formatAmount(total)}
                              </ActiveTableTotalValue>
                            </ActiveTableCardFooter>
                          </ActiveTableCard>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ) : (
                <ActiveOrdersEmpty>
                  <ActiveOrdersEmptyIcon
                    style={{
                      backgroundColor: softFillStrong,
                      borderColor: silverBorder,
                    }}
                  >
                    <Ionicons
                      name="receipt-outline"
                      size={28}
                      color={colors.textMuted}
                    />
                  </ActiveOrdersEmptyIcon>
                  <ActiveOrdersEmptyTitle style={{ color: colors.text }}>
                    {t("submitNoActiveOrders")}
                  </ActiveOrdersEmptyTitle>
                  <ActiveOrdersEmptyHint style={{ color: colors.textMuted }}>
                    {t("submitNoActiveOrdersHint")}
                  </ActiveOrdersEmptyHint>
                </ActiveOrdersEmpty>
              )}
            </ScrollView>
          )}
        </>
      ) : null}

      {rightMode === "categories" ? (
        <>
          <PaneHeader>
            <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
              <PaneTitle style={{ color: colors.text }}>{t("submitCategories")}</PaneTitle>
              <PaneHint style={{ color: colors.textMuted }}>
                {categories.length
                  ? `${categories.length} categor${
                      categories.length === 1 ? "y" : "ies"
                    }`
                  : t("submitNoCategoriesYet")}
              </PaneHint>
            </View>
            <ChangeTableLink
              onPress={changeTable}
              activeOpacity={0.85}
              style={{
                borderColor: silverBorder,
                backgroundColor: softFill,
              }}
            >
              <Ionicons name="grid-outline" size={14} color={colors.sidebarOrange} />
              <ChangeTableText style={{ color: colors.sidebarOrange }}>
                Table
              </ChangeTableText>
            </ChangeTableLink>
          </PaneHeader>
          <View style={{ flex: 1, minHeight: 0 }}>
            <CategoriesPaneFooter pointerEvents="none">
              <View
                style={{
                  width: "100%",
                  height: 1,
                  backgroundColor: silverBorder,
                }}
              />
              <CategoriesBrandRow>
                <CategoriesBrandMark
                  source={require("../../assets/images/icon.png")}
                  resizeMode="contain"
                />
                <CategoriesBrandCopy>
                  <CategoriesBrandName style={{ color: colors.text }}>
                    QRMenu
                  </CategoriesBrandName>
                  <CategoriesBrandTag style={{ color: colors.textMuted }}>
                    Admin
                  </CategoriesBrandTag>
                </CategoriesBrandCopy>
              </CategoriesBrandRow>
            </CategoriesPaneFooter>
            <ScrollView
              style={{ flex: 1, zIndex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 14,
                paddingTop: 6,
                paddingBottom: 160,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              {categories.map((cat) => {
                const count = items.filter((i) => i.category_id === cat.id).length;
                return (
                  <CategoryCard
                    key={cat.id}
                    onPress={() => openCategory(cat.id)}
                    activeOpacity={0.9}
                    style={{
                      width: catCardWidth,
                      borderColor: silverBorder,
                      backgroundColor: colors.surface,
                      shadowColor: "#000",
                      shadowOpacity: isLight ? 0.04 : 0.18,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 3 },
                      elevation: 3,
                      zIndex: 2,
                    }}
                  >
                    <CategoryCopy>
                      <CategoryName style={{ color: colors.text }} numberOfLines={2}>
                        {cat.name || "Untitled"}
                      </CategoryName>
                      <CategoryMetaChip
                        style={{
                          backgroundColor: isLight
                            ? "rgba(255, 102, 0, 0.08)"
                            : "rgba(255, 102, 0, 0.14)",
                        }}
                      >
                        <CategoryMeta style={{ color: colors.sidebarOrange }}>
                          {count === 1 ? "1 item" : `${count} items`}
                        </CategoryMeta>
                      </CategoryMetaChip>
                    </CategoryCopy>
                    <CategoryChevron
                      style={{
                        backgroundColor: isLight
                          ? "rgba(255, 102, 0, 0.08)"
                          : "rgba(255, 102, 0, 0.14)",
                      }}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={colors.sidebarOrange}
                      />
                    </CategoryChevron>
                  </CategoryCard>
                );
              })}
              {!categories.length ? (
                <EmptyHint style={{ color: colors.textMuted }}>
                  {t("submitNoCategoriesAvailable")}
                </EmptyHint>
              ) : null}
            </ScrollView>
          </View>
        </>
      ) : null}

      {rightMode === "items" ? (
        <>
          <PaneHeader>
            <BackRow onPress={backToCategories} style={{ flex: 1, minWidth: 0 }}>
              <BackChip
                style={{
                  borderColor: silverBorder,
                  backgroundColor: softFill,
                }}
              >
                <Ionicons name="chevron-back" size={16} color={colors.text} />
              </BackChip>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <PaneTitle style={{ color: colors.text }} numberOfLines={1}>
                  {categories.find((c) => c.id === selectedCategoryId)?.name ||
                    t("submitItems")}
                </PaneTitle>
                <PaneHint style={{ color: colors.textMuted }}>
                  {categoryItems.length
                    ? `${categoryItems.length} · ${t("submitTapToAdd")}`
                    : t("submitNoItemsInCategory")}
                </PaneHint>
              </View>
            </BackRow>
            <ChangeTableLink
              onPress={changeTable}
              activeOpacity={0.85}
              style={{
                borderColor: silverBorder,
                backgroundColor: softFill,
              }}
            >
              <Ionicons name="grid-outline" size={14} color={colors.sidebarOrange} />
              <ChangeTableText style={{ color: colors.sidebarOrange }}>
                Table
              </ChangeTableText>
            </ChangeTableLink>
          </PaneHeader>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 14,
              paddingTop: 6,
              paddingBottom: 28,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {categoryItems.map((item) => {
              const inCart = newCartLines.find((l) => l.id === item.id);
              const soldOut = !!item.sold_out || item.available === false;
              return (
                <ItemCard
                  key={item.id}
                  onPress={() => {
                    if (soldOut || inCart) return;
                    addItem(item);
                  }}
                  activeOpacity={soldOut || inCart ? 1 : 0.88}
                  disabled={soldOut}
                  style={{
                    width: itemCardWidth,
                    borderColor: inCart
                      ? colors.sidebarOrange
                      : silverBorder,
                    backgroundColor: colors.surface,
                    opacity: soldOut ? 0.55 : 1,
                    shadowColor: "#000",
                    shadowOpacity: isLight ? 0.06 : 0.2,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 2,
                  }}
                >
                  <ItemMedia>
                    {item.image_url ? (
                      <ItemThumb source={{ uri: item.image_url }} />
                    ) : (
                      <ItemThumbPlaceholder
                        style={{ backgroundColor: softFillStrong }}
                      >
                        <Ionicons
                          name="restaurant-outline"
                          size={22}
                          color={colors.textMuted}
                        />
                      </ItemThumbPlaceholder>
                    )}
                    <ItemPriceChip
                      style={{
                        backgroundColor: isLight
                          ? "rgba(255,255,255,0.94)"
                          : "rgba(28,25,23,0.88)",
                      }}
                    >
                      <ItemPrice style={{ color: colors.sidebarOrange }}>
                        {formatCurrency(item.price, currency)}
                      </ItemPrice>
                    </ItemPriceChip>
                    {inCart ? (
                      <ItemQtyControls
                        style={{
                          backgroundColor: isLight
                            ? "rgba(255,255,255,0.96)"
                            : "rgba(28,25,23,0.92)",
                          borderColor: colors.sidebarOrange,
                        }}
                      >
                        <ItemQtyBtn
                          onPress={() => changeQty(inCart.lineKey, -1)}
                          activeOpacity={0.85}
                          hitSlop={4}
                          style={{
                            backgroundColor: softFillStrong,
                          }}
                        >
                          <Ionicons
                            name="remove"
                            size={14}
                            color={colors.text}
                          />
                        </ItemQtyBtn>
                        <ItemQtyValue style={{ color: colors.text }}>
                          {inCart.quantity}
                        </ItemQtyValue>
                        <ItemQtyBtn
                          onPress={() => changeQty(inCart.lineKey, 1)}
                          activeOpacity={0.85}
                          hitSlop={4}
                          style={{
                            backgroundColor: colors.sidebarOrange,
                          }}
                        >
                          <Ionicons name="add" size={14} color="#fff" />
                        </ItemQtyBtn>
                      </ItemQtyControls>
                    ) : null}
                    {soldOut ? (
                      <SoldOutBadge
                        style={{
                          backgroundColor: isLight
                            ? "rgba(28,25,23,0.72)"
                            : "rgba(0,0,0,0.55)",
                        }}
                      >
                        <SoldOutText>{t("submitSoldOut")}</SoldOutText>
                      </SoldOutBadge>
                    ) : null}
                  </ItemMedia>
                  <ItemCopy>
                    <ItemName style={{ color: colors.text }} numberOfLines={2}>
                      {item.name}
                    </ItemName>
                    {item.description ? (
                      <ItemDesc
                        style={{ color: colors.textMuted }}
                        numberOfLines={2}
                      >
                        {item.description}
                      </ItemDesc>
                    ) : (
                      <ItemAddHint style={{ color: colors.textMuted }}>
                        {inCart ? "Adjust quantity above" : t("submitTapToAdd")}
                      </ItemAddHint>
                    )}
                  </ItemCopy>
                </ItemCard>
              );
            })}
            {!categoryItems.length ? (
              <EmptyHint style={{ color: colors.textMuted }}>
                {t("submitNoItemsInCategory")}
              </EmptyHint>
            ) : null}
          </ScrollView>
        </>
      ) : null}
    </RightPane>
  );

  return (
    <Screen style={{ backgroundColor: colors.bg }}>
      <Body $tablet={isTablet}>
        {isTablet ? (
          <>
            {cartPanel}
            {rightPanel}
          </>
        ) : (
          <>
            {rightPanel}
            {/* Reserve space for the collapsed mini bar only — expanded cart overlays above. */}
            {cartHasItems ? (
              <View style={{ height: cartCollapsedH }} />
            ) : null}
            {cartPanel}
          </>
        )}
      </Body>

      <Modal
        visible={itemSearchOpen}
        transparent
        animationType="fade"
        onRequestClose={closeItemSearch}
      >
        <ItemSearchOverlay>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeItemSearch}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{
              flex: 1,
              justifyContent: "center",
              paddingTop: Math.max(insets.top, 12) + 4,
              paddingBottom: Math.max(insets.bottom, 12),
              paddingHorizontal: isTablet ? 48 : 14,
            }}
          >
            <ItemSearchSheet
              style={{
                backgroundColor: colors.surface,
                borderColor: silverBorder,
                maxHeight: isTablet ? "78%" : "88%",
                height: isTablet ? "72%" : "82%",
                maxWidth: isTablet ? 640 : undefined,
                width: "100%",
                alignSelf: "center",
                shadowColor: "#000",
                shadowOpacity: isLight ? 0.14 : 0.35,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 12 },
                elevation: 14,
              }}
            >
              <ItemSearchTop style={{ borderBottomColor: silverBorder }}>
                <ItemSearchTitleRow>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <ItemSearchEyebrow style={{ color: colors.sidebarOrange }}>
                      Menu
                    </ItemSearchEyebrow>
                    <ItemSearchTitle style={{ color: colors.text }}>
                      {t("submitSearchTitle")}
                    </ItemSearchTitle>
                  </View>
                  <ItemSearchCloseBtn
                    onPress={closeItemSearch}
                    hitSlop={8}
                    style={{
                      backgroundColor: softFillStrong,
                      borderColor: silverBorder,
                    }}
                  >
                    <Ionicons name="close" size={18} color={colors.text} />
                  </ItemSearchCloseBtn>
                </ItemSearchTitleRow>

                <ItemSearchField
                  style={{
                    borderColor: silverBorder,
                    backgroundColor: softFill,
                  }}
                >
                  <Ionicons name="search" size={18} color={colors.sidebarOrange} />
                  <ItemSearchInput
                    value={itemSearchQuery}
                    onChangeText={setItemSearchQuery}
                    placeholder={t("submitSearchPlaceholder")}
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                    returnKeyType="search"
                    style={{ color: colors.text }}
                  />
                  {itemSearchQuery.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => setItemSearchQuery("")}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  ) : null}
                </ItemSearchField>

                {itemSearchQuery.trim() ? (
                  <ItemSearchCount style={{ color: colors.textMuted }}>
                    {itemSearchResults.length} result
                    {itemSearchResults.length === 1 ? "" : "s"}
                  </ItemSearchCount>
                ) : null}
              </ItemSearchTop>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ flex: 1 }}
                contentContainerStyle={{
                  paddingHorizontal: 14,
                  paddingTop: 12,
                  paddingBottom: 18,
                  gap: 10,
                  flexGrow: 1,
                }}
              >
                {!itemSearchQuery.trim() ? (
                  <ItemSearchEmpty>
                    <ItemSearchEmptyIcon
                      style={{
                        backgroundColor: isLight
                          ? "rgba(255, 102, 0, 0.1)"
                          : "rgba(255, 102, 0, 0.16)",
                      }}
                    >
                      <Ionicons
                        name="search-outline"
                        size={22}
                        color={colors.sidebarOrange}
                      />
                    </ItemSearchEmptyIcon>
                    <ItemSearchHint style={{ color: colors.textMuted }}>
                      {t("submitSearchHint")}
                    </ItemSearchHint>
                  </ItemSearchEmpty>
                ) : !itemSearchResults.length ? (
                  <ItemSearchEmpty>
                    <ItemSearchHint style={{ color: colors.textMuted }}>
                      {t("submitSearchNoMatch")}
                    </ItemSearchHint>
                  </ItemSearchEmpty>
                ) : (
                  itemSearchResults.map((item) => {
                    const inCart = newCartLines.find((l) => l.id === item.id);
                    const soldOut =
                      !!item.sold_out || item.available === false;
                    return (
                      <ItemSearchRow
                        key={item.id}
                        style={{
                          borderColor: inCart
                            ? colors.sidebarOrange
                            : silverBorder,
                          backgroundColor: colors.surface,
                          opacity: soldOut ? 0.55 : 1,
                        }}
                      >
                        <ItemSearchCopy>
                          <ItemSearchName
                            style={{ color: colors.text }}
                            numberOfLines={1}
                          >
                            {item.name}
                          </ItemSearchName>
                          <ItemSearchMeta style={{ color: colors.textMuted }}>
                            {categoryNameById.get(item.category_id) || "Menu"}
                            {soldOut ? ` · ${t("submitSoldOut")}` : ""}
                          </ItemSearchMeta>
                          <ItemSearchPrice
                            style={{ color: colors.sidebarOrange }}
                          >
                            {formatCurrency(item.price, currency)}
                          </ItemSearchPrice>
                        </ItemSearchCopy>

                        {soldOut ? (
                          <ItemSearchSoldTag
                            style={{
                              backgroundColor: softFillStrong,
                              borderColor: silverBorder,
                            }}
                          >
                            <ItemSearchMeta style={{ color: colors.textMuted }}>
                              {t("submitSoldOut")}
                            </ItemSearchMeta>
                          </ItemSearchSoldTag>
                        ) : inCart ? (
                          <ItemSearchQtyControls
                            style={{
                              borderColor: colors.sidebarOrange,
                              backgroundColor: softFill,
                            }}
                          >
                            <ItemQtyBtn
                              onPress={() => changeQty(inCart.lineKey, -1)}
                              activeOpacity={0.85}
                              hitSlop={4}
                              style={{ backgroundColor: softFillStrong }}
                            >
                              <Ionicons
                                name="remove"
                                size={15}
                                color={colors.text}
                              />
                            </ItemQtyBtn>
                            <ItemQtyValue style={{ color: colors.text }}>
                              {inCart.quantity}
                            </ItemQtyValue>
                            <ItemQtyBtn
                              onPress={() => changeQty(inCart.lineKey, 1)}
                              activeOpacity={0.85}
                              hitSlop={4}
                              style={{
                                backgroundColor: colors.sidebarOrange,
                              }}
                            >
                              <Ionicons name="add" size={15} color="#fff" />
                            </ItemQtyBtn>
                          </ItemSearchQtyControls>
                        ) : (
                          <ItemSearchQtyControls
                            style={{
                              borderColor: silverBorder,
                              backgroundColor: softFill,
                            }}
                          >
                            <ItemQtyBtn
                              onPress={() => addItem(item)}
                              activeOpacity={0.85}
                              hitSlop={4}
                              style={{
                                backgroundColor: softFillStrong,
                                opacity: 0.45,
                              }}
                              disabled
                            >
                              <Ionicons
                                name="remove"
                                size={15}
                                color={colors.textMuted}
                              />
                            </ItemQtyBtn>
                            <ItemQtyValue style={{ color: colors.textMuted }}>
                              0
                            </ItemQtyValue>
                            <ItemQtyBtn
                              onPress={() => addItem(item)}
                              activeOpacity={0.85}
                              hitSlop={4}
                              style={{
                                backgroundColor: colors.sidebarOrange,
                              }}
                            >
                              <Ionicons name="add" size={15} color="#fff" />
                            </ItemQtyBtn>
                          </ItemSearchQtyControls>
                        )}
                      </ItemSearchRow>
                    );
                  })
                )}
              </ScrollView>
            </ItemSearchSheet>
          </KeyboardAvoidingView>
        </ItemSearchOverlay>
      </Modal>

      <Modal
        visible={!!editLineKey}
        transparent
        animationType="fade"
        onRequestClose={closeLineEdit}
      >
        <ItemEditOverlay>
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={closeLineEdit}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{
              width: "100%",
              maxWidth: isTablet ? 580 : 440,
              alignSelf: "center",
            }}
          >
            <ItemEditModal
              style={{
                backgroundColor: colors.surface,
                borderColor: silverBorder,
                shadowColor: "#000",
                shadowOpacity: isLight ? 0.12 : 0.35,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 12 },
                elevation: 12,
              }}
            >
              <ItemEditHeader style={{ borderBottomColor: silverBorder }}>
                <ItemEditHeaderCopy>
                  <ItemEditEyebrow style={{ color: colors.sidebarOrange }}>
                    {t("submitEditItem")}
                  </ItemEditEyebrow>
                  <ItemEditTitle style={{ color: colors.text }} numberOfLines={1}>
                    {editingLine?.name || "Item"}
                  </ItemEditTitle>
                </ItemEditHeaderCopy>
                <ItemEditCloseBtn
                  onPress={closeLineEdit}
                  hitSlop={10}
                  style={{
                    backgroundColor: softFillStrong,
                    borderColor: silverBorder,
                  }}
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </ItemEditCloseBtn>
              </ItemEditHeader>

              <ItemEditBody>
                <ItemEditSidebar
                  style={{
                    borderRightColor: silverBorder,
                    backgroundColor: isLight
                      ? "rgba(28, 25, 23, 0.02)"
                      : "rgba(255,255,255,0.03)",
                  }}
                >
                  {(
                    [
                      {
                        key: "note" as const,
                        label: t("submitEditNote"),
                        icon: "document-text-outline" as const,
                        bg: colors.sidebarOrange,
                      },
                      {
                        key: "price" as const,
                        label: t("submitEditPrice"),
                        icon: "pricetag-outline" as const,
                        bg: isLight ? "#2563eb" : "#3b82f6",
                      },
                      {
                        key: "discount" as const,
                        label: t("submitEditDiscount"),
                        icon: "pricetags-outline" as const,
                        bg: isLight ? "#16a34a" : "#22c55e",
                      },
                    ] as const
                  ).map((opt) => {
                    const active = editStep === opt.key;
                    return (
                      <ItemEditNavBtn
                        key={opt.key}
                        onPress={() => setEditStep(opt.key)}
                        activeOpacity={0.88}
                        style={{
                          backgroundColor: active
                            ? colors.surface
                            : "transparent",
                          borderColor: active ? silverBorder : "transparent",
                        }}
                      >
                        <ItemEditNavIcon style={{ backgroundColor: opt.bg }}>
                          <Ionicons name={opt.icon} size={16} color="#fff" />
                        </ItemEditNavIcon>
                        <ItemEditNavText
                          style={{
                            color: active ? colors.text : colors.textMuted,
                          }}
                        >
                          {opt.label}
                        </ItemEditNavText>
                        {active ? (
                          <ItemEditNavDot
                            style={{ backgroundColor: colors.sidebarOrange }}
                          />
                        ) : null}
                      </ItemEditNavBtn>
                    );
                  })}
                </ItemEditSidebar>

                <ItemEditContent>
                  <ItemEditPanel>
                    <EditFieldLabel style={{ color: colors.textMuted }}>
                      {editStep === "note"
                        ? t("submitItemNote")
                        : editStep === "price"
                          ? t("submitUnitPrice")
                          : t("submitDiscountPercent")}
                    </EditFieldLabel>
                    {editStep === "discount" ? (
                      <ItemEditInputRow
                        style={{
                          borderColor: silverBorder,
                          backgroundColor: softFill,
                        }}
                      >
                        <CommentInput
                          value={editDrafts.discount}
                          onChangeText={(text) =>
                            setEditDrafts((prev) => {
                              if (!editingLine) {
                                return { ...prev, discount: text };
                              }
                              const pct = Number(text.replace(",", "."));
                              if (
                                Number.isFinite(pct) &&
                                pct >= 0 &&
                                pct <= 100
                              ) {
                                const nextPrice =
                                  pct === 0
                                    ? String(editingLine.basePrice)
                                    : String(
                                        Math.round(
                                          editingLine.basePrice *
                                            (1 - pct / 100) *
                                            100
                                        ) / 100
                                      );
                                return {
                                  ...prev,
                                  discount: text,
                                  price: nextPrice,
                                };
                              }
                              return { ...prev, discount: text };
                            })
                          }
                          placeholder={t("submitDiscountPlaceholder")}
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                          autoFocus
                          style={{
                            color: colors.text,
                            borderWidth: 0,
                            backgroundColor: "transparent",
                            flex: 1,
                            minHeight: 52,
                            fontSize: 22,
                            fontWeight: "800",
                            paddingVertical: 0,
                            paddingHorizontal: 0,
                            textAlignVertical: "center",
                          }}
                        />
                        <ItemEditSuffix style={{ color: colors.textMuted }}>
                          %
                        </ItemEditSuffix>
                      </ItemEditInputRow>
                    ) : (
                      <CommentInput
                        value={editDrafts[editStep]}
                        onChangeText={(text) =>
                          setEditDrafts((prev) => {
                            if (editStep === "price") {
                              return { ...prev, price: text, discount: "" };
                            }
                            return { ...prev, [editStep]: text };
                          })
                        }
                        placeholder={
                          editStep === "note" ? t("submitNotePlaceholder") : t("submitPricePlaceholder")
                        }
                        placeholderTextColor={colors.textMuted}
                        keyboardType={
                          editStep === "note" ? "default" : "decimal-pad"
                        }
                        autoFocus
                        multiline={editStep === "note"}
                        style={{
                          color: colors.text,
                          borderColor: silverBorder,
                          backgroundColor: softFill,
                          minHeight: editStep === "note" ? 112 : 52,
                          fontSize: editStep === "note" ? 15 : 22,
                          fontWeight: editStep === "note" ? "500" : "800",
                          textAlignVertical:
                            editStep === "note" ? "top" : "center",
                        }}
                      />
                    )}
                    {editStep === "discount" && editingLine ? (
                      <ItemEditHint style={{ color: colors.textMuted }}>
                        Base {formatCurrency(editingLine.basePrice, currency)}
                        {editDrafts.price
                          ? `  →  ${formatCurrency(
                              Number(editDrafts.price) || 0,
                              currency
                            )}`
                          : ""}
                      </ItemEditHint>
                    ) : editStep === "price" && editingLine ? (
                      <ItemEditHint style={{ color: colors.textMuted }}>
                        Menu price{" "}
                        {formatCurrency(editingLine.basePrice, currency)}
                      </ItemEditHint>
                    ) : (
                      <ItemEditHint style={{ color: colors.textMuted }}>
                        {t("submitNoteHint")}
                      </ItemEditHint>
                    )}
                  </ItemEditPanel>

                  <ItemEditFooter style={{ borderTopColor: silverBorder }}>
                    <EditActionBtn
                      onPress={closeLineEdit}
                      style={{
                        borderColor: silverBorder,
                        backgroundColor: softFillStrong,
                      }}
                    >
                      <EditActionText style={{ color: colors.text }}>
                        {t("cancel")}
                      </EditActionText>
                    </EditActionBtn>
                    <EditActionBtn
                      onPress={saveLineEdit}
                      style={{
                        borderColor: colors.sidebarOrange,
                        backgroundColor: colors.sidebarOrange,
                      }}
                    >
                      <EditActionText style={{ color: "#fff" }}>
                        {t("submitSaveChanges")}
                      </EditActionText>
                    </EditActionBtn>
                  </ItemEditFooter>
                </ItemEditContent>
              </ItemEditBody>
            </ItemEditModal>
          </KeyboardAvoidingView>
        </ItemEditOverlay>
      </Modal>

      <Modal
        visible={orderMenuMounted && orderEditStep === "menu"}
        transparent
        animationType="none"
        onRequestClose={() => animateCloseOrderMenu()}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => animateCloseOrderMenu()}
          />
          {cartDimBounds && cartFooterBounds && orderMenuAnchor
            ? (() => {
                const dimShift = 70;
                const menuH = orderMenuBlockHeight();
                const placement = resolveFloatingMenuPlacement(
                  orderMenuAnchor.y,
                  orderMenuAnchor.height,
                  ORDER_MENU_COUNT,
                  height
                );
                orderMenuPlacementRef.current = placement;
                const baseTop =
                  placement === "above"
                    ? orderMenuAnchor.y -
                      ORDER_MENU_BOTTOM_OFFSET -
                      menuH
                    : orderMenuAnchor.y - 10;
                const baseBottom =
                  placement === "above"
                    ? cartFooterBounds.y + cartFooterBounds.height
                    : orderMenuAnchor.y +
                      orderMenuAnchor.height +
                      ORDER_MENU_BOTTOM_OFFSET +
                      menuH +
                      10;
                return (
                  <LinearGradient
                    pointerEvents="none"
                    colors={
                      isLight
                        ? [
                            "rgba(255, 255, 255, 0.92)",
                            "rgba(255, 255, 255, 0.55)",
                            "rgba(255, 255, 255, 0.22)",
                            "rgba(255, 255, 255, 0)",
                          ]
                        : [
                            "rgba(28, 25, 23, 0.55)",
                            "rgba(28, 25, 23, 0.32)",
                            "rgba(28, 25, 23, 0.12)",
                            "rgba(28, 25, 23, 0)",
                          ]
                    }
                    locations={[0, 0.28, 0.62, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={{
                      position: "absolute",
                      left: cartDimBounds.x,
                      top:
                        placement === "above"
                          ? baseTop - dimShift
                          : baseTop,
                      width: cartDimBounds.width,
                      height: Math.max(
                        0,
                        baseBottom -
                          (placement === "above"
                            ? baseTop - dimShift
                            : baseTop) +
                          (placement === "below" ? dimShift : 0)
                      ),
                    }}
                  />
                );
              })()
            : null}
          {orderMenuAnchor
            ? (() => {
                const placement = resolveFloatingMenuPlacement(
                  orderMenuAnchor.y,
                  orderMenuAnchor.height,
                  ORDER_MENU_COUNT,
                  height
                );
                orderMenuPlacementRef.current = placement;
                return (
                  <FloatingEditMenu
                    pointerEvents="box-none"
                    style={{
                      left: orderMenuAnchor.x + 6,
                      ...(placement === "above"
                        ? {
                            bottom:
                              height -
                              orderMenuAnchor.y -
                              ORDER_MENU_BOTTOM_OFFSET,
                          }
                        : {
                            top:
                              orderMenuAnchor.y +
                              orderMenuAnchor.height +
                              ORDER_MENU_BOTTOM_OFFSET,
                          }),
                    }}
                  >
                    {(
                      [
                        {
                          key: "note",
                          label: t("submitEditNote"),
                          icon: "document-text-outline" as const,
                          bg: colors.sidebarOrange,
                          disabled: false,
                          onPress: () => openOrderEditField("note"),
                        },
                        {
                          key: "discount",
                          label:
                            orderDiscountPercent != null
                              ? `${t("submitEditDiscount")} (−${orderDiscountPercent}%)`
                              : t("submitEditDiscount"),
                          icon: "pricetags-outline" as const,
                          bg: colors.sidebarOrange,
                          disabled: false,
                          onPress: () => openOrderEditField("discount"),
                        },
                        {
                          key: "submit-new",
                          label: t("submitSubmitNewOrder"),
                          icon: "add-circle-outline" as const,
                          bg: isLight ? "#16a34a" : "#22c55e",
                          disabled: false,
                          onPress: handleSubmitSeparateOrder,
                        },
                        {
                          key: "join",
                          label: canJoinOrders
                            ? `${t("submitJoinOrders")} (${activeOrdersForSelectedTable.length})`
                            : t("submitJoinOrders"),
                          icon: "layers-outline" as const,
                          bg: isLight ? "#2563eb" : "#3b82f6",
                          disabled: false,
                          onPress: handleJoinOrders,
                        },
                        {
                          key: "cancel",
                          label: t("submitCancelTheOrder"),
                          icon: "close-circle-outline" as const,
                          bg: selectedTableId ? "#dc2626" : colors.textMuted,
                          disabled: !selectedTableId,
                          onPress: handleCancelOrder,
                        },
                      ] as const
                    ).map((opt, index) => (
                      <StaggerMenuOption
                        key={opt.key}
                        progress={orderMenuItemAnims[index]}
                        disabled={opt.disabled}
                        onPress={opt.onPress}
                      >
                        <FloatingEditIcon style={{ backgroundColor: opt.bg }}>
                          <Ionicons name={opt.icon} size={22} color="#fff" />
                        </FloatingEditIcon>
                        <FloatingEditLabel style={{ color: colors.text }}>
                          {opt.label}
                        </FloatingEditLabel>
                      </StaggerMenuOption>
                    ))}
                  </FloatingEditMenu>
                );
              })()
            : null}
        </View>
      </Modal>

      <Modal
        visible={orderMenuOpen && orderEditStep !== "menu"}
        transparent
        animationType="fade"
        onRequestClose={closeOrderMenu}
      >
        <EditOverlay>
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={closeOrderMenu}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", maxWidth: 380, alignSelf: "center" }}
          >
            <EditSheet
              style={{
                backgroundColor: colors.surface,
                borderColor: silverBorder,
              }}
            >
              <EditSheetTitle style={{ color: colors.text }}>
                Order options
              </EditSheetTitle>
              <EditFieldBlock>
                <EditFieldLabel style={{ color: colors.textMuted }}>
                  {orderEditStep === "note" ? t("submitEditNote") : t("submitEditDiscount")}
                </EditFieldLabel>
                <CommentInput
                  value={orderEditDraft}
                  onChangeText={setOrderEditDraft}
                  placeholder={
                    orderEditStep === "note" ? t("submitNotePlaceholder") : t("submitDiscountPlaceholder")
                  }
                  placeholderTextColor={colors.textMuted}
                  keyboardType={
                    orderEditStep === "note" ? "default" : "decimal-pad"
                  }
                  autoFocus
                  multiline={orderEditStep === "note"}
                  style={{
                    color: colors.text,
                    borderColor: silverBorder,
                    backgroundColor: softFill,
                    minHeight: orderEditStep === "note" ? 88 : undefined,
                    textAlignVertical: orderEditStep === "note" ? "top" : "center",
                  }}
                />
                <EditActions>
                  <EditActionBtn
                    onPress={() => {
                      setOrderEditStep("menu");
                      setOrderMenuMounted(true);
                    }}
                    style={{
                      borderColor: silverBorder,
                      backgroundColor: softFillStrong,
                    }}
                  >
                    <EditActionText style={{ color: colors.text }}>Back</EditActionText>
                  </EditActionBtn>
                  <EditActionBtn
                    onPress={saveOrderEdit}
                    style={{
                      borderColor: colors.sidebarOrange,
                      backgroundColor: colors.sidebarOrange,
                    }}
                  >
                    <EditActionText style={{ color: "#fff" }}>{t("save")}</EditActionText>
                  </EditActionBtn>
                </EditActions>
              </EditFieldBlock>
              <EditCancelBtn onPress={closeOrderMenu}>
                <EditCancelText style={{ color: colors.textMuted }}>{t("cancel")}</EditCancelText>
              </EditCancelBtn>
            </EditSheet>
          </KeyboardAvoidingView>
        </EditOverlay>
      </Modal>
    </Screen>
  );
}

const Screen = styled.View`
  flex: 1;
`;

const Body = styled.View<{ $tablet: boolean }>`
  flex: 1;
  flex-direction: ${(p) => (p.$tablet ? "row" : "column")};
  min-height: 0;
  position: relative;
`;

const CartPane = styled.View`
  min-width: 0;
  min-height: 0;
`;

const CartSheetHandle = styled.View`
  width: 48px;
  height: 5px;
  border-radius: 999px;
  align-self: center;
`;

const CartMiniBar = styled.View`
  border-bottom-width: 1px;
  padding-top: 8px;
  padding-horizontal: 16px;
`;

const CartMiniRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
`;

const CartCloseBtn = styled.TouchableOpacity`
  position: absolute;
  top: 28px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
  z-index: 2;
`;

const CartExpandedMeta = styled.View`
  padding: 8px 16px 10px;
  border-bottom-width: 1px;
  flex-direction: row;
  align-items: center;
`;

const CartHeader = styled.View`
  padding: 16px 16px 14px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom-width: 1px;
`;

const CartHeaderLeft = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex-shrink: 1;
  min-width: 0;
`;

const CartTitle = styled.Text`
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.5px;
`;

const CartCountPill = styled.View`
  min-width: 24px;
  height: 24px;
  padding: 0 7px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;

const CartCountText = styled.Text`
  font-size: 12px;
  font-weight: 800;
`;

const TableBadge = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-radius: 999px;
  border-width: 1px;
  max-width: 58%;
  flex-shrink: 1;
`;

const TableBadgeDot = styled.View`
  width: 7px;
  height: 7px;
  border-radius: 999px;
`;

const TableBadgeText = styled.Text`
  font-size: 13px;
  font-weight: 800;
  flex-shrink: 1;
  letter-spacing: -0.1px;
`;

const CartRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom-width: 1px;
`;

const CartRowName = styled.Text`
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.2px;
`;

const CartRowMeta = styled.Text`
  font-size: 12px;
  font-weight: 500;
  margin-top: 3px;
`;

const QtyControls = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
`;

const EditBtn = styled.TouchableOpacity`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
  margin-right: 2px;
`;

const FloatingEditMenu = styled.View`
  position: absolute;
  gap: 12px;
  align-items: flex-start;
`;

const FloatingEditOption = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const FloatingEditIcon = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;

const FloatingEditLabel = styled.Text`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const QtyBtn = styled.TouchableOpacity`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const QtyValue = styled.Text`
  min-width: 16px;
  text-align: center;
  font-size: 14px;
  font-weight: 800;
`;

const EditOverlay = styled.View`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.45);
  justify-content: center;
  padding: 24px;
`;

const ItemEditOverlay = styled.View`
  flex: 1;
  background-color: rgba(15, 14, 13, 0.42);
  justify-content: center;
  padding: 22px;
`;

const EditSheet = styled.View`
  border-radius: 20px;
  border-width: 1px;
  padding: 18px 16px 12px;
  gap: 12px;
`;

const EditSheetTitle = styled.Text`
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.2px;
  padding-horizontal: 2px;
`;

const ItemEditModal = styled.View`
  border-radius: 22px;
  border-width: 1px;
  overflow: hidden;
  min-height: 300px;
`;

const ItemEditHeader = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 16px 14px;
  border-bottom-width: 1px;
`;

const ItemEditHeaderCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 3px;
`;

const ItemEditEyebrow = styled.Text`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
`;

const ItemEditTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.3px;
`;

const ItemEditCloseBtn = styled.TouchableOpacity`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const ItemEditBody = styled.View`
  flex-direction: row;
  min-height: 250px;
`;

const ItemEditSidebar = styled.View`
  width: 36%;
  max-width: 168px;
  padding: 10px 8px;
  gap: 6px;
  border-right-width: 1px;
`;

const ItemEditNavBtn = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 14px;
  border-width: 1px;
`;

const ItemEditNavIcon = styled.View`
  width: 30px;
  height: 30px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;

const ItemEditNavText = styled.Text`
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.1px;
`;

const ItemEditNavDot = styled.View`
  width: 7px;
  height: 7px;
  border-radius: 999px;
`;

const ItemEditContent = styled.View`
  flex: 1;
  min-width: 0;
`;

const ItemEditPanel = styled.View`
  flex: 1;
  padding: 14px 16px 10px;
  gap: 10px;
`;

const ItemEditInputRow = styled.View`
  flex-direction: row;
  align-items: center;
  border-width: 1px;
  border-radius: 14px;
  padding: 0 14px;
  min-height: 52px;
  gap: 8px;
`;

const ItemEditSuffix = styled.Text`
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.3px;
`;

const ItemEditHint = styled.Text`
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
`;

const ItemEditFooter = styled.View`
  flex-direction: row;
  gap: 8px;
  padding: 12px 14px 14px;
  border-top-width: 1px;
`;

const EditOptions = styled.View`
  gap: 8px;
`;

const EditOptionBtn = styled.TouchableOpacity`
  height: 48px;
  border-radius: 14px;
  border-width: 1px;
  padding: 0 14px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
`;

const EditOptionText = styled.Text`
  flex: 1;
  font-size: 15px;
  font-weight: 700;
`;

const EditFieldBlock = styled.View`
  gap: 8px;
`;

const EditFieldLabel = styled.Text`
  font-size: 12px;
  font-weight: 700;
  padding-horizontal: 2px;
`;

const EditActions = styled.View`
  flex-direction: row;
  gap: 8px;
  margin-top: 4px;
`;

const EditActionBtn = styled.TouchableOpacity`
  flex: 1;
  height: 44px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const EditActionText = styled.Text`
  font-size: 13px;
  font-weight: 800;
`;

const EditCancelBtn = styled.TouchableOpacity`
  align-items: center;
  padding: 8px;
`;

const EditCancelText = styled.Text`
  font-size: 13px;
  font-weight: 600;
`;

const CartFooter = styled.View`
  border-top-width: 1px;
  padding: 10px 12px 12px;
`;

const FooterActions = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const FooterLeft = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const IconActionBtn = styled.TouchableOpacity`
  width: 48px;
  height: 48px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const CheckoutBtn = styled.TouchableOpacity`
  height: 48px;
  padding: 0 22px;
  border-radius: 999px;
  border-width: 1px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 140px;
`;

const CommentInput = styled(TextInput)`
  border-width: 1px;
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
`;

const ActionBtnText = styled.Text`
  font-size: 13px;
  font-weight: 800;
`;

const RightPane = styled.View`
  flex: 1;
  min-width: 0;
  min-height: 0;
`;

const PaneHeader = styled.View<{ $stack?: boolean }>`
  padding: 14px 16px 8px;
  flex-direction: ${(p) => (p.$stack ? "column" : "row")};
  align-items: ${(p) => (p.$stack ? "stretch" : "center")};
  justify-content: space-between;
  gap: 10px;
`;

const PaneTitle = styled.Text`
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.3px;
`;

const PaneHint = styled.Text`
  font-size: 12px;
  font-weight: 500;
`;

const FloorViewBtn = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  border-width: 1px;
  flex-shrink: 0;
`;

const FloorViewBtnText = styled.Text`
  font-size: 13px;
  font-weight: 700;
`;

const ActiveTableCard = styled.TouchableOpacity`
  border-width: 1.5px;
  border-radius: 18px;
  overflow: hidden;
`;

const ActiveTableCardHeader = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 12px;
`;

const ActiveTableHeaderCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 2px;
`;

const ActiveTableName = styled.Text`
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.3px;
`;

const ActiveTableOrderIndex = styled.Text`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.3px;
  flex-shrink: 0;
`;

const ActiveTableOrdersList = styled.View`
  border-top-width: 1px;
  padding: 10px 12px;
  gap: 8px;
`;

const ActiveTableOrderRow = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 4px;
`;

const ActiveItemQty = styled.Text`
  font-size: 13px;
  font-weight: 800;
  padding-top: 1px;
`;

const ActiveItemName = styled.Text`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
`;

const ActiveItemPrice = styled.Text`
  font-size: 12px;
  font-weight: 600;
  padding-top: 1px;
  margin-left: 8px;
`;

const ActiveTableMore = styled.Text`
  font-size: 12px;
  font-weight: 600;
  padding-left: 2px;
`;

const ActiveTableCardFooter = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px 13px;
`;

const ActiveTableTotalLabel = styled.Text`
  font-size: 12px;
  font-weight: 600;
`;

const ActiveTableTotalValue = styled.Text`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const ActiveOrdersEmpty = styled.View`
  width: 100%;
  align-items: center;
  justify-content: center;
  padding: 48px 24px 32px;
  gap: 8px;
`;

const ActiveOrdersEmptyIcon = styled.View`
  width: 64px;
  height: 64px;
  border-radius: 20px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
`;

const ActiveOrdersEmptyTitle = styled.Text`
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const ActiveOrdersEmptyHint = styled.Text`
  font-size: 13px;
  font-weight: 500;
  text-align: center;
`;

const ChangeTableLink = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  border-width: 1px;
  flex-shrink: 0;
`;

const ChangeTableText = styled.Text`
  font-size: 12px;
  font-weight: 700;
`;

const BackRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
`;

const BackChip = styled.View`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const MapViewport = styled.View`
  flex: 1;
  min-height: 0;
  position: relative;
`;

const MapStage = styled.View`
  border-width: 1px;
  border-radius: 20px;
  overflow: hidden;
  position: relative;
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

const MapTableNumber = styled.Text`
  font-weight: 800;
  letter-spacing: -0.4px;
`;

const MapTableName = styled.Text`
  font-weight: 600;
  max-width: 100%;
  text-align: center;
`;

const MapTableTime = styled.Text`
  font-weight: 700;
  letter-spacing: -0.1px;
  text-align: center;
`;

const MapZoomBar = styled.View`
  position: absolute;
  right: 14px;
  bottom: 14px;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  border-width: 1px;
`;

const MapZoomBtn = styled.TouchableOpacity`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;

const MapZoomLevel = styled.Text`
  min-width: 44px;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
`;

const CategoryCard = styled.TouchableOpacity`
  border-width: 1px;
  border-radius: 18px;
  min-height: 92px;
  padding: 14px 12px 14px 14px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  overflow: hidden;
`;

const CategoryCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 8px;
`;

const CategoryName = styled.Text`
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.3px;
  line-height: 21px;
`;

const CategoryMetaChip = styled.View`
  align-self: flex-start;
  padding: 3px 8px;
  border-radius: 999px;
`;

const CategoryMeta = styled.Text`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: -0.1px;
`;

const CategoryChevron = styled.View`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const CategoriesPaneFooter = styled.View`
  position: absolute;
  right: 20px;
  bottom: 20px;
  align-items: flex-end;
  gap: 16px;
  min-width: 280px;
  z-index: 0;
  elevation: 0;
`;

const CategoriesBrandRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 14px;
`;

const CategoriesBrandMark = styled.Image`
  width: 96px;
  height: 96px;
  border-radius: 24px;
`;

const CategoriesBrandCopy = styled.View`
  gap: 3px;
`;

const CategoriesBrandName = styled.Text`
  font-size: 48px;
  font-weight: 700;
  letter-spacing: -1.4px;
  line-height: 52px;
  font-family: ${Platform.OS === "ios" ? "Georgia" : "serif"};
  font-style: italic;
`;

const CategoriesBrandTag = styled.Text`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 3.2px;
  text-transform: uppercase;
  font-family: ${Platform.OS === "ios" ? "AvenirNext-Medium" : "sans-serif-medium"};
`;

const ItemCard = styled.TouchableOpacity`
  border-width: 1.5px;
  border-radius: 20px;
  overflow: hidden;
  min-height: 168px;
`;

const ItemMedia = styled.View`
  position: relative;
  width: 100%;
  height: 96px;
`;

const ItemThumb = styled.Image`
  width: 100%;
  height: 96px;
  background: rgba(28, 25, 23, 0.04);
`;

const ItemThumbPlaceholder = styled.View`
  width: 100%;
  height: 96px;
  align-items: center;
  justify-content: center;
`;

const ItemPriceChip = styled.View`
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 4px 8px;
  border-radius: 999px;
`;

const ItemCopy = styled.View`
  padding: 10px 12px 12px;
  gap: 4px;
`;

const ItemName = styled.Text`
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.2px;
  line-height: 18px;
`;

const ItemDesc = styled.Text`
  font-size: 11px;
  font-weight: 500;
  line-height: 15px;
`;

const ItemAddHint = styled.Text`
  font-size: 11px;
  font-weight: 600;
`;

const ItemPrice = styled.Text`
  font-size: 12px;
  font-weight: 800;
`;

const ItemQtyControls = styled.View`
  position: absolute;
  top: 8px;
  right: 8px;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  border-width: 1px;
`;

const ItemQtyBtn = styled.TouchableOpacity`
  width: 26px;
  height: 26px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;

const ItemQtyValue = styled.Text`
  min-width: 18px;
  text-align: center;
  font-size: 13px;
  font-weight: 800;
`;

const SoldOutBadge = styled.View`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  align-items: center;
  justify-content: center;
`;

const SoldOutText = styled.Text`
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.2px;
`;

const EmptyHint = styled.Text`
  font-size: 13px;
  font-weight: 500;
  padding: 12px 4px;
`;

const ItemSearchOverlay = styled.View`
  flex: 1;
  background-color: rgba(15, 14, 13, 0.48);
`;

const ItemSearchSheet = styled.View`
  border-radius: 22px;
  border-width: 1px;
  overflow: hidden;
  min-height: 320px;
`;

const ItemSearchTop = styled.View`
  padding: 16px 14px 12px;
  gap: 12px;
  border-bottom-width: 1px;
`;

const ItemSearchTitleRow = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
`;

const ItemSearchEyebrow = styled.Text`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.7px;
  text-transform: uppercase;
`;

const ItemSearchTitle = styled.Text`
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.4px;
`;

const ItemSearchCloseBtn = styled.TouchableOpacity`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const ItemSearchField = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  border-width: 1px;
  border-radius: 14px;
  padding: 0 12px;
  min-height: 46px;
`;

const ItemSearchInput = styled.TextInput`
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  padding-vertical: 10px;
`;

const ItemSearchCount = styled.Text`
  font-size: 12px;
  font-weight: 700;
`;

const ItemSearchEmpty = styled.View`
  align-items: center;
  gap: 12px;
  padding: 28px 16px;
`;

const ItemSearchEmptyIcon = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 16px;
  align-items: center;
  justify-content: center;
`;

const ItemSearchHint = styled.Text`
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  line-height: 20px;
`;

const ItemSearchRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  border-width: 1px;
  border-radius: 16px;
  padding: 12px 12px;
`;

const ItemSearchCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 3px;
`;

const ItemSearchName = styled.Text`
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.25px;
`;

const ItemSearchMeta = styled.Text`
  font-size: 12px;
  font-weight: 600;
`;

const ItemSearchPrice = styled.Text`
  font-size: 14px;
  font-weight: 800;
  margin-top: 2px;
`;

const ItemSearchQtyControls = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  border-width: 1px;
  flex-shrink: 0;
`;

const ItemSearchSoldTag = styled.View`
  border-width: 1px;
  border-radius: 999px;
  padding: 6px 10px;
`;

export default function GatedSubmitOrderScreen() {
  return (
    <PlanGate feature="staffOrders">
      <SubmitOrderScreen />
    </PlanGate>
  );
}
