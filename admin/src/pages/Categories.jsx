import { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { uploadImage } from "../services/cloudinary";
import { supabase } from "../services/supabase";
import { useRestaurant } from "../context/RestaurantContext";
import { useLanguage } from "../context/LanguageContext";
import { formatCurrency } from "../utils/currency";
import { cardItem, cardPanel } from "../styles/cards";

const asAvailable = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "t" || normalized === "on") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "f" || normalized === "off") return false;
  }
  if (typeof value === "number") return value !== 0;
  return true;
};

const asSoldOut = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "t" || normalized === "on") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "f" || normalized === "off") return false;
  }
  if (typeof value === "number") return value !== 0;
  return false;
};

const Categories = () => {
  const { restaurant } = useRestaurant();
  const { t } = useLanguage();
  const currency = restaurant?.currency ?? "USD";
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [orderIndex, setOrderIndex] = useState("");
  const [loading, setLoading] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [draggingItemId, setDraggingItemId] = useState(null);
  const [dragOverItemId, setDragOverItemId] = useState(null);
  const [itemsByCategory, setItemsByCategory] = useState({});
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [mobileItemsOpen, setMobileItemsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState(null);
  const [savingItem, setSavingItem] = useState(false);
  const [itemSaved, setItemSaved] = useState(false);
  const [categorySaved, setCategorySaved] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: "",
    imageFile: null,
    available: true,
    sold_out: false
  });
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemImageUrl, setEditingItemImageUrl] = useState(null);
  const [editingItemImagePublicId, setEditingItemImagePublicId] = useState(null);
  const [originalItemImagePublicId, setOriginalItemImagePublicId] = useState(null);
  const [itemImagePreviewUrl, setItemImagePreviewUrl] = useState(null);
  const categoryNameRef = useRef(null);
  const infoTimerRef = useRef(null);
  const itemImageInputRef = useRef(null);
  const dragIndexRef = useRef(null);
  const dragGhostRef = useRef(null);
  const dragItemIndexRef = useRef(null);
  const dragItemGhostRef = useRef(null);

  const loadCategories = async () => {
    if (!restaurant?.id) return;
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("order_index", { ascending: true, nullsFirst: false });
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setCategories(data ?? []);
    if ((data ?? []).length && !selectedCategoryId) {
      setSelectedCategoryId(data[0].id);
    }
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
      return;
    }
    const grouped = (data ?? []).reduce((acc, item) => {
      const key = item.category_id || "uncategorized";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
    setItemsByCategory(grouped);
  };

  useEffect(() => {
    loadCategories();
    loadItems();
  }, [restaurant?.id]);

  useEffect(() => {
    if (newItem.imageFile) {
      const objectUrl = URL.createObjectURL(newItem.imageFile);
      setItemImagePreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setItemImagePreviewUrl(editingItemImageUrl);
    return undefined;
  }, [newItem.imageFile, editingItemImageUrl]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!restaurant?.id) return;
    setLoading(true);
    const maxOrder = categories.reduce(
      (max, category) => Math.max(max, Number(category.order_index ?? 0)),
      0
    );
    await supabase.from("categories").insert({
      restaurant_id: restaurant.id,
      name,
      order_index: orderIndex ? Number(orderIndex) : maxOrder + 1,
      available: true
    });
    setName("");
    setOrderIndex("");
    setLoading(false);
    setCategorySaved(true);
    showInfo(t("categoryAdded"), "success");
    loadCategories();
    loadItems();
    window.setTimeout(() => {
      setCategorySaved(false);
      setIsCategoryOpen(false);
    }, 750);
  };

  const handleUpdate = async (id, nextName) => {
    await supabase.from("categories").update({ name: nextName }).eq("id", id);
    loadCategories();
    loadItems();
  };

  const startEditingCategory = (category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name ?? "");
  };

  const saveEditingCategory = async (id) => {
    if (!editingCategoryName.trim()) return;
    await handleUpdate(id, editingCategoryName.trim());
    setEditingCategoryId(null);
  };

  const handleDelete = async (id) => {
    await supabase.from("categories").delete().eq("id", id);
    loadCategories();
    loadItems();
  };

  const showInfo = (text, tone = "neutral") => {
    setInfoMessage({ text, tone, id: Date.now() });
    if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
    infoTimerRef.current = setTimeout(() => setInfoMessage(null), 2600);
  };

  useEffect(
    () => () => {
      if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
    },
    []
  );

  const handleToggleAvailability = async (id, next) => {
    const prevCategories = categories;
    setErrorMessage("");
    setCategories((prev) =>
      prev.map((category) =>
        String(category.id) === String(id) ? { ...category, available: next } : category
      )
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
    const toggled = prevCategories.find((c) => String(c.id) === String(id));
    showInfo(
      t(next ? "categoryNowVisible" : "categoryNowHidden", {
        name: toggled?.name ?? t("categoryFallback")
      }),
      next ? "success" : "muted"
    );
  };

  const handleToggleItemAvailability = async (id, next) => {
    const prevItemsByCategory = itemsByCategory;
    setErrorMessage("");
    setItemsByCategory((prev) => {
      const nextMap = {};
      Object.entries(prev).forEach(([key, list]) => {
        nextMap[key] = list.map((item) =>
          String(item.id) === String(id) ? { ...item, available: next } : item
        );
      });
      return nextMap;
    });
    const { error } = await supabase
      .from("menu_items")
      .update({ available: next })
      .eq("id", id);
    if (error) {
      setItemsByCategory(prevItemsByCategory);
      setErrorMessage(error.message);
      return;
    }
    let toggledName = t("itemFallback");
    Object.values(prevItemsByCategory).forEach((list) => {
      const found = list.find((i) => String(i.id) === String(id));
      if (found) toggledName = found.name;
    });
    showInfo(
      next ? t("itemNowAvailable", { name: toggledName }) : t("itemNowUnavailable", { name: toggledName }),
      next ? "success" : "muted"
    );
  };

  const handleToggleItemSoldOut = async (id, next) => {
    const prevItemsByCategory = itemsByCategory;
    setErrorMessage("");
    setItemsByCategory((prev) => {
      const nextMap = {};
      Object.entries(prev).forEach(([key, list]) => {
        nextMap[key] = list.map((item) =>
          String(item.id) === String(id) ? { ...item, sold_out: next } : item
        );
      });
      return nextMap;
    });
    const { error } = await supabase
      .from("menu_items")
      .update({ sold_out: next })
      .eq("id", id);
    if (error) {
      setItemsByCategory(prevItemsByCategory);
      setErrorMessage(error.message);
      return;
    }
    let toggledName = t("itemFallback");
    Object.values(prevItemsByCategory).forEach((list) => {
      const found = list.find((i) => String(i.id) === String(id));
      if (found) toggledName = found.name;
    });
    showInfo(
      next ? t("itemMarkedSoldOut", { name: toggledName }) : t("itemBackInStock", { name: toggledName }),
      next ? "muted" : "success"
    );
  };

  const handleDeleteItem = async (id) => {
    setErrorMessage("");
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    loadItems();
  };

  const deleteCloudinaryImage = async (publicId) => {
    if (!publicId) return;
    const { error } = await supabase.functions.invoke("delete-cloudinary-image", {
      body: { public_id: publicId }
    });
    if (error) {
      throw new Error(error.message);
    }
  };

  const handleDeleteItemWithImage = async (item) => {
    setErrorMessage("");
    try {
      if (item.image_public_id) {
        await deleteCloudinaryImage(item.image_public_id);
      }
    } catch (error) {
      setErrorMessage(error.message || t("failedDeleteImage"));
      return;
    }
    await handleDeleteItem(item.id);
  };

  const handleEditItem = (item) => {
    setNewItem({
      name: item.name ?? "",
      description: item.description ?? "",
      price: item.price ?? "",
      imageFile: null,
      available: asAvailable(item.available),
      sold_out: asSoldOut(item.sold_out)
    });
    setEditingItemId(item.id);
    setEditingItemImageUrl(item.image_url ?? null);
    setEditingItemImagePublicId(item.image_public_id ?? null);
    setOriginalItemImagePublicId(item.image_public_id ?? null);
    setIsAddOpen(true);
  };

  const handleAddItem = () => {
    if (!selectedCategory?.id) return;
    setNewItem({
      name: "",
      description: "",
      price: "",
      imageFile: null,
      available: true,
      sold_out: false
    });
    setEditingItemId(null);
    setEditingItemImageUrl(null);
    setEditingItemImagePublicId(null);
    setOriginalItemImagePublicId(null);
    setIsAddOpen(true);
  };

  const resetItemImageFormState = () => {
    setEditingItemId(null);
    setEditingItemImageUrl(null);
    setEditingItemImagePublicId(null);
    setOriginalItemImagePublicId(null);
    setItemImagePreviewUrl(null);
    if (itemImageInputRef.current) {
      itemImageInputRef.current.value = "";
    }
  };

  const handleClearItemImage = () => {
    setNewItem((prev) => ({ ...prev, imageFile: null }));
    setEditingItemImageUrl(null);
    setEditingItemImagePublicId(null);
    if (itemImageInputRef.current) {
      itemImageInputRef.current.value = "";
    }
  };

  const handleSubmitNewItem = async (event) => {
    event.preventDefault();
    if (!selectedCategory?.id) return;
    const price = Number(newItem.price);
    if (Number.isNaN(price)) {
      setErrorMessage(t("invalidPrice"));
      return;
    }

    setErrorMessage("");
    setSavingItem(true);
    let imageUrl = editingItemImageUrl ?? null;
    let imagePublicId = editingItemImagePublicId ?? null;

    if (newItem.imageFile) {
      try {
        const upload = await uploadImage(newItem.imageFile);
        imageUrl = upload.secureUrl ?? null;
        imagePublicId = upload.publicId ?? null;
      } catch (error) {
        setErrorMessage(error.message || t("imageUploadFailed"));
        setSavingItem(false);
        return;
      }
    }

    const categoryItems = itemsByCategory[selectedCategory.id] ?? [];
    const maxOrder = categoryItems.reduce(
      (max, it) => Math.max(max, Number(it.order_index ?? 0)),
      0
    );

    const payload = {
      restaurant_id: restaurant.id,
      category_id: selectedCategory.id,
      name: newItem.name.trim(),
      description: newItem.description.trim() || null,
      price,
      image_url: imageUrl,
      image_public_id: imagePublicId,
      available: newItem.available,
      sold_out: newItem.sold_out,
      order_index: editingItemId
        ? (categoryItems.find((it) => it.id === editingItemId)?.order_index ?? maxOrder + 1)
        : maxOrder + 1
    };

    const { error } = editingItemId
      ? await supabase.from("menu_items").update(payload).eq("id", editingItemId)
      : await supabase.from("menu_items").insert(payload);
    if (error) {
      setErrorMessage(error.message);
      setSavingItem(false);
      return;
    }

    // Remove the previous Cloudinary asset when it was replaced or deleted.
    if (originalItemImagePublicId && originalItemImagePublicId !== imagePublicId) {
      try {
        await deleteCloudinaryImage(originalItemImagePublicId);
      } catch (deleteError) {
        setErrorMessage(deleteError.message || t("failedDeleteOldImage"));
      }
    }

    const wasEditing = !!editingItemId;
    setSavingItem(false);
    setItemSaved(true);
    showInfo(wasEditing ? t("itemUpdated") : t("itemAdded"), "success");
    loadItems();
    window.setTimeout(() => {
      setItemSaved(false);
      resetItemImageFormState();
      setIsAddOpen(false);
    }, 750);
  };

  const updateOrderIndexes = async (next) => {
    await Promise.all(
      next.map((category, index) =>
        supabase.from("categories").update({ order_index: index + 1 }).eq("id", category.id)
      )
    );
    loadCategories();
    loadItems();
  };

  const handleDragStart = (event, index) => {
    dragIndexRef.current = index;
    setDraggingId(categories[index]?.id ?? null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      const ghost = event.currentTarget.cloneNode(true);
      ghost.style.position = "fixed";
      ghost.style.top = "-1000px";
      ghost.style.left = "-1000px";
      ghost.style.width = `${event.currentTarget.offsetWidth}px`;
      ghost.style.boxShadow = "0 20px 36px rgba(0, 0, 0, 0.35)";
      ghost.style.background = "#111827";
      ghost.style.opacity = "0.98";
      document.body.appendChild(ghost);
      dragGhostRef.current = ghost;
      event.dataTransfer.setDragImage(ghost, 20, 20);
    }
  };

  const handleDrop = async (targetIndex) => {
    const sourceIndex = dragIndexRef.current;
    dragIndexRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
    if (sourceIndex === null || sourceIndex === undefined) return;
    if (sourceIndex === targetIndex) return;

    const next = [...categories];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setCategories(next);
    await updateOrderIndexes(next);
  };

  const updateItemOrderIndexes = async (items) => {
    if (!selectedCategory?.id) return;
    await Promise.all(
      items.map((item, index) =>
        supabase
          .from("menu_items")
          .update({ order_index: index + 1 })
          .eq("id", item.id)
      )
    );
    loadItems();
  };

  const handleItemDragStart = (event, index) => {
    dragItemIndexRef.current = index;
    setDraggingItemId(selectedItems[index]?.id ?? null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      const ghost = event.currentTarget.cloneNode(true);
      ghost.style.position = "fixed";
      ghost.style.top = "-1000px";
      ghost.style.left = "-1000px";
      ghost.style.width = `${event.currentTarget.offsetWidth}px`;
      ghost.style.boxShadow = "0 20px 36px rgba(0, 0, 0, 0.35)";
      ghost.style.background = "#fff";
      ghost.style.opacity = "0.98";
      document.body.appendChild(ghost);
      dragItemGhostRef.current = ghost;
      event.dataTransfer.setDragImage(ghost, 20, 20);
    }
  };

  const handleItemDrop = async (targetIndex) => {
    const sourceIndex = dragItemIndexRef.current;
    dragItemIndexRef.current = null;
    setDraggingItemId(null);
    setDragOverItemId(null);
    if (sourceIndex === null || sourceIndex === undefined) return;
    if (sourceIndex === targetIndex) return;

    const next = [...selectedItems];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setItemsByCategory((prev) => ({
      ...prev,
      [selectedCategory.id]: next
    }));
    await updateItemOrderIndexes(next);
  };

  // Pointer-based reordering for touch/pen devices (native HTML5 DnD only
  // fires for mouse). Initiated from the drag handles.
  const startPointerDrag = (type, index, event) => {
    if (event.pointerType === "mouse") return; // desktop uses native DnD
    event.preventDefault();
    event.stopPropagation();

    const isCategory = type === "category";
    const list = isCategory ? categories : selectedItems;
    const startId = list[index]?.id ?? null;
    const catId = selectedCategory?.id;
    const state = { sourceIndex: index, targetIndex: index };

    if (isCategory) {
      setDraggingId(startId);
      setDragOverId(startId);
    } else {
      setDraggingItemId(startId);
      setDragOverItemId(startId);
    }

    const selector = isCategory ? "[data-cat-index]" : "[data-item-index]";
    const attr = isCategory ? "catIndex" : "itemIndex";

    const move = (ev) => {
      ev.preventDefault();
      const point = document.elementFromPoint(ev.clientX, ev.clientY);
      const rowEl = point?.closest(selector);
      if (!rowEl) return;
      const targetIndex = Number(rowEl.dataset[attr]);
      if (Number.isNaN(targetIndex)) return;
      state.targetIndex = targetIndex;
      const overId = list[targetIndex]?.id ?? null;
      if (isCategory) setDragOverId(overId);
      else setDragOverItemId(overId);
    };

    const end = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);

      const { sourceIndex, targetIndex } = state;
      if (isCategory) {
        setDraggingId(null);
        setDragOverId(null);
        if (targetIndex != null && targetIndex !== sourceIndex) {
          const next = [...categories];
          const [moved] = next.splice(sourceIndex, 1);
          next.splice(targetIndex, 0, moved);
          setCategories(next);
          updateOrderIndexes(next);
        }
      } else {
        setDraggingItemId(null);
        setDragOverItemId(null);
        if (targetIndex != null && targetIndex !== sourceIndex && catId) {
          const next = [...selectedItems];
          const [moved] = next.splice(sourceIndex, 1);
          next.splice(targetIndex, 0, moved);
          setItemsByCategory((prev) => ({ ...prev, [catId]: next }));
          updateItemOrderIndexes(next);
        }
      }
    };

    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  };

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? categories[0];

  const selectedItems =
    selectedCategory?.id ? itemsByCategory[selectedCategory.id] ?? [] : [];

  return (
    <div>
      <SplitLayout>
        <LeftPane $mobileHidden={mobileItemsOpen}>
          <PaneHeader>
            <div>
              <PaneTitle>{t("categoriesTitle")}</PaneTitle>
            </div>
            <PrimaryButton
              type="button"
              onClick={() => {
                setName("");
                setOrderIndex("");
                setIsCategoryOpen(true);
              }}
            >
              {t("addCategory")}
            </PrimaryButton>
          </PaneHeader>
          {errorMessage && <InlineError>{errorMessage}</InlineError>}
          <List>
            {categories.map((category, index) => (
              <CategoryCard key={category.id}>
                <Row
                  data-cat-index={index}
                  $isDragging={draggingId === category.id}
                  $isDragOver={dragOverId === category.id}
                  $isSelected={selectedCategoryId === category.id}
                  draggable
                  onClick={() => {
                    setSelectedCategoryId(category.id);
                    setMobileItemsOpen(true);
                  }}
                  onDragStart={(event) => handleDragStart(event, index)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverId(null);
                    if (dragGhostRef.current) {
                      dragGhostRef.current.remove();
                      dragGhostRef.current = null;
                    }
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnter={() => setDragOverId(category.id)}
                  onDragLeave={() => setDragOverId((prev) => (prev === category.id ? null : prev))}
                  onDrop={() => handleDrop(index)}
                >
                  <DragHandle
                    type="button"
                    aria-label={t("reorderCategory")}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => startPointerDrag("category", index, e)}
                  >
                    <DragIcon viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 8h14M5 12h14M5 16h14" />
                    </DragIcon>
                  </DragHandle>
                  {editingCategoryId === category.id ? (
                    <CategoryEditInput
                      type="text"
                      value={editingCategoryName}
                      onChange={(event) => setEditingCategoryName(event.target.value)}
                      onBlur={() => saveEditingCategory(category.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          saveEditingCategory(category.id);
                        }
                        if (event.key === "Escape") {
                          setEditingCategoryId(null);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <CategoryName>{category.name}</CategoryName>
                  )}
                <CategoryActions>
                  <IconButton
                    type="button"
                    aria-label={editingCategoryId === category.id ? t("saveCategory") : t("editCategory")}
                    onMouseDown={(event) => {
                      if (editingCategoryId === category.id) {
                        event.preventDefault();
                      }
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (editingCategoryId === category.id) {
                        saveEditingCategory(category.id);
                      } else {
                        startEditingCategory(category);
                      }
                    }}
                  >
                    {editingCategoryId === category.id ? (
                      <TickIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </TickIcon>
                    ) : (
                      <EditIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4M12 20h8"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </EditIcon>
                    )}
                  </IconButton>
                  <SwitchLabel
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <SwitchInput
                      type="checkbox"
                      checked={asAvailable(category.available)}
                      onChange={(event) =>
                        handleToggleAvailability(category.id, event.target.checked)
                      }
                    />
                    <SwitchSlider />
                  </SwitchLabel>
                  <IconButton
                    type="button"
                    $tone="danger"
                    aria-label={t("deleteCategory")}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(category.id);
                    }}
                  >
                    <TrashIcon viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0l1 11a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-11M10 11v5m4-5v5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </TrashIcon>
                  </IconButton>
                </CategoryActions>
                </Row>
              </CategoryCard>
            ))}
          </List>
        </LeftPane>
        {isCategoryOpen && (
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>{t("addCategory")}</ModalTitle>
                  <ModalSubtitle>{t("createMenuSection")}</ModalSubtitle>
                </div>
                <ModalClose
                  type="button"
                  aria-label={t("close")}
                  onClick={() => setIsCategoryOpen(false)}
                >
                  ×
                </ModalClose>
              </ModalHeader>
              <ModalForm onSubmit={handleCreate}>
                <ModalField>
                  <label htmlFor="category-name">{t("name")}</label>
                  <input
                    id="category-name"
                    ref={categoryNameRef}
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("categoryName")}
                    required
                  />
                </ModalField>
                <ModalField>
                  <label htmlFor="category-order">{t("orderOptional")}</label>
                  <input
                    id="category-order"
                    type="number"
                    value={orderIndex}
                    onChange={(event) => setOrderIndex(event.target.value)}
                    placeholder={t("orderIndex")}
                  />
                </ModalField>
                <ModalActions>
                  <SecondaryButton type="button" onClick={() => setIsCategoryOpen(false)}>
                    {t("cancel")}
                  </SecondaryButton>
                  <PrimaryButton type="submit" disabled={loading || categorySaved}>
                    {categorySaved ? (
                      <BtnContent>
                        <CheckIcon
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </CheckIcon>
                        {t("added")}
                      </BtnContent>
                    ) : loading ? (
                      <BtnContent>
                        <Spinner aria-hidden="true" />
                        {t("saving")}
                      </BtnContent>
                    ) : (
                      t("addCategory")
                    )}
                  </PrimaryButton>
                </ModalActions>
              </ModalForm>
            </ModalCard>
          </ModalOverlay>
        )}
        <RightPane $mobileHidden={!mobileItemsOpen}>
          <MobileBackBar>
            <MobileBackButton type="button" onClick={() => setMobileItemsOpen(false)}>
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
              <span>{t("categoriesTitle")}</span>
            </MobileBackButton>
          </MobileBackBar>
          <PaneHeader>
            <div>
              <PaneTitle>{selectedCategory?.name ?? t("selectCategory")}</PaneTitle>
              
            </div>
            <PaneActions>
              <PrimaryButton type="button" onClick={handleAddItem} disabled={!selectedCategory}>
                {t("addNewItem")}
              </PrimaryButton>
            </PaneActions>
          </PaneHeader>
          {isAddOpen && (
            <ModalOverlay>
              <ItemModalCard>
                <ItemModalHeader>
                  <ItemModalHeading>
                    <ItemModalEyebrow>{selectedCategory?.name ?? t("menu")}</ItemModalEyebrow>
                    <ItemModalTitle>{editingItemId ? t("editItem") : t("addNewItem")}</ItemModalTitle>
                  </ItemModalHeading>
                  <ModalClose
                    type="button"
                    aria-label={t("close")}
                    onClick={() => {
                      setIsAddOpen(false);
                      resetItemImageFormState();
                    }}
                  >
                    ×
                  </ModalClose>
                </ItemModalHeader>

                <ItemModalForm onSubmit={handleSubmitNewItem}>
                  <ItemModalBody>
                    <ItemMediaColumn>
                      <ItemMediaLabel>{t("productImage")}</ItemMediaLabel>
                      <HiddenFileInput
                        ref={itemImageInputRef}
                        id="item-image"
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setNewItem((prev) => ({
                            ...prev,
                            imageFile: file
                          }));
                          if (file) {
                            setEditingItemImageUrl(null);
                            setEditingItemImagePublicId(null);
                          }
                        }}
                      />
                      {itemImagePreviewUrl ? (
                        <ItemMediaFrame>
                          <ItemImagePreviewImg
                            src={itemImagePreviewUrl}
                            alt={newItem.name || t("itemPreview")}
                          />
                          <ItemMediaOverlay>
                            <SecondaryButton
                              type="button"
                              onClick={() => itemImageInputRef.current?.click()}
                            >
                              {t("change")}
                            </SecondaryButton>
                            <DangerButton type="button" onClick={handleClearItemImage}>
                              {t("delete")}
                            </DangerButton>
                          </ItemMediaOverlay>
                        </ItemMediaFrame>
                      ) : (
                        <ItemMediaEmpty
                          type="button"
                          onClick={() => itemImageInputRef.current?.click()}
                        >
                          <ItemMediaEmptyIcon viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 7h3l2-2h6l2 2h3v12H4V7z" />
                            <circle cx="12" cy="13" r="3.5" />
                          </ItemMediaEmptyIcon>
                          <strong>{t("addProductPhoto")}</strong>
                          <span>{t("photoHint")}</span>
                        </ItemMediaEmpty>
                      )}
                    </ItemMediaColumn>

                    <ItemFieldsColumn>
                      <ItemModalField>
                        <label htmlFor="item-name">{t("itemName")}</label>
                        <input
                          id="item-name"
                          type="text"
                          placeholder={t("itemNamePlaceholder")}
                          value={newItem.name}
                          onChange={(event) =>
                            setNewItem((prev) => ({ ...prev, name: event.target.value }))
                          }
                          required
                        />
                      </ItemModalField>

                      <ItemModalField>
                        <label htmlFor="item-description">{t("itemDescription")}</label>
                        <textarea
                          id="item-description"
                          rows={4}
                          placeholder={t("itemDescriptionPlaceholder")}
                          value={newItem.description}
                          onChange={(event) =>
                            setNewItem((prev) => ({ ...prev, description: event.target.value }))
                          }
                        />
                      </ItemModalField>

                      <ItemModalField>
                        <label htmlFor="item-price">{t("price")}</label>
                        <ItemPriceField>
                          <ItemPricePrefix>{restaurant?.currency ?? "USD"}</ItemPricePrefix>
                          <input
                            id="item-price"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={newItem.price}
                            onChange={(event) =>
                              setNewItem((prev) => ({ ...prev, price: event.target.value }))
                            }
                            required
                          />
                        </ItemPriceField>
                      </ItemModalField>

                      <ItemAvailabilityRow>
                        <div>
                          <ItemAvailabilityTitle>{t("available")}</ItemAvailabilityTitle>
                          <ItemAvailabilityHint>
                            {t("availableHint")}
                          </ItemAvailabilityHint>
                        </div>
                        <SwitchLabel>
                          <SwitchInput
                            id="item-available"
                            type="checkbox"
                            checked={newItem.available}
                            onChange={(event) =>
                              setNewItem((prev) => ({
                                ...prev,
                                available: event.target.checked
                              }))
                            }
                          />
                          <SwitchSlider />
                        </SwitchLabel>
                      </ItemAvailabilityRow>

                      <ItemAvailabilityRow>
                        <div>
                          <ItemAvailabilityTitle>{t("soldOut")}</ItemAvailabilityTitle>
                          <ItemAvailabilityHint>
                            {t("soldOutHint")}
                          </ItemAvailabilityHint>
                        </div>
                        <SwitchLabel>
                          <SwitchInput
                            id="item-sold-out"
                            type="checkbox"
                            checked={newItem.sold_out}
                            onChange={(event) =>
                              setNewItem((prev) => ({
                                ...prev,
                                sold_out: event.target.checked
                              }))
                            }
                          />
                          <SwitchSlider />
                        </SwitchLabel>
                      </ItemAvailabilityRow>
                    </ItemFieldsColumn>
                  </ItemModalBody>

                  <ItemModalFooter>
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        setIsAddOpen(false);
                        resetItemImageFormState();
                      }}
                    >
                      {t("cancel")}
                    </SecondaryButton>
                    <PrimaryButton type="submit" disabled={savingItem || itemSaved}>
                      {itemSaved ? (
                        <BtnContent>
                          <CheckIcon
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </CheckIcon>
                          {editingItemId ? t("updated") : t("saved")}
                        </BtnContent>
                      ) : savingItem ? (
                        <BtnContent>
                          <Spinner aria-hidden="true" />
                          {editingItemId ? t("updating") : t("saving")}
                        </BtnContent>
                      ) : editingItemId ? (
                        t("updateItem")
                      ) : (
                        t("saveItem")
                      )}
                    </PrimaryButton>
                  </ItemModalFooter>
                </ItemModalForm>
              </ItemModalCard>
            </ModalOverlay>
          )}
          <ItemsPanel>
            {selectedCategory ? (
              selectedItems.length === 0 ? (
                <EmptyState>{t("noItemsInCategory")}</EmptyState>
              ) : (
                <ItemsList>
                  {selectedItems.map((item, index) => (
                    <ItemRow
                      key={item.id}
                      data-item-index={index}
                      $isDragging={draggingItemId === item.id}
                      $isDragOver={dragOverItemId === item.id}
                      draggable
                      onDragStart={(e) => handleItemDragStart(e, index)}
                      onDragEnd={() => {
                        setDraggingItemId(null);
                        setDragOverItemId(null);
                        if (dragItemGhostRef.current) {
                          dragItemGhostRef.current.remove();
                          dragItemGhostRef.current = null;
                        }
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={() => setDragOverItemId(item.id)}
                      onDragLeave={() =>
                        setDragOverItemId((prev) => (prev === item.id ? null : prev))
                      }
                      onDrop={() => handleItemDrop(index)}
                    >
                      <ItemInfo>
                        <ItemDragHandle
                          type="button"
                          aria-label={t("reorderItem")}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => startPointerDrag("item", index, e)}
                        >
                          <DragIcon viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M5 8h14M5 12h14M5 16h14" />
                          </DragIcon>
                        </ItemDragHandle>
                        {item.image_url ? (
                          <ItemThumb src={item.image_url} alt={item.name} />
                        ) : (
                          <ItemThumbPlaceholder>{t("noImage")}</ItemThumbPlaceholder>
                        )}
                        <div>
                          <ItemTitle>{item.name}</ItemTitle>
                          {item.description && (
                            <ItemDescription>{item.description}</ItemDescription>
                          )}
                        </div>
                      </ItemInfo>
                      <ItemMeta>
                        <ItemPrice>{formatCurrency(Number(item.price), currency)}</ItemPrice>
                        <ItemBadge $active={item.available}>
                          {item.available ? t("available") : t("unavailable")}
                        </ItemBadge>
                        <SwitchLabel>
                          <SwitchInput
                            type="checkbox"
                            checked={asAvailable(item.available)}
                            onChange={(event) =>
                              handleToggleItemAvailability(item.id, event.target.checked)
                            }
                          />
                          <SwitchSlider />
                        </SwitchLabel>
                        <ItemBadge $active={!asSoldOut(item.sold_out)} $tone="soldout">
                          {asSoldOut(item.sold_out) ? t("soldOut") : t("inStock")}
                        </ItemBadge>
                        <SwitchLabel>
                          <SwitchInput
                            type="checkbox"
                            checked={asSoldOut(item.sold_out)}
                            onChange={(event) =>
                              handleToggleItemSoldOut(item.id, event.target.checked)
                            }
                          />
                          <SwitchSlider />
                        </SwitchLabel>
                        <ItemActions>
                          <ItemIconButton
                            type="button"
                            aria-label={t("editItemAria")}
                            onClick={() => handleEditItem(item)}
                          >
                            <EditIcon viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4M12 20h8"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                              />
                            </EditIcon>
                          </ItemIconButton>
                          <ItemIconButton
                            type="button"
                            aria-label={t("deleteItem")}
                            $variant="danger"
                            onClick={() => handleDeleteItemWithImage(item)}
                          >
                            <TrashIcon viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0l1 11a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-11M10 11v5m4-5v5"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                              />
                            </TrashIcon>
                          </ItemIconButton>
                        </ItemActions>
                      </ItemMeta>
                    </ItemRow>
                  ))}
                </ItemsList>
              )
            ) : (
              <EmptyState>{t("selectCategory")}</EmptyState>
            )}
          </ItemsPanel>
        </RightPane>
      </SplitLayout>
      {infoMessage && (
        <InfoToast key={infoMessage.id} role="status">
          <InfoDot $tone={infoMessage.tone} />
          <span>{infoMessage.text}</span>
        </InfoToast>
      )}
    </div>
  );
};

