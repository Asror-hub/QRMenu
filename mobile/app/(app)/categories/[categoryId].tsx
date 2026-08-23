import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import type { RenderItemParams } from "react-native-draggable-flatlist";
import { useLocalSearchParams, useNavigation, useSegments } from "expo-router";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { uploadImage } from "@/src/services/cloudinary";
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

const deleteCloudinaryImage = async (publicId: string) => {
  const { error } = await supabase.functions.invoke("delete-cloudinary-image", {
    body: { public_id: publicId },
  });
  if (error) throw new Error(error.message);
};

export default function CategoryItemsScreen() {
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const segments = useSegments();
  const paramId = typeof params.categoryId === "string" ? params.categoryId : params.categoryId?.[0];
  const segmentId = segments.length > 0 ? segments[segments.length - 1] : null;
  const categoryId = paramId ?? (typeof segmentId === "string" && segmentId !== "categories" ? segmentId : null);
  const navigation = useNavigation();
  const { restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? "USD";
  const { t } = useLanguage();
  const { colors, theme } = useTheme();
  const isLight = theme === "light";
  const hairline = isLight ? "rgba(148, 163, 184, 0.32)" : "rgba(168, 162, 158, 0.28)";
  const rowRule = isLight ? "rgba(28, 25, 23, 0.06)" : "rgba(255,255,255,0.08)";
  const formSheetKeyboardStyle = useFormSheetAboveKeyboard();
  const [category, setCategory] = useState<{ id: string; name: string } | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: "",
    imageUri: null as string | null,
    available: false,
    soldOut: false,
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemImageUrl, setEditingItemImageUrl] = useState<string | null>(null);
  const [editingItemImagePublicId, setEditingItemImagePublicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const toastSeq = useRef(0);
  const [itemPendingDelete, setItemPendingDelete] = useState<MenuItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const showToast = (text: string, tone: ToastTone = "neutral") => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, message: text, tone });
  };

  const handleAddItem = () => {
    setNewItem({
      name: "",
      description: "",
      price: "",
      imageUri: null,
      available: false,
      soldOut: false,
    });
    setEditingItemId(null);
    setEditingItemImageUrl(null);
    setEditingItemImagePublicId(null);
    setItemModalOpen(true);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRightContainerStyle: {
        paddingRight: 6,
        paddingVertical: 2,
      },
      headerRight: () => (
        <HeaderAddButton onPress={handleAddItem} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add" size={20} color="#fff" />
        </HeaderAddButton>
      ),
    });
  }, [navigation]);

  const loadCategory = async () => {
    if (!categoryId) return;
    const { data } = await supabase
      .from("categories")
      .select("id, name")
      .eq("id", categoryId)
      .single();
    setCategory(data ?? null);
  };

  const loadItems = async () => {
    if (!restaurant?.id || !categoryId) return;
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, description, price, image_url, image_public_id, available, sold_out, category_id, order_index")
      .eq("restaurant_id", restaurant.id)
      .eq("category_id", categoryId)
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (error) {
      console.warn("[CategoryItems] loadItems error:", error.message);
    }
    setItems(data ?? []);
  };

  useEffect(() => {
    loadCategory();
    loadItems();
  }, [categoryId, restaurant?.id]);

  const updateItemOrderIndexes = async (next: MenuItem[]) => {
    if (!categoryId) return;
    await Promise.all(
      next.map((item, index) =>
        supabase
          .from("menu_items")
          .update({ order_index: index + 1 })
          .eq("id", item.id)
      )
    );
    loadItems();
  };

  const handleEditItem = (item: MenuItem) => {
    setNewItem({
      name: item.name ?? "",
      description: item.description ?? "",
      price: String(item.price ?? ""),
      imageUri: null,
      available: asAvailable(item.available),
      soldOut: asSoldOut(item.sold_out),
    });
    setEditingItemId(item.id);
    setEditingItemImageUrl(item.image_url ?? null);
    setEditingItemImagePublicId(item.image_public_id ?? null);
    setItemModalOpen(true);
  };

  const handleDeleteItemPress = (item: MenuItem) => {
    setItemPendingDelete(item);
  };

  const closeDeleteConfirm = () => {
    if (deleteLoading) return;
    setItemPendingDelete(null);
  };

  const confirmDeleteItem = async () => {
    if (!itemPendingDelete || !restaurant?.id) return;
    const item = itemPendingDelete;

    setDeleteLoading(true);
    try {
      if (item.image_public_id) {
        await deleteCloudinaryImage(item.image_public_id);
      }

      const { data, error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", item.id)
        .eq("restaurant_id", restaurant.id)
        .select("id");

      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("Could not delete item.");

      setItemPendingDelete(null);
      await loadItems();
      showToast(`“${item.name}” deleted`, "success");
    } catch (e) {
      showToast((e as Error).message || "Failed to delete.", "muted");
    } finally {
      setDeleteLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setNewItem((p) => ({ ...p, imageUri: result.assets[0].uri }));
    }
  };

  const handleSubmitItem = async () => {
    if (!categoryId || !restaurant?.id) return;
    const price = Number(newItem.price);
    if (Number.isNaN(price)) {
      setErrorMessage(t("menuErrorInvalidPrice"));
      return;
    }
    setErrorMessage("");
    setLoading(true);

    let imageUrl = editingItemImageUrl;
    let imagePublicId = editingItemImagePublicId;
    let replacedImage = false;

    if (newItem.imageUri) {
      try {
        const upload = await uploadImage(newItem.imageUri);
        imageUrl = upload.secureUrl;
        imagePublicId = upload.publicId;
        replacedImage = true;
      } catch (e) {
        setErrorMessage((e as Error).message || t("menuErrorImageUpload"));
        setLoading(false);
        return;
      }
    }

    const maxOrder = items.reduce((max, it) => Math.max(max, Number(it.order_index ?? 0)), 0);

    const payload = {
      restaurant_id: restaurant.id,
      category_id: categoryId,
      name: newItem.name.trim(),
      description: newItem.description.trim() || null,
      price,
      image_url: imageUrl,
      image_public_id: imagePublicId,
      available: newItem.available,
      sold_out: newItem.soldOut,
      order_index: editingItemId
        ? items.find((it) => it.id === editingItemId)?.order_index ?? maxOrder + 1
        : maxOrder + 1,
    };

    if (editingItemId) {
      await supabase.from("menu_items").update(payload).eq("id", editingItemId);
    } else {
      await supabase.from("menu_items").insert(payload);
    }

    if (editingItemId && replacedImage && editingItemImagePublicId) {
      try {
        await deleteCloudinaryImage(editingItemImagePublicId);
      } catch {
        // ignore
      }
    }

    setEditingItemId(null);
    setEditingItemImageUrl(null);
    setEditingItemImagePublicId(null);
    setItemModalOpen(false);
    setLoading(false);
    loadItems();
  };

  const handleToggleItemAvailability = async (id: string, next: boolean) => {
    const prevItems = items;
    const itemName = items.find((item) => String(item.id) === String(id))?.name ?? "Item";
    setItems((prev) =>
      prev.map((item) => (String(item.id) === String(id) ? { ...item, available: next } : item))
    );
    const { error } = await supabase
      .from("menu_items")
      .update({ available: next })
      .eq("id", id);
    if (error) {
      setItems(prevItems);
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
    const prevItems = items;
    const itemName = items.find((item) => String(item.id) === String(id))?.name ?? "Item";
    setItems((prev) =>
      prev.map((item) => (String(item.id) === String(id) ? { ...item, sold_out: next } : item))
    );
    const { error } = await supabase
      .from("menu_items")
      .update({ sold_out: next })
      .eq("id", id);
    if (error) {
      setItems(prevItems);
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

  if (!categoryId) {
    return null;
  }

  return (
    <Container style={{ backgroundColor: colors.bg, flex: 1 }}>
      {items.length === 0 ? (
        <EmptyState style={{ color: colors.textMuted }}>
          {t("menuNoItemsYet")}
        </EmptyState>
      ) : (
        <DraggableFlatList
          data={items}
          style={{ flex: 1 }}
          containerStyle={{ flex: 1 }}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 12 }}
          activationDistance={0}
          onDragEnd={({ data }) => {
            setItems(data);
            updateItemOrderIndexes(data);
          }}
          renderItem={({ item, drag, isActive }: RenderItemParams<MenuItem>) => {
            const available = asAvailable(item.available);
            const soldOut = asSoldOut(item.sold_out);
            return (
              <ScaleDecorator activeScale={1.015}>
                <ItemCard
                  style={{
                    backgroundColor: isActive
                      ? isLight
                        ? "rgba(255, 102, 0, 0.06)"
                        : "rgba(255,255,255,0.06)"
                      : colors.surface,
                    borderColor: hairline,
                  }}
                >
                  <CardTop>
                    <CardTap
                      onPress={() => handleEditItem(item)}
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
                      <ItemContent>
                        <ItemTitle style={{ color: colors.text }} numberOfLines={1}>
                          {item.name}
                        </ItemTitle>
                        {item.description ? (
                          <ItemDesc style={{ color: colors.textMuted }} numberOfLines={1}>
                            {item.description}
                          </ItemDesc>
                        ) : null}
                        <ItemPrice style={{ color: colors.text }}>
                          {formatCurrency(Number(item.price), currency)}
                        </ItemPrice>
                      </ItemContent>
                    </CardTap>
                    <ItemDragHandle
                      activeOpacity={1}
                      onLongPress={drag}
                      delayLongPress={150}
                    >
                      <DragGripStack>
                        <Ionicons name="chevron-up" size={12} color={colors.textMuted} />
                        <Ionicons name="reorder-three" size={18} color={colors.textMuted} />
                        <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
                      </DragGripStack>
                    </ItemDragHandle>
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
                        onPress={() => handleEditItem(item)}
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
                </ItemCard>
              </ScaleDecorator>
            );
          }}
        />
      )}

      <Modal
        visible={itemModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setItemModalOpen(false);
          setEditingItemId(null);
          setEditingItemImageUrl(null);
          setEditingItemImagePublicId(null);
        }}
      >
        <FormOverlay>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              setItemModalOpen(false);
              setEditingItemId(null);
              setEditingItemImageUrl(null);
              setEditingItemImagePublicId(null);
            }}
          />
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
                <FormClose
                  onPress={() => {
                    setItemModalOpen(false);
                    setEditingItemId(null);
                    setEditingItemImageUrl(null);
                    setEditingItemImagePublicId(null);
                  }}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </FormClose>
              </FormHeader>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
              >
              <FormImageBtn
                onPress={pickImage}
                style={{
                  backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                  borderColor: hairline,
                }}
              >
                {newItem.imageUri || editingItemImageUrl ? (
                  <FormImage
                    source={{ uri: newItem.imageUri || editingItemImageUrl || "" }}
                  />
                ) : (
                  <FormImageEmpty>
                    <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
                    <FormImageHint style={{ color: colors.textMuted }}>
                      Add photo
                    </FormImageHint>
                  </FormImageEmpty>
                )}
                <FormImageBadge style={{ backgroundColor: colors.primary }}>
                  <Ionicons name="image-outline" size={14} color="#fff" />
                </FormImageBadge>
              </FormImageBtn>

              <FormField>
                <FormLabel style={{ color: colors.textMuted }}>{t("menuFieldName")}</FormLabel>
                <FormInput
                  style={{
                    backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2,
                    color: colors.text,
                    borderColor: hairline,
                  }}
                  value={newItem.name}
                  onChangeText={(t) => setNewItem((p) => ({ ...p, name: t }))}
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
                  value={newItem.description}
                  onChangeText={(t) => setNewItem((p) => ({ ...p, description: t }))}
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
                  value={newItem.price}
                  onChangeText={(t) => setNewItem((p) => ({ ...p, price: t }))}
                  placeholder={t("menuPlaceholderPrice")}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
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
                    visible={newItem.available}
                    onChange={(v) => setNewItem((p) => ({ ...p, available: v }))}
                    mutedColor={colors.textMuted}
                    isLight={isLight}
                    colors={colors}
                  />
                </FormStatusLine>
                <FormStatusLine>
                  <FormStatusLabel style={{ color: colors.text }}>{t("inStock")}</FormStatusLabel>
                  <StockStatusSwitch
                    toggleOnly
                    soldOut={newItem.soldOut}
                    onChange={(next) => setNewItem((p) => ({ ...p, soldOut: next }))}
                    mutedColor={colors.textMuted}
                    isLight={isLight}
                  />
                </FormStatusLine>
              </FormStatusRow>

              {errorMessage ? (
                <ErrorText style={{ color: colors.danger }}>{errorMessage}</ErrorText>
              ) : null}

              <FormActions>
                <FormCancelBtn
                  onPress={() => {
                    setItemModalOpen(false);
                    setEditingItemId(null);
                    setEditingItemImageUrl(null);
                    setEditingItemImagePublicId(null);
                  }}
                  style={{ borderColor: hairline, backgroundColor: isLight ? "rgba(28,25,23,0.04)" : colors.surface2 }}
                >
                  <FormCancelText style={{ color: colors.text }}>{t("cancel")}</FormCancelText>
                </FormCancelBtn>
                <FormSaveBtn onPress={handleSubmitItem} disabled={loading}>
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
        visible={itemPendingDelete != null}
        title={t("menuDeleteItem")}
        message={t("menuDeleteItemMsg")}
        loading={deleteLoading}
        onCancel={closeDeleteConfirm}
        onConfirm={confirmDeleteItem}
        colors={colors}
        isLight={isLight}
        hairline={hairline}
      />

      <StatusToast toast={toast} onHide={() => setToast(null)} />
    </Container>
  );
}

