import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Pressable,
  useWindowDimensions,
  Image,
  ScrollView,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import type { RenderItemParams } from "react-native-draggable-flatlist";
import { supabase } from "@/src/services/supabase";
import { useRestaurant } from "@/src/context/RestaurantContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { formatCurrency } from "@/src/utils/currency";
import { StockStatusSwitch } from "@/src/components/StockStatusSwitch";
import { VisibilitySwitch } from "@/src/components/VisibilitySwitch";
import { StatusToast, type ToastPayload, type ToastTone } from "@/src/components/StatusToast";
import { DeleteConfirmModal } from "@/src/components/DeleteConfirmModal";
import { useFormSheetAboveKeyboard } from "@/src/hooks/useKeyboardBottomInset";

type Category = {
  id: string;
  name: string;
  order_index?: number | null;
  available?: boolean | null;
};

type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  image_public_id?: string | null;
  available?: boolean | null;
  sold_out?: boolean | null;
  category_id?: string | null;
  order_index?: number | null;
};

const asAvailable = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "t" || normalized === "on") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "f" || normalized === "off") return false;
  }
  if (typeof value === "number") return value !== 0;
  return true;
};

const asSoldOut = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "t" || normalized === "on") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "f" || normalized === "off") return false;
  }
  if (typeof value === "number") return value !== 0;
  return false;
};

function MiniToggle({
  value,
  onToggle,
  colors,
  selected = false,
}: {
  value: boolean;
  onToggle: (next: boolean) => void;
  colors: { primary: string; containerBorderStrong: string; containerBorderSubtle: string; surface: string };
  selected?: boolean;
}) {
  const onBg = selected ? "rgba(255,255,255,0.75)" : "rgba(255, 102, 0, 0.85)";
  const offBg = selected ? "rgba(255,255,255,0.3)" : colors.containerBorderSubtle;
  const borderColor = selected ? "rgba(255,255,255,0.55)" : value ? colors.primary : colors.containerBorderStrong;

  return (
    <MiniSwitchPress onPress={() => onToggle(!value)} activeOpacity={0.8}>
      <MiniSwitchTrack style={{ backgroundColor: value ? onBg : offBg, borderColor }}>
        <MiniSwitchThumb style={{ transform: [{ translateX: value ? 18 : 0 }], backgroundColor: "#fff" }} />
      </MiniSwitchTrack>
    </MiniSwitchPress>
  );
}

function DragGrip({ color }: { color: string }) {
  return (
    <DragGripStack>
      <Ionicons name="chevron-up" size={12} color={color} />
      <Ionicons name="reorder-three" size={18} color={color} />
      <Ionicons name="chevron-down" size={12} color={color} />
    </DragGripStack>
  );
}