const List = styled.div`
  display: grid;
  gap: 12px;
`;

const Row = styled.div`
  ${cardItem}
  padding: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: var(--menu-editor-text);
  transition: box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease, transform 0.12s ease;
  border-color: var(--orders-container-border);
  border-left: 4px solid
    ${({ $isDragOver, $isSelected }) =>
      $isDragOver || $isSelected
        ? "var(--sidebar-orange)"
        : "color-mix(in srgb, var(--orders-container-border) 75%, transparent)"};
  background: ${({ $isDragOver, $isSelected }) =>
    $isDragOver || $isSelected
      ? "linear-gradient(180deg, color-mix(in srgb, var(--primary) 14%, var(--surface)), color-mix(in srgb, var(--surface) 90%, var(--button-overlay) 10%))"
      : undefined};
  box-shadow: ${({ $isDragging }) =>
    $isDragging ? "0 20px 36px rgba(0, 0, 0, 0.35)" : undefined};
  transform: ${({ $isDragging }) => ($isDragging ? "scale(1.02)" : undefined)};

  [data-theme="light"] & {
    box-shadow: none;
  }
  opacity: ${({ $isDragging }) => ($isDragging ? 0.35 : 1)};
  cursor: ${({ $isDragging }) => ($isDragging ? "grabbing" : "grab")};

  &:hover {
    border-color: color-mix(in srgb, var(--orders-container-border) 65%, var(--text) 35%);
    border-left-color: ${({ $isDragOver, $isSelected }) =>
      $isDragOver || $isSelected
        ? "var(--sidebar-orange)"
        : "color-mix(in srgb, var(--orders-container-border) 55%, var(--text) 25%)"};
    background: ${({ $isDragOver, $isSelected }) =>
      $isDragOver || $isSelected
        ? "linear-gradient(180deg, color-mix(in srgb, var(--primary) 18%, var(--surface)), color-mix(in srgb, var(--surface) 88%, var(--button-overlay) 12%))"
        : "color-mix(in srgb, var(--surface) 94%, var(--button-overlay) 6%)"};
    transform: ${({ $isDragging }) => ($isDragging ? "scale(1.02)" : "translateY(-1px)")};
  }
`;