const Container = styled.View`flex: 1;`;
const HeaderAddButton = styled.TouchableOpacity`
  width: 36px;
  height: 36px;
  border-radius: 18px;
  align-items: center;
  justify-content: center;
  background: #ff6600;
`;
const ItemCard = styled.View`
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
const ItemDragHandle = styled(TouchableOpacity)`
  width: 28px;
  min-height: 44px;
  align-items: center;
  justify-content: center;
`;
const DragGripStack = styled.View`
  align-items: center;
  justify-content: center;
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
const ItemContent = styled.View`
  flex: 1;
  min-width: 0;
  gap: 2px;
`;
const ItemTitle = styled.Text`
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.3px;
  line-height: 22px;
`;
const ItemDesc = styled.Text`
  font-size: 12px;
  font-weight: 500;
`;
const ItemPrice = styled.Text`
  font-weight: 800;
  font-size: 13px;
  letter-spacing: -0.2px;
  margin-top: 2px;
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
const EmptyState = styled.Text`
  text-align: center;
  padding: 32px 16px;
  font-size: 14px;
  font-weight: 500;
`;
const ErrorText = styled.Text`font-size: 12px; margin-bottom: 8px;`;

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
const FormImageBtn = styled.TouchableOpacity`
  width: 100%;
  height: 180px;
  border-radius: 20px;
  border-width: 1px;
  overflow: hidden;
  margin-bottom: 18px;
  align-items: center;
  justify-content: center;
`;
const FormImage = styled.Image`
  width: 100%;
  height: 100%;
`;
const FormImageEmpty = styled.View`
  align-items: center;
  justify-content: center;
  gap: 8px;
`;
const FormImageHint = styled.Text`
  font-size: 13px;
  font-weight: 700;
`;
const FormImageBadge = styled.View`
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 32px;
  height: 32px;
  border-radius: 16px;
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