export default function CategoriesIndex() {
  const router = useRouter();
  const navigation = useNavigation();
  const { restaurant } = useRestaurant();
  const { t } = useLanguage();
  const { colors, theme } = useTheme();
  const isLight = theme === "light";
  const currency = restaurant?.currency ?? "USD";
  const hairline = isLight ? "rgba(148, 163, 184, 0.32)" : "rgba(168, 162, 158, 0.28)";
  const rowRule = isLight ? "rgba(28, 25, 23, 0.06)" : "rgba(255,255,255,0.08)";
  const { width } = useWindowDimensions();
  const formSheetKeyboardStyle = useFormSheetAboveKeyboard();
  const isTablet = width >= 900;
  const [categories, setCategories] = useState<Category[]>([]);
  const [itemsByCategory, setItemsByCategory] = useState<Record<string, MenuItem[]>>({});
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryAvailable, setCategoryAvailable] = useState(false);
  const [categoryFormError, setCategoryFormError] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemAvailable, setItemAvailable] = useState(false);
  const [itemSoldOut, setItemSoldOut] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const toastSeq = useRef(0);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    { type: "category"; category: Category } | { type: "item"; item: MenuItem } | null
  >(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const deleteCloudinaryImage = async (publicId: string) => {
    const { error } = await supabase.functions.invoke("delete-cloudinary-image", {
      body: { public_id: publicId },
    });
    if (error) throw new Error(error.message);
  };

  const showToast = (text: string, tone: ToastTone = "neutral") => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, message: text, tone });
  };

  const loadCategories = async () => {
    if (!restaurant?.id) return;
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("order_index", { ascending: true, nullsFirst: false });
    if (error) {
      setErrorMessage(error.message);
      setCategories([]);
      setSelectedCategoryId(null);
      return;
    }
    const list = ((data ?? []) as Category[]).map((cat) => ({
      ...cat,
      id: String(cat.id),
    }));
    setCategories(list);
    setSelectedCategoryId((prev) => {
      if (prev && list.some((c) => String(c.id) === String(prev))) return prev;
      return list[0]?.id ?? null;
    });
  };

  const loadItems = async () => {
    if (!restaurant?.id) return;
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, description, price, image_url, image_public_id, available, sold_out, category_id, order_index")
      .eq("restaurant_id", restaurant.id)
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (error) {
      setErrorMessage(error.message);
      setItemsByCategory({});
      return;
    }

    const grouped: Record<string, MenuItem[]> = {};
    const normalizedItems: MenuItem[] = [];
    ((data as MenuItem[] | null) ?? []).forEach((item) => {
      const normalized = {
        ...item,
        id: String(item.id),
        category_id: item.category_id != null ? String(item.category_id) : null,
      };
      normalizedItems.push(normalized);
      const key = String(normalized.category_id ?? "uncategorized");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(normalized);
    });
    setAllItems(normalizedItems);
    setItemsByCategory(grouped);
  };

  useEffect(() => {
    loadCategories();
    loadItems();
  }, [restaurant?.id]);

  const updateOrderIndexes = async (next: Category[]) => {
    await Promise.all(
      next.map((cat, index) =>
        supabase.from("categories").update({ order_index: index + 1 }).eq("id", cat.id)
      )
    );
    loadCategories();
  };

  const closeCategoryModal = () => {
    setCategoryModalOpen(false);
    setEditingCategoryId(null);
    setCategoryName("");
    setCategoryAvailable(false);
    setCategoryFormError("");
  };

  const openAddCategoryModal = () => {
    setEditingCategoryId(null);
    setCategoryName("");
    setCategoryAvailable(false);
    setCategoryFormError("");
    setCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setCategoryName(cat.name ?? "");
    setCategoryAvailable(asAvailable(cat.available));
    setCategoryFormError("");
    setCategoryModalOpen(true);
  };

  const handleSubmitCategory = async () => {
    if (!restaurant?.id || !categoryName.trim()) {
      setCategoryFormError(t("menuErrorCategoryRequired"));
      return;
    }
    setLoading(true);
    setCategoryFormError("");

    const payload = {
      name: categoryName.trim(),
      available: categoryAvailable,
    };

    if (editingCategoryId) {
      const { error } = await supabase
        .from("categories")
        .update(payload)
        .eq("id", editingCategoryId)
        .eq("restaurant_id", restaurant.id);
      setLoading(false);
      if (error) {
        setCategoryFormError(error.message);
        return;
      }
      closeCategoryModal();
      await loadCategories();
      await loadItems();
      showToast(`“${payload.name}” updated`, "success");
    } else {
      const maxOrder = categories.reduce(
        (max, c) => Math.max(max, Number(c.order_index ?? 0)),
        0
      );
      const { error } = await supabase.from("categories").insert({
        restaurant_id: restaurant.id,
        order_index: maxOrder + 1,
        ...payload,
      });
      setLoading(false);
      if (error) {
        setCategoryFormError(error.message);
        return;
      }
      closeCategoryModal();
      await loadCategories();
      await loadItems();
      showToast(`“${payload.name}” added`, "success");
    }
  };

  const handleToggleAvailability = async (id: string, next: boolean) => {
    const prevCategories = categories;
    const catName = categories.find((cat) => String(cat.id) === String(id))?.name ?? "Category";
    setCategories((prev) =>
      prev.map((cat) => (String(cat.id) === String(id) ? { ...cat, available: next } : cat))
    );
    const { error } = await supabase
      .from("categories")
      .update({ available: next })
      .eq("id", id);
    if (error) {
      setCategories(prevCategories);
      setErrorMessage(error.message);
      return;
    }
    showToast(
      next
        ? `“${catName}” is now visible on the menu`
        : `“${catName}” is hidden from the menu`,
      next ? "success" : "muted"
    );
  };

  const handleDeleteCategoryPress = (cat: Category) => {
    setDeleteTarget({ type: "category", category: cat });
  };

  const handleDeleteItemPress = (item: MenuItem) => {
    setDeleteTarget({ type: "item", item });
  };

  const closeDeleteConfirm = () => {
    if (deleteLoading) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !restaurant?.id) return;

    const target = deleteTarget;
    setDeleteLoading(true);
    try {
      if (target.type === "category") {
        const cat = target.category;

        const { data: itemsInCategory, error: itemsFetchError } = await supabase
          .from("menu_items")
          .select("id, image_public_id")
          .eq("category_id", cat.id)
          .eq("restaurant_id", restaurant.id);

        if (itemsFetchError) throw new Error(itemsFetchError.message);

        for (const item of itemsInCategory ?? []) {
          if (item.image_public_id) {
            try {
              await deleteCloudinaryImage(item.image_public_id);
            } catch {
              /* continue — still remove DB rows */
            }
          }
        }

        if ((itemsInCategory?.length ?? 0) > 0) {
          const { data: deletedItems, error: itemsError } = await supabase
            .from("menu_items")
            .delete()
            .eq("category_id", cat.id)
            .eq("restaurant_id", restaurant.id)
            .select("id");
          if (itemsError) throw new Error(itemsError.message);
          if ((deletedItems?.length ?? 0) < (itemsInCategory?.length ?? 0)) {
            throw new Error("Could not delete all items in this category.");
          }
        }

        const { data: deletedCategories, error } = await supabase
          .from("categories")
          .delete()
          .eq("id", cat.id)
          .eq("restaurant_id", restaurant.id)
          .select("id");

        if (error) throw new Error(error.message);
        if (!deletedCategories?.length) {
          throw new Error("Could not delete category. Try again or check your connection.");
        }

        const deletedId = String(cat.id);
        setCategories((prev) => prev.filter((c) => String(c.id) !== deletedId));
        setAllItems((prev) => prev.filter((item) => String(item.category_id) !== deletedId));
        setItemsByCategory((prev) => {
          const next = { ...prev };
          delete next[deletedId];
          return next;
        });
        setSelectedCategoryId((prev) => (String(prev) === deletedId ? null : prev));
        setDeleteTarget(null);
        await loadCategories();
        await loadItems();
        showToast(`“${cat.name}” deleted`, "success");
      } else {
        const item = target.item;
        if (item.image_public_id) {
          try {
            await deleteCloudinaryImage(item.image_public_id);
          } catch (e) {
            throw new Error((e as Error).message || "Failed to delete image.");
          }
        }

        const { data: deletedItems, error } = await supabase
          .from("menu_items")
          .delete()
          .eq("id", item.id)
          .eq("restaurant_id", restaurant.id)
          .select("id");

        if (error) throw new Error(error.message);
        if (!deletedItems?.length) {
          throw new Error("Could not delete item. Try again or check your connection.");
        }

        const deletedId = String(item.id);
        const categoryKey = item.category_id != null ? String(item.category_id) : "uncategorized";
        setAllItems((prev) => prev.filter((row) => String(row.id) !== deletedId));
        setItemsByCategory((prev) => ({
          ...prev,
          [categoryKey]: (prev[categoryKey] ?? []).filter((row) => String(row.id) !== deletedId),
        }));
        setDeleteTarget(null);
        await loadItems();
        showToast(`“${item.name}” deleted`, "success");
      }
    } catch (e) {
      showToast((e as Error).message || "Delete failed.", "muted");
    } finally {
      setDeleteLoading(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRightContainerStyle: {
        paddingRight: 6,
        paddingVertical: 2,
      },
      headerRight: () => (
        <HeaderAddButton onPress={openAddCategoryModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add" size={20} color="#fff" />
        </HeaderAddButton>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    setSelectedCategoryId((prev) => {
      if (!categories.length) return null;
      if (prev && categories.some((cat) => String(cat.id) === String(prev))) return prev;
      return categories[0].id;
    });
  }, [categories]);

  const selectedCategory =
    categories.find((cat) => String(cat.id) === String(selectedCategoryId)) ?? categories[0] ?? null;
  const selectedItems = selectedCategory?.id
    ? allItems.filter((item) => String(item.category_id) === String(selectedCategory.id))
    : [];

  const updateItemOrderIndexes = async (next: MenuItem[]) => {
    await Promise.all(
      next.map((item, index) =>
        supabase.from("menu_items").update({ order_index: index + 1 }).eq("id", item.id)
      )
    );
    loadItems();
  };

  const openAddItemModal = () => {
    if (!selectedCategory?.id) return;
    setEditingItemId(null);
    setItemName("");
    setItemDescription("");
    setItemPrice("");
    setItemAvailable(false);
    setItemSoldOut(false);
    setErrorMessage("");
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: MenuItem) => {
    setEditingItemId(item.id);
    setItemName(item.name ?? "");
    setItemDescription(item.description ?? "");
    setItemPrice(String(item.price ?? ""));
    setItemAvailable(asAvailable(item.available));
    setItemSoldOut(asSoldOut(item.sold_out));
    setErrorMessage("");
    setItemModalOpen(true);
  };

  const handleSubmitItem = async () => {
    if (!restaurant?.id || !selectedCategory?.id) return;
    if (!itemName.trim()) {
      setErrorMessage(t("menuErrorItemRequired"));
      return;
    }
    const price = Number(itemPrice);
    if (Number.isNaN(price)) {
      setErrorMessage(t("menuErrorInvalidPrice"));
      return;
    }

    setLoading(true);
    setErrorMessage("");
    const maxOrder = selectedItems.reduce((max, it) => Math.max(max, Number(it.order_index ?? 0)), 0);
    const payload = {
      restaurant_id: restaurant.id,
      category_id: selectedCategory.id,
      name: itemName.trim(),
      description: itemDescription.trim() || null,
      price,
      available: itemAvailable,
      sold_out: itemSoldOut,
      order_index: editingItemId
        ? selectedItems.find((it) => it.id === editingItemId)?.order_index ?? maxOrder + 1
        : maxOrder + 1,
    };

    const { error } = editingItemId
      ? await supabase.from("menu_items").update(payload).eq("id", editingItemId)
      : await supabase.from("menu_items").insert(payload);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setItemModalOpen(false);
      setEditingItemId(null);
      loadItems();
    }
    setLoading(false);
  };

  const handleToggleItemAvailability = async (id: string, next: boolean) => {
    const prevAllItems = allItems;
    const prevItemsByCategory = itemsByCategory;
    const itemName = allItems.find((item) => String(item.id) === String(id))?.name ?? "Item";
    setAllItems((prev) =>
      prev.map((item) => (String(item.id) === String(id) ? { ...item, available: next } : item))
    );
    setItemsByCategory((prev) => {
      const out: Record<string, MenuItem[]> = {};
      Object.entries(prev).forEach(([key, list]) => {
        out[key] = list.map((item) => (String(item.id) === String(id) ? { ...item, available: next } : item));
      });
      return out;
    });
    const { error } = await supabase
      .from("menu_items")
      .update({ available: next })
      .eq("id", id);
    if (error) {
      setAllItems(prevAllItems);
      setItemsByCategory(prevItemsByCategory);
      setErrorMessage(error.message);
      return;
    }
    showToast(
      next
        ? `“${itemName}” is now on the menu`
        : `“${itemName}” is hidden from the menu`,
      next ? "success" : "muted"
    );
  };

  const handleToggleItemSoldOut = async (id: string, next: boolean) => {
    const prevAllItems = allItems;
    const prevItemsByCategory = itemsByCategory;
    const itemName = allItems.find((item) => String(item.id) === String(id))?.name ?? "Item";
    setAllItems((prev) =>
      prev.map((item) => (String(item.id) === String(id) ? { ...item, sold_out: next } : item))
    );
    setItemsByCategory((prev) => {
      const out: Record<string, MenuItem[]> = {};
      Object.entries(prev).forEach(([key, list]) => {
        out[key] = list.map((item) => (String(item.id) === String(id) ? { ...item, sold_out: next } : item));
      });
      return out;
    });
    const { error } = await supabase
      .from("menu_items")
      .update({ sold_out: next })
      .eq("id", id);
    if (error) {
      setAllItems(prevAllItems);
      setItemsByCategory(prevItemsByCategory);
      setErrorMessage(error.message);
      return;
    }
    showToast(
      next
        ? `“${itemName}” is marked sold out`
        : `“${itemName}” is back in stock`,
      next ? "muted" : "success"
    );
  };

  const renderItem = ({ item: cat, drag, isActive }: RenderItemParams<Category>) => {
    const isSelectedTablet = isTablet && selectedCategoryId === cat.id;
    const itemCount = (itemsByCategory[String(cat.id)] ?? []).length;
    const available = asAvailable(cat.available);

    return (
      <ScaleDecorator activeScale={1.015}>
        <CategoryCardShell
          style={{
            backgroundColor: isSelectedTablet
              ? isLight
                ? "rgba(255, 102, 0, 0.08)"
                : "rgba(255, 102, 0, 0.16)"
              : isActive
                ? rowRule
                : colors.surface,
            borderColor: isSelectedTablet ? colors.primary : hairline,
          }}
        >
          <CardTop>
            <CardTap
              onPress={() => {
                if (!isActive) {
                  if (isTablet) {
                    setSelectedCategoryId(cat.id);
                  } else {
                    router.push({
                      pathname: `/(app)/categories/${cat.id}`,
                      params: { categoryName: cat.name ?? "" },
                    });
                  }
                }
              }}
              disabled={isActive}
              style={{ flex: 1 }}
            >
              <CategoryContent style={{ flex: 1 }}>
                <CategoryName style={{ color: colors.text }} numberOfLines={1}>
                  {cat.name}
                </CategoryName>
                <ItemSubText style={{ color: colors.textMuted, marginTop: 0 }}>
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </ItemSubText>
              </CategoryContent>
            </CardTap>
            <CategoryDragHandle onLongPress={drag} delayLongPress={150}>
              <DragGrip color={colors.textMuted} />
            </CategoryDragHandle>
          </CardTop>

          <CardFooter style={{ borderTopColor: rowRule }}>
            <StatusChip
              style={{
                backgroundColor: available
                  ? isLight
                    ? "rgba(22, 163, 74, 0.1)"
                    : "rgba(22, 163, 74, 0.18)"
                  : isLight
                    ? "rgba(28, 25, 23, 0.05)"
                    : "rgba(255,255,255,0.08)",
              }}
            >
              <StatusChipText
                style={{ color: available ? "#16a34a" : colors.textMuted }}
              >
                {available ? t("menuAvailable") : t("menuHiddenLabel")}
              </StatusChipText>
            </StatusChip>
            <RightActions>
              <MiniToggle
                value={available}
                onToggle={(v) => handleToggleAvailability(cat.id, v)}
                colors={colors}
              />
              <IconBtn
                onPress={() => openEditCategoryModal(cat)}
                style={{ borderColor: hairline }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil" size={14} color={colors.textMuted} />
              </IconBtn>
              <IconBtn
                onPress={() => handleDeleteCategoryPress(cat)}
                style={{ borderColor: "rgba(220,38,38,0.35)" }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash" size={14} color={colors.danger} />
              </IconBtn>
            </RightActions>
          </CardFooter>
        </CategoryCardShell>
      </ScaleDecorator>
    );
  };

  const renderTabletCategoryItem = (cat: Category) => {
    const isSelectedTablet = selectedCategoryId === cat.id;
    const itemCount = (itemsByCategory[String(cat.id)] ?? []).length;
    const available = asAvailable(cat.available);

    return (
      <CategoryCardShell
        style={{
          backgroundColor: isSelectedTablet
            ? isLight
              ? "rgba(255, 102, 0, 0.08)"
              : "rgba(255, 102, 0, 0.16)"
            : colors.surface,
          borderColor: isSelectedTablet ? colors.primary : hairline,
          marginHorizontal: 0,
          marginBottom: 8,
        }}
      >
        <CardTap onPress={() => setSelectedCategoryId(cat.id)}>
          <CardTop>
            <CategoryContent style={{ flex: 1 }}>
              <CategoryName style={{ color: colors.text }} numberOfLines={1}>
                {cat.name}
              </CategoryName>
              <ItemSubText style={{ color: colors.textMuted, marginTop: 0 }}>
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </ItemSubText>
            </CategoryContent>
          </CardTop>
        </CardTap>
        <CardFooter style={{ borderTopColor: rowRule }}>
          <StatusChip
            style={{
              backgroundColor: available
                ? isLight
                  ? "rgba(22, 163, 74, 0.1)"
                  : "rgba(22, 163, 74, 0.18)"
                : isLight
                  ? "rgba(28, 25, 23, 0.05)"
                  : "rgba(255,255,255,0.08)",
            }}
          >
            <StatusChipText style={{ color: available ? "#16a34a" : colors.textMuted }}>
              {available ? t("menuAvailable") : t("menuHiddenLabel")}
            </StatusChipText>
          </StatusChip>
          <RightActions>
            <MiniToggle
              value={available}
              onToggle={(v) => handleToggleAvailability(cat.id, v)}
              colors={colors}
            />
            <IconBtn
              onPress={() => openEditCategoryModal(cat)}
              style={{ borderColor: hairline }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil" size={14} color={colors.textMuted} />
            </IconBtn>
            <IconBtn
              onPress={() => handleDeleteCategoryPress(cat)}
              style={{ borderColor: "rgba(220,38,38,0.35)" }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash" size={14} color={colors.danger} />
            </IconBtn>
          </RightActions>
        </CardFooter>
      </CategoryCardShell>
    );
  };

  return (
    <Container style={{ backgroundColor: colors.bg, flex: 1 }}>
      {isTablet ? (
        <TabletSplit>
          <TabletLeftCol>
            <TabletPaneCard
              style={{
                backgroundColor: colors.surface,
                borderColor: hairline,
              }}
            >
              {errorMessage ? (
                <ErrorText style={{ color: colors.danger }}>{errorMessage}</ErrorText>
              ) : null}

              {categories.length === 0 ? (
                <EmptyWrap>
                  <EmptyTitle style={{ color: colors.text }}>{t("menuBuildTitle")}</EmptyTitle>
                  <EmptyCopy style={{ color: colors.textMuted }}>
                    {t("menuBuildCopy")}
                  </EmptyCopy>
                </EmptyWrap>
              ) : (
                <FlatList
                  data={categories}
                  extraData={categories.length}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => renderTabletCategoryItem(item)}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 18, paddingTop: 12, gap: 6 }}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </TabletPaneCard>
          </TabletLeftCol>

          <TabletRightCol>
            <TabletPaneCard
              style={{
                backgroundColor: colors.surface,
                borderColor: hairline,
              }}
            >
              <PaneHeader>
                <PaneTitle style={{ color: colors.text }}>
                  {selectedCategory?.name ?? t("menuItems")}
                </PaneTitle>
                <AddCategoryBtn onPress={openAddItemModal} disabled={!selectedCategory}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <AddBtnText>{t("menuAddItem")}</AddBtnText>
                </AddCategoryBtn>
              </PaneHeader>
              {!selectedCategory ? (
                <EmptyState style={{ color: colors.textMuted }}>
                  {t("menuSelectCategory")}
                </EmptyState>
              ) : selectedItems.length === 0 ? (
                <EmptyState style={{ color: colors.textMuted }}>
                  {t("menuNoItemsYet")}
                </EmptyState>
              ) : (
                <FlatList
                  data={selectedItems}
                  keyExtractor={(item) => String(item.id)}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 18, paddingTop: 4 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const available = asAvailable(item.available);
                    const soldOut = asSoldOut(item.sold_out);
                    return (
                      <CategoryCard
                        style={{
                          backgroundColor: colors.surface,
                          borderColor: hairline,
                          marginHorizontal: 12,
                        }}
                      >
                        <CardTop>
                          <CardTap
                            onPress={() => openEditItemModal(item)}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${item.name}`}
                          >
                            {item.image_url ? (
                              <ItemThumb source={{ uri: item.image_url }} />
                            ) : (
                              <ItemThumbPlaceholder
                                style={{
                                  backgroundColor: isLight
                                    ? "rgba(28,25,23,0.04)"
                                    : colors.surface2,
                                  borderColor: hairline,
                                }}
                              >
                                <ItemThumbText style={{ color: colors.textMuted }}>
                                  No img
                                </ItemThumbText>
                              </ItemThumbPlaceholder>
                            )}
                            <CategoryContent style={{ flex: 1 }}>
                              <CategoryName style={{ color: colors.text }} numberOfLines={1}>
                                {item.name}
                              </CategoryName>
                              {item.description ? (
                                <ItemSubText style={{ color: colors.textMuted }} numberOfLines={1}>
                                  {item.description}
                                </ItemSubText>
                              ) : null}
                              <ItemPriceText style={{ color: colors.text }}>
                                {formatCurrency(Number(item.price || 0), currency)}
                              </ItemPriceText>
                            </CategoryContent>
                          </CardTap>
                        </CardTop>
                        <CardFooter style={{ borderTopColor: rowRule }}>
                          <VisibilitySwitch
                            visible={available}
                            onChange={(v) => handleToggleItemAvailability(item.id, v)}
                            mutedColor={colors.textMuted}
                            isLight={isLight}
                            colors={colors}
                          />
                          <StockStatusSwitch
                            soldOut={soldOut}
                            onChange={(next) => handleToggleItemSoldOut(item.id, next)}
                            mutedColor={colors.textMuted}
                            isLight={isLight}
                          />
                          <RightActions>
                            <IconBtn
                              onPress={() => openEditItemModal(item)}
                              style={{ borderColor: hairline }}
                            >
                              <Ionicons name="pencil" size={14} color={colors.textMuted} />
                            </IconBtn>
                            <IconBtn
                              onPress={() => handleDeleteItemPress(item)}
                              style={{ borderColor: "rgba(220,38,38,0.35)" }}
                            >
                              <Ionicons name="trash" size={14} color={colors.danger} />
                            </IconBtn>
                          </RightActions>
                        </CardFooter>
                      </CategoryCard>
                    );
                  }}
                />
              )}
            </TabletPaneCard>
          </TabletRightCol>
        </TabletSplit>
      ) : (
        <>
          {errorMessage ? (
            <ErrorText style={{ color: colors.danger }}>{errorMessage}</ErrorText>
          ) : null}

          {categories.length === 0 ? (
            <EmptyWrap>
              <EmptyTitle style={{ color: colors.text }}>{t("menuBuildTitle")}</EmptyTitle>
              <EmptyCopy style={{ color: colors.textMuted }}>
                {t("menuBuildCopy")}
              </EmptyCopy>
            </EmptyWrap>
          ) : (
            <DraggableFlatList
              data={categories}
              extraData={categories.length}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              onDragEnd={({ data }) => {
                setCategories(data);
                updateOrderIndexes(data);
              }}
              activationDistance={10}
              contentContainerStyle={{ paddingBottom: 24, paddingTop: 12 }}
            />
          )}
        </>
      )}

      <Modal
        visible={categoryModalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeCategoryModal}
      >
        <FormOverlay>
          <Pressable style={{ flex: 1 }} onPress={closeCategoryModal} />
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
                  {editingCategoryId ? t("menuEditCategory") : t("menuAddCategory")}
                </FormTitle>
                <FormClose onPress={closeCategoryModal} hitSlop={10}>
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
                  <FormLabel style={{ color: colors.textMuted }}>{t("menuFieldName")}</FormLabel>
                  <FormInput
                    style={{
                      backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                      color: colors.text,
                      borderColor: hairline,
                    }}
                    value={categoryName}
                    onChangeText={setCategoryName}
                    placeholder={t("menuPlaceholderCategory")}
                    placeholderTextColor={colors.textMuted}
                    autoFocus={editingCategoryId == null}
                  />
                </FormField>

                <FormStatusRow
                  style={{
                    borderColor: hairline,
                    backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                  }}
                >
                  <FormStatusLine>
                    <FormStatusLabel style={{ color: colors.text }}>{t("onMenu")}</FormStatusLabel>
                    <VisibilitySwitch
                      toggleOnly
                      visible={categoryAvailable}
                      onChange={setCategoryAvailable}
                      mutedColor={colors.textMuted}
                      isLight={isLight}
                      colors={colors}
                    />
                  </FormStatusLine>
                </FormStatusRow>

                {categoryFormError ? (
                  <ErrorText style={{ color: colors.danger }}>{categoryFormError}</ErrorText>
                ) : null}

                <FormActions>
                  <FormCancelBtn
                    onPress={closeCategoryModal}
                    style={{
                      borderColor: hairline,
                      backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                    }}
                  >
                    <FormCancelText style={{ color: colors.text }}>{t("cancel")}</FormCancelText>
                  </FormCancelBtn>
                  <FormSaveBtn onPress={handleSubmitCategory} disabled={loading || !categoryName.trim()}>
                    <FormSaveText>
                      {loading
                        ? editingCategoryId
                          ? t("saving")
                          : t("adding")
                        : editingCategoryId
                          ? t("save")
                          : t("menuAddCategory")}
                    </FormSaveText>
                  </FormSaveBtn>
                </FormActions>
              </ScrollView>
            </FormSheet>
        </FormOverlay>
      </Modal>

      <Modal
        visible={itemModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setItemModalOpen(false)}
      >
        <FormOverlay>
          <Pressable style={{ flex: 1 }} onPress={() => setItemModalOpen(false)} />
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
                  {editingItemId ? t("menuEditItem") : t("menuAddItem")}
                </FormTitle>
                <FormClose onPress={() => setItemModalOpen(false)} hitSlop={10}>
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
                <FormLabel style={{ color: colors.textMuted }}>{t("menuFieldName")}</FormLabel>
                <FormInput
                  style={{
                    backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                    color: colors.text,
                    borderColor: hairline,
                  }}
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder={t("menuPlaceholderItem")}
                  placeholderTextColor={colors.textMuted}
                  autoFocus={editingItemId == null}
                />
              </FormField>
              <FormField>
                <FormLabel style={{ color: colors.textMuted }}>{t("menuFieldDescription")}</FormLabel>
                <FormTextArea
                  style={{
                    backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                    color: colors.text,
                    borderColor: hairline,
                  }}
                  value={itemDescription}
                  onChangeText={setItemDescription}
                  placeholder={t("menuPlaceholderDesc")}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />
              </FormField>
              <FormField>
                <FormLabel style={{ color: colors.textMuted }}>{t("menuFieldPrice")}</FormLabel>
                <FormInput
                  style={{
                    backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                    color: colors.text,
                    borderColor: hairline,
                  }}
                  value={itemPrice}
                  onChangeText={setItemPrice}
                  keyboardType="decimal-pad"
                  placeholder={t("menuPlaceholderPrice")}
                  placeholderTextColor={colors.textMuted}
                />
              </FormField>
              <FormStatusRow
                style={{
                  borderColor: hairline,
                  backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                }}
              >
                <FormStatusLine
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: hairline,
                  }}
                >
                  <FormStatusLabel style={{ color: colors.text }}>{t("onMenu")}</FormStatusLabel>
                  <VisibilitySwitch
                    toggleOnly
                    visible={itemAvailable}
                    onChange={setItemAvailable}
                    mutedColor={colors.textMuted}
                    isLight={isLight}
                    colors={colors}
                  />
                </FormStatusLine>
                <FormStatusLine>
                  <FormStatusLabel style={{ color: colors.text }}>{t("inStock")}</FormStatusLabel>
                  <StockStatusSwitch
                    toggleOnly
                    soldOut={itemSoldOut}
                    onChange={setItemSoldOut}
                    mutedColor={colors.textMuted}
                    isLight={isLight}
                  />
                </FormStatusLine>
              </FormStatusRow>
              {errorMessage ? (
                <ErrorText style={{ color: colors.danger, marginBottom: 8 }}>{errorMessage}</ErrorText>
              ) : null}
              <FormActions>
                <FormCancelBtn
                  onPress={() => setItemModalOpen(false)}
                  style={{
                    borderColor: hairline,
                    backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                  }}
                >
                  <FormCancelText style={{ color: colors.text }}>{t("cancel")}</FormCancelText>
                </FormCancelBtn>
                <FormSaveBtn onPress={handleSubmitItem} disabled={loading || !itemName.trim()}>
                  <FormSaveText>
                    {loading ? t("saving") : editingItemId ? t("update") : t("save")}
                  </FormSaveText>
                </FormSaveBtn>
              </FormActions>
            </ScrollView>
          </FormSheet>
        </FormOverlay>
      </Modal>

      <DeleteConfirmModal
        visible={deleteTarget != null}
        title={deleteTarget?.type === "category" ? t("menuDeleteCategory") : t("menuDeleteItem")}
        message={
          deleteTarget?.type === "category"
            ? t("menuDeleteCategoryMsg")
            : t("menuDeleteItemMsg")
        }
        loading={deleteLoading}
        onCancel={closeDeleteConfirm}
        onConfirm={confirmDelete}
        colors={colors}
        isLight={isLight}
        hairline={hairline}
      />

      <StatusToast toast={toast} onHide={() => setToast(null)} />
    </Container>
  );
}

const Container = styled.View`flex: 1;`;
const TabletSplit = styled.View`
  flex: 1;
  width: 100%;
  flex-direction: row;
  align-items: stretch;
  gap: 14px;
  padding: 8px 12px 10px;
`;
const TabletLeftCol = styled.View`
  flex: 0.32;
`;
const TabletRightCol = styled.View`
  flex: 0.68;
`;
const TabletPaneCard = styled.View`
  flex: 1;
  border-width: 1px;
  border-radius: 24px;
  overflow: hidden;
`;
const PaneHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-horizontal: 16px;
  padding-top: 14px;
  padding-bottom: 6px;
`;
const PaneTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.3px;
`;
const HeaderAddButton = styled.TouchableOpacity`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  align-items: center;
  justify-content: center;
  background: #ff6600;
`;
const AddCategoryBtn = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 9px 14px;
  border-radius: 14px;
  background: #ff6600;
`;
const AddBtnText = styled.Text`
  color: #fff;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: -0.1px;
`;
const ErrorText = styled.Text`margin: 0 16px 12px; font-size: 12px;`;
const CategoryCardShell = styled.View`
  margin-horizontal: 16px;
  margin-bottom: 10px;
  border-radius: 20px;
  border-width: 1px;
  overflow: hidden;
`;
const CategoryCard = styled(Pressable)`
  margin-horizontal: 16px;
  margin-bottom: 10px;
  border-radius: 20px;
  border-width: 1px;
  overflow: hidden;
`;
const CardTop = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 14px 14px 12px;
`;
const CardTap = styled(Pressable)`
  flex: 1;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  min-width: 0;
`;
const CardFooter = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 10px 12px 12px;
  border-top-width: 1px;
  gap: 6px;
  flex-wrap: nowrap;
`;
const StatusChip = styled.View`
  padding: 4px 10px;
  border-radius: 999px;
`;
const StatusChipText = styled.Text`
  font-size: 11px;
  font-weight: 700;
`;
const CategoryDragHandle = styled(Pressable)`
  width: 28px;
  min-height: 44px;
  align-items: center;
  justify-content: center;
`;
const DragGripStack = styled.View`
  align-items: center;
  justify-content: center;
`;
const MiniSwitchPress = styled.TouchableOpacity``;
const MiniSwitchTrack = styled.View`
  width: 44px;
  height: 24px;
  border-radius: 999px;
  border-width: 1px;
  justify-content: center;
  padding-horizontal: 3px;
`;
const MiniSwitchThumb = styled.View`
  width: 18px;
  height: 18px;
  border-radius: 9px;
`;
const CategoryContent = styled.View`
  gap: 3px;
  min-width: 0;
`;
const CategoryName = styled.Text`
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.3px;
  line-height: 22px;
`;
const ItemSubText = styled.Text`
  font-size: 12px;
  font-weight: 500;
  margin-top: 1px;
`;
const RightActions = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: auto;
`;
const IconBtn = styled.TouchableOpacity`
  width: 30px;
  height: 30px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  border-width: 1px;
  background: transparent;
`;
const ItemThumb = styled.Image`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  flex-shrink: 0;
`;
const ItemThumbPlaceholder = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
  border-width: 1px;
  flex-shrink: 0;
`;
const ItemThumbText = styled.Text`
  font-size: 9px;
  font-weight: 600;
`;
const ItemPriceText = styled.Text`
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.2px;
  margin-top: 2px;
`;
const EmptyWrap = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
  gap: 8px;
`;
const EmptyTitle = styled.Text`
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.3px;
  text-align: center;
`;
const EmptyCopy = styled.Text`
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: center;
  max-width: 280px;
`;
const EmptyState = styled.Text`
  text-align: center;
  padding: 32px 16px;
  font-size: 14px;
  font-weight: 500;
`;

const FormOverlay = styled.View`
  flex: 1;
  background: rgba(0, 0, 0, 0.45);
  justify-content: flex-end;
`;
const FormSheet = styled.View`
  width: 100%;
  max-height: 92%;
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
`;
const FormHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 10px;
`;
const FormTitle = styled.Text`
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.4px;
`;
const FormClose = styled.TouchableOpacity`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  align-items: center;
  justify-content: center;
`;
const FormField = styled.View`
  margin-bottom: 14px;
`;
const FormLabel = styled.Text`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  margin-bottom: 8px;
`;
const FormInput = styled.TextInput`
  border-radius: 16px;
  padding: 14px 16px;
  border-width: 1px;
  font-size: 16px;
  font-weight: 600;
`;
const FormTextArea = styled.TextInput`
  border-radius: 16px;
  padding: 14px 16px;
  border-width: 1px;
  font-size: 15px;
  font-weight: 500;
  min-height: 96px;
`;
const FormStatusRow = styled.View`
  flex-direction: column;
  gap: 0;
  margin-bottom: 8px;
  width: 100%;
  border-radius: 16px;
  border-width: 1px;
  overflow: hidden;
`;
const FormStatusLine = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  gap: 12px;
`;
const FormStatusLabel = styled.Text`
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.2px;
  flex: 1;
`;
const FormActions = styled.View`
  flex-direction: row;
  gap: 10px;
  margin-top: 18px;
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
const FormSaveBtn = styled.TouchableOpacity`
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