const DragHandle = styled.button`
  border: 1px solid var(--orders-container-border);
  background: var(--surface-2);
  color: var(--menu-editor-text);
  border-radius: 8px;
  padding: 2px 6px;
  height: 22px;
  cursor: grab;
  line-height: 1;
  display: grid;
  place-items: center;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
`;

const DragIcon = styled.svg`
  width: 14px;
  height: 14px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
`;

const CategoryName = styled.span`
  color: var(--menu-editor-text);
  font-weight: 500;
  flex: 1;
  text-align: left;
`;

const CategoryEditInput = styled.input`
  border: 1px solid var(--orders-container-border);
  padding: 6px 8px;
  border-radius: 8px;
  width: 100%;
  flex: 1;
  text-align: left;
  background: var(--menu-editor-bg);
  color: var(--menu-editor-text);
`;

const CategoryActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CategoryCard = styled.div`
  display: grid;
  gap: 12px;
`;

const IconButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid
    ${({ $tone }) =>
      $tone === "danger" ? "rgba(239, 68, 68, 0.4)" : "var(--orders-container-border)"};
  background: var(--menu-editor-bg);
  color: var(--menu-editor-text);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-weight: 600;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: ${({ $tone }) =>
      $tone === "danger"
        ? "rgba(239, 68, 68, 0.12)"
        : "color-mix(in srgb, var(--orders-container-border) 35%, var(--surface))"};
    border-color: ${({ $tone }) =>
      $tone === "danger"
        ? "rgba(239, 68, 68, 0.6)"
        : "color-mix(in srgb, var(--orders-container-border) 55%, var(--text) 45%)"};
    transform: translateY(-1px);
  }
`;

const TrashIcon = styled.svg`
  width: 16px;
  height: 16px;
  stroke: currentColor;
`;

const TickIcon = styled.svg`
  width: 16px;
  height: 16px;
  stroke: currentColor;
`;

const SwitchLabel = styled.label`
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 44px;
  height: 24px;
  cursor: pointer;
`;

const SwitchInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;

  &:checked + span {
    background: rgba(34, 197, 94, 0.6);
    border-color: rgba(34, 197, 94, 0.6);
  }

  &:checked + span::before {
    transform: translateX(20px);
    background: #ffffff;
    opacity: 1;
  }
`;

const SwitchSlider = styled.span`
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--orders-container-border) 55%, var(--surface));
  border: 1px solid var(--orders-container-border);
  border-radius: 999px;
  transition: background 0.2s ease, border-color 0.2s ease;

  &::before {
    content: "";
    position: absolute;
    height: 18px;
    width: 18px;
    left: 3px;
    top: 2px;
    background: var(--menu-editor-text);
    opacity: 0.5;
    border-radius: 50%;
    transition: transform 0.2s ease, background 0.2s ease, opacity 0.2s ease;
  }
`;

const ItemsPanel = styled.div`
  ${cardPanel}
  border-color: var(--orders-container-border);
  padding: 14px;

  [data-theme="light"] & {
    box-shadow: none;
  }
`;

const ItemsList = styled.div`
  display: grid;
  gap: 10px;
`;

const ItemRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  ${cardItem}
  border-color: ${({ $isDragOver }) =>
    $isDragOver
      ? "color-mix(in srgb, var(--orders-container-border) 55%, var(--text) 45%)"
      : "var(--orders-container-border)"};
  background: ${({ $isDragOver, $isDragging }) =>
    $isDragOver || $isDragging
      ? "color-mix(in srgb, var(--orders-container-border) 28%, var(--surface))"
      : undefined};
  cursor: ${({ $isDragging }) => ($isDragging ? "grabbing" : "grab")};
  opacity: ${({ $isDragging }) => ($isDragging ? 0.4 : 1)};
  transition: background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--orders-container-border) 65%, var(--text) 35%);
  }

  @media (max-width: 560px) {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
`;

const ItemDragHandle = styled.button`
  border: 1px solid var(--orders-container-border);
  background: var(--menu-editor-bg);
  color: var(--menu-editor-text);
  border-radius: 8px;
  padding: 2px 5px;
  height: 22px;
  cursor: grab;
  line-height: 1;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
`;

const ItemInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;

  & > div {
    min-width: 0;
  }
`;

const ItemThumb = styled.img`
  width: 52px;
  height: 52px;
  object-fit: cover;
  border-radius: 10px;
`;

const ItemImagePreviewImg = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const HiddenFileInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

const ItemThumbPlaceholder = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--orders-container-border) 40%, var(--surface));
  color: var(--menu-editor-text);
  display: grid;
  place-items: center;
  font-size: 10px;
`;

const ItemTitle = styled.h4`
  margin: 0 0 4px;
  font-size: 16px;
  color: var(--menu-editor-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemDescription = styled.p`
  margin: 0;
  color: var(--menu-editor-text);
  font-size: 12px;
  opacity: 0.7;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ItemPrice = styled.span`
  font-weight: 600;
  color: var(--menu-editor-text);
`;

const ItemMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--menu-editor-text);
  opacity: 0.8;
  flex-shrink: 0;

  @media (max-width: 560px) {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }
`;

const ItemActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ItemIconButton = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid
    ${({ $variant }) =>
      $variant === "danger" ? "rgba(239, 68, 68, 0.5)" : "var(--orders-container-border)"};
  background: var(--menu-editor-bg);
  color: var(--menu-editor-text);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: ${({ $variant }) =>
      $variant === "danger"
        ? "rgba(239, 68, 68, 0.12)"
        : "color-mix(in srgb, var(--orders-container-border) 35%, var(--surface))"};
    border-color: ${({ $variant }) =>
      $variant === "danger"
        ? "rgba(239, 68, 68, 0.6)"
        : "color-mix(in srgb, var(--orders-container-border) 55%, var(--text) 45%)"};
    transform: translateY(-1px);
  }
`;

const EditIcon = styled.svg`
  width: 16px;
  height: 16px;
  stroke: currentColor;
`;

const ItemBadge = styled.span`
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: ${({ $active, $tone }) =>
    $tone === "soldout"
      ? $active
        ? "rgba(100, 116, 139, 0.12)"
        : "rgba(239, 68, 68, 0.15)"
      : $active
        ? "rgba(34, 197, 94, 0.15)"
        : "rgba(239, 68, 68, 0.15)"};
  color: ${({ $active, $tone }) =>
    $tone === "soldout"
      ? $active
        ? "#64748b"
        : "#dc2626"
      : $active
        ? "#16a34a"
        : "#dc2626"};
  border: 1px solid
    ${({ $active, $tone }) =>
      $tone === "soldout"
        ? $active
          ? "rgba(100, 116, 139, 0.35)"
          : "rgba(239, 68, 68, 0.4)"
        : $active
          ? "rgba(34, 197, 94, 0.4)"
          : "rgba(239, 68, 68, 0.4)"};
`;

const EmptyState = styled.p`
  margin: 0;
  color: var(--menu-editor-text);
  opacity: 0.7;
`;

const SplitLayout = styled.div`
  display: grid;
  grid-template-columns: 30% 1fr;
  gap: 18px;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: 34% 1fr;
    gap: 14px;
  }

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

const paneSlideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
`;

const LeftPane = styled.div`
  ${cardPanel}
  border-color: var(--orders-container-border);
  padding: 16px;

  [data-theme="light"] & {
    box-shadow: none;
  }

  @media (max-width: 860px) {
    display: ${({ $mobileHidden }) => ($mobileHidden ? "none" : "block")};
    animation: ${paneSlideIn} 0.26s ease;
  }

  @media (max-width: 600px) {
    padding: 12px;
  }
`;

const RightPane = styled.div`
  ${cardPanel}
  border-color: var(--orders-container-border);
  padding: 18px;

  [data-theme="light"] & {
    box-shadow: none;
  }

  @media (max-width: 860px) {
    display: ${({ $mobileHidden }) => ($mobileHidden ? "none" : "block")};
    animation: ${paneSlideIn} 0.26s ease;
  }

  @media (max-width: 600px) {
    padding: 12px;
  }
`;

const MobileBackBar = styled.div`
  display: none;

  @media (max-width: 860px) {
    display: flex;
    align-items: center;
    margin-bottom: 14px;
  }
`;

const MobileBackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--orders-container-border);
  background: var(--menu-editor-bg);
  color: var(--menu-editor-text);
  border-radius: 999px;
  padding: 7px 14px 7px 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    border-color: var(--sidebar-orange);
    background: color-mix(in srgb, var(--sidebar-orange) 10%, var(--menu-editor-bg));
  }
`;

const PaneHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;

  @media (max-width: 420px) {
    flex-wrap: wrap;
  }
`;

const PaneTitle = styled.h3`
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: var(--menu-editor-text);
`;

const PaneMeta = styled.span`
  font-size: 12px;
  color: var(--menu-editor-text);
  opacity: 0.7;
`;

const RightSubtitle = styled.p`
  margin: 0;
  color: var(--menu-editor-text);
  font-size: 13px;
  opacity: 0.7;
`;

const PaneActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const PrimaryButton = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: none;
  background: var(--sidebar-orange);
  color: #ffffff;
  cursor: pointer;
  font-weight: 600;
  min-height: 36px;
  transition: filter 0.15s ease, opacity 0.15s ease;

  &:hover:not(:disabled) {
    filter: brightness(1.04);
  }

  &:disabled {
    cursor: default;
    opacity: 0.9;
  }
`;

const BtnContent = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Spinner = styled.span`
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #ffffff;
  animation: ${spin} 0.7s linear infinite;
  display: inline-block;
  flex-shrink: 0;
`;

const checkPop = keyframes`
  0% { transform: scale(0.4); opacity: 0; }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
`;

const CheckIcon = styled.svg`
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  animation: ${checkPop} 0.3s ease;
`;

const toastIn = keyframes`
  from { opacity: 0; transform: translate(-50%, 14px); }
  to { opacity: 1; transform: translate(-50%, 0); }
`;

const InfoToast = styled.div`
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 60;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--container-border);
  box-shadow: 0 12px 32px rgba(17, 24, 39, 0.16);
  font-size: 13.5px;
  font-weight: 600;
  max-width: calc(100vw - 32px);
  animation: ${toastIn} 0.28s cubic-bezier(0.22, 1, 0.36, 1);

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 600px) {
    bottom: 18px;
    font-size: 13px;
    padding: 10px 14px;
  }
`;

const InfoDot = styled.span`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ $tone }) =>
    $tone === "success"
      ? "var(--success)"
      : $tone === "muted"
      ? "var(--text-muted)"
      : "var(--sidebar-orange)"};
`;

const SecondaryButton = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--orders-container-border);
  background: var(--menu-editor-bg);
  color: var(--menu-editor-text);
  cursor: pointer;
`;

const DangerButton = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(239, 68, 68, 0.45);
  background: var(--menu-editor-bg);
  color: #dc2626;
  cursor: pointer;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.65);
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, #0f172a 55%, transparent);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 20;
  padding: 24px;

  @media (max-width: 600px) {
    padding: 12px;
    align-items: start;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
`;

const ModalCard = styled.div`
  width: min(560px, 100%);
  ${cardPanel}
  border-color: var(--orders-container-border);
  padding: 20px;
  display: grid;
  gap: 16px;

  [data-theme="light"] & {
    box-shadow: none;
  }
`;

const ItemModalCard = styled.div`
  width: min(820px, 100%);
  max-height: min(90dvh, 900px);
  overflow: auto;
  ${cardPanel}
  border-color: var(--orders-container-border);
  padding: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);

  [data-theme="light"] & {
    box-shadow: none;
  }

  @media (max-width: 600px) {
    /* Let the overlay scroll so focused inputs can move above the keyboard. */
    max-height: none;
    overflow: visible;
    width: 100%;
  }
`;

const ItemModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--orders-container-border);

  @media (max-width: 600px) {
    padding: 16px 16px 12px;
  }
`;

const ItemModalHeading = styled.div`
  display: grid;
  gap: 4px;
  min-width: 0;
`;

const ItemModalEyebrow = styled.span`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--sidebar-orange);
`;

const ItemModalTitle = styled.h3`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--menu-editor-text);
  line-height: 1.15;

  @media (max-width: 600px) {
    font-size: 18px;
  }
`;

const ItemModalForm = styled.form`
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
`;

const ItemModalBody = styled.div`
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) minmax(0, 1.1fr);
  gap: 22px;
  padding: 20px 22px;
  min-height: 0;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }

  @media (max-width: 600px) {
    gap: 16px;
    padding: 16px;
  }
`;

const ItemMediaColumn = styled.div`
  display: grid;
  gap: 10px;
  align-content: start;
`;

const ItemMediaLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
`;

const ItemMediaFrame = styled.div`
  position: relative;
  aspect-ratio: 1;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--orders-container-border) 28%, var(--surface));

  @media (max-width: 600px) {
    width: 148px;
    justify-self: start;
  }
`;

const ItemMediaOverlay = styled.div`
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  padding: 14px 12px;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, #0f172a 72%, transparent));

  ${SecondaryButton} {
    background: rgba(255, 255, 255, 0.92);
    color: #1c1917;
    border-color: rgba(255, 255, 255, 0.5);
  }

  ${DangerButton} {
    background: color-mix(in srgb, #dc2626 88%, #fff 12%);
    color: #ffffff;
    border-color: color-mix(in srgb, #b91c1c 70%, #fff 30%);

    &:hover {
      background: #b91c1c;
      border-color: #991b1b;
    }
  }

  @media (max-width: 600px) {
    padding: 8px;
    gap: 6px;

    ${SecondaryButton},
    ${DangerButton} {
      padding: 6px 10px;
      font-size: 12px;
    }
  }
`;

const ItemMediaEmpty = styled.button`
  aspect-ratio: 1;
  border-radius: 16px;
  border: 1px dashed color-mix(in srgb, var(--orders-container-border) 55%, var(--text) 25%);
  background: color-mix(in srgb, var(--surface) 88%, var(--button-overlay) 12%);
  color: var(--menu-editor-text);
  cursor: pointer;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  padding: 20px;
  text-align: center;
  transition: border-color 0.15s ease, background 0.15s ease;

  strong {
    font-size: 14px;
    font-weight: 650;
  }

  span {
    font-size: 12px;
    color: var(--text-muted);
    max-width: 18ch;
    line-height: 1.35;
  }

  &:hover {
    border-color: var(--sidebar-orange);
    background: color-mix(in srgb, var(--primary) 8%, var(--surface));
  }

  @media (max-width: 600px) {
    width: 148px;
    justify-self: start;
    padding: 12px;
    gap: 6px;

    span {
      display: none;
    }

    strong {
      font-size: 12.5px;
    }
  }
`;

const ItemMediaEmptyIcon = styled.svg`
  width: 28px;
  height: 28px;
  stroke: var(--sidebar-orange);
  fill: none;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  margin-bottom: 2px;
`;

const ItemFieldsColumn = styled.div`
  display: grid;
  gap: 14px;
  align-content: start;
`;

const ItemModalField = styled.div`
  display: grid;
  gap: 7px;

  label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }

  input,
  textarea {
    width: 100%;
    border: 1px solid var(--orders-container-border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--menu-editor-text);
    padding: 11px 13px;
    font-size: 14px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:focus {
      border-color: color-mix(in srgb, var(--sidebar-orange) 55%, var(--orders-container-border));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sidebar-orange) 16%, transparent);
    }
  }

  textarea {
    resize: vertical;
    min-height: 96px;
  }
`;

const ItemPriceField = styled.div`
  display: flex;
  align-items: stretch;
  border: 1px solid var(--orders-container-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:focus-within {
    border-color: color-mix(in srgb, var(--sidebar-orange) 55%, var(--orders-container-border));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--sidebar-orange) 16%, transparent);
  }

  input {
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    flex: 1;
    min-width: 0;
  }
`;

const ItemPricePrefix = styled.span`
  display: grid;
  place-items: center;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--orders-container-border) 32%, var(--surface));
  border-right: 1px solid var(--orders-container-border);
`;

const ItemAvailabilityRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--surface) 92%, var(--button-overlay) 8%);
`;

const ItemAvailabilityTitle = styled.div`
  font-size: 14px;
  font-weight: 650;
  color: var(--menu-editor-text);
`;

const ItemAvailabilityHint = styled.div`
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
`;

const ItemModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px 18px;
  border-top: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--surface) 94%, var(--bg) 6%);

  @media (max-width: 600px) {
    padding: 12px 16px 16px;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const ModalTitle = styled.h3`
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: var(--menu-editor-text);
`;

const ModalSubtitle = styled.p`
  margin: 0;
  color: var(--menu-editor-text);
  font-size: 12px;
  opacity: 0.7;
`;

const ModalClose = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--orders-container-border);
  background: var(--menu-editor-bg);
  color: var(--menu-editor-text);
  cursor: pointer;
  font-size: 18px;
  flex-shrink: 0;
`;

const ModalForm = styled.form`
  display: grid;
  gap: 12px;
`;

const ModalField = styled.div`
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--menu-editor-text);
  opacity: 0.8;

  input,
  select,
  textarea {
    border-color: var(--orders-container-border);
  }
`;

const ModalRow = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;
const InlineError = styled.p`
  margin: 8px 0 0;
  color: var(--danger);
  font-size: 12px;
`;

export default Categories;
