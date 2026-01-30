import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { uploadImage } from "../services/cloudinary";
import { supabase } from "../services/supabase";
import { useRestaurant } from "../context/RestaurantContext";

const Categories = () => {
  const { restaurant } = useRestaurant();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [orderIndex, setOrderIndex] = useState("");
  const [loading, setLoading] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [itemsByCategory, setItemsByCategory] = useState({});
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: "",
    imageFile: null,
    available: true
  });
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemImageUrl, setEditingItemImageUrl] = useState(null);
  const [editingItemImagePublicId, setEditingItemImagePublicId] = useState(null);
  const categoryNameRef = useRef(null);
  const dragIndexRef = useRef(null);
  const dragGhostRef = useRef(null);

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
      .select("id, name, description, price, image_url, image_public_id, available, category_id")
      .eq("restaurant_id", restaurant.id)
      .order("name");
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
  }, [restaurant]);

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
    setIsCategoryOpen(false);
    loadCategories();
    loadItems();
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

  const handleToggleAvailability = async (id, next) => {
    setErrorMessage("");
    const { error } = await supabase
      .from("categories")
      .update({ available: next })
      .eq("id", id);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    loadCategories();
  };

  const handleToggleItemAvailability = async (id, next) => {
    setErrorMessage("");
    const { error } = await supabase
      .from("menu_items")
      .update({ available: next })
      .eq("id", id);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    loadItems();
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
      setErrorMessage(error.message || "Failed to delete image.");
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
      available: item.available ?? true
    });
    setEditingItemId(item.id);
    setEditingItemImageUrl(item.image_url ?? null);
    setEditingItemImagePublicId(item.image_public_id ?? null);
    setIsAddOpen(true);
  };

  const handleAddItem = () => {
    if (!selectedCategory?.id) return;
    setNewItem({
      name: "",
      description: "",
      price: "",
      imageFile: null,
      available: true
    });
    setIsAddOpen(true);
  };

  const handleSubmitNewItem = async (event) => {
    event.preventDefault();
    if (!selectedCategory?.id) return;
    const price = Number(newItem.price);
    if (Number.isNaN(price)) {
      setErrorMessage("Invalid price value.");
      return;
    }

    setErrorMessage("");
    let imageUrl = editingItemImageUrl;
    let imagePublicId = editingItemImagePublicId;
    let replacedImage = false;
    if (newItem.imageFile) {
      try {
        const upload = await uploadImage(newItem.imageFile);
        imageUrl = upload.secureUrl;
        imagePublicId = upload.publicId;
        replacedImage = true;
      } catch (error) {
        setErrorMessage(error.message || "Image upload failed.");
        return;
      }
    }

    const payload = {
      restaurant_id: restaurant.id,
      category_id: selectedCategory.id,
      name: newItem.name.trim(),
      description: newItem.description.trim() || null,
      price,
      image_url: imageUrl,
      image_public_id: imagePublicId,
      available: newItem.available
    };

    const { error } = editingItemId
      ? await supabase.from("menu_items").update(payload).eq("id", editingItemId)
      : await supabase.from("menu_items").insert(payload);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    if (editingItemId && replacedImage && editingItemImagePublicId) {
      try {
        await deleteCloudinaryImage(editingItemImagePublicId);
      } catch (error) {
        setErrorMessage(error.message || "Failed to delete old image.");
      }
    }

    setEditingItemId(null);
    setEditingItemImageUrl(null);
    setEditingItemImagePublicId(null);
    setIsAddOpen(false);
    loadItems();
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

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? categories[0];

  const selectedItems =
    selectedCategory?.id ? itemsByCategory[selectedCategory.id] ?? [] : [];

  return (
    <div>
      <Heading>Menu Management</Heading>
      <Subheading>Organize your menu sections and reorder with drag-and-drop.</Subheading>
      <SplitLayout>
        <LeftPane>
          <PaneHeader>
            <div>
              <PaneTitle>Categories</PaneTitle>
            </div>
            <PrimaryButton
              type="button"
              onClick={() => {
                setName("");
                setOrderIndex("");
                setIsCategoryOpen(true);
              }}
            >
              Add category
            </PrimaryButton>
          </PaneHeader>
          {errorMessage && <InlineError>{errorMessage}</InlineError>}
          <List>
            {categories.map((category, index) => (
              <CategoryCard key={category.id}>
                <Row
                  $isDragging={draggingId === category.id}
                  $isDragOver={dragOverId === category.id}
                  $isSelected={selectedCategoryId === category.id}
                  draggable
                  onClick={() => setSelectedCategoryId(category.id)}
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
                  <DragHandle type="button" aria-label="Reorder category">
                    ⠿
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
                    aria-label="Edit category"
                    onClick={(event) => {
                      event.stopPropagation();
                      startEditingCategory(category);
                    }}
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
                  </IconButton>
                  <SwitchLabel
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <SwitchInput
                      type="checkbox"
                      checked={category.available ?? true}
                      onChange={(event) =>
                        handleToggleAvailability(category.id, event.target.checked)
                      }
                    />
                    <SwitchSlider />
                  </SwitchLabel>
                  <IconButton
                    type="button"
                    aria-label="Delete category"
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
                  <ModalTitle>Add category</ModalTitle>
                  <ModalSubtitle>Create a new menu section</ModalSubtitle>
                </div>
                <ModalClose
                  type="button"
                  aria-label="Close"
                  onClick={() => setIsCategoryOpen(false)}
                >
                  ×
                </ModalClose>
              </ModalHeader>
              <ModalForm onSubmit={handleCreate}>
                <ModalField>
                  <label htmlFor="category-name">Name</label>
                  <input
                    id="category-name"
                    ref={categoryNameRef}
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Category name"
                    required
                  />
                </ModalField>
                <ModalField>
                  <label htmlFor="category-order">Order (optional)</label>
                  <input
                    id="category-order"
                    type="number"
                    value={orderIndex}
                    onChange={(event) => setOrderIndex(event.target.value)}
                    placeholder="Order index"
                  />
                </ModalField>
                <ModalActions>
                  <SecondaryButton type="button" onClick={() => setIsCategoryOpen(false)}>
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton type="submit" disabled={loading}>
                    {loading ? "Saving..." : "Add category"}
                  </PrimaryButton>
                </ModalActions>
              </ModalForm>
            </ModalCard>
          </ModalOverlay>
        )}
        <RightPane>
          <PaneHeader>
            <div>
              <PaneTitle>{selectedCategory?.name ?? "Select a category"}</PaneTitle>
              
            </div>
            <PaneActions>
              <PrimaryButton type="button" onClick={handleAddItem} disabled={!selectedCategory}>
                Add new item
              </PrimaryButton>
            </PaneActions>
          </PaneHeader>
          {isAddOpen && (
            <ModalOverlay>
              <ModalCard>
                <ModalHeader>
                  <div>
                    <ModalTitle>{editingItemId ? "Edit item" : "Add new item"}</ModalTitle>
                    <ModalSubtitle>{selectedCategory?.name}</ModalSubtitle>
                  </div>
                  <ModalClose
                    type="button"
                    aria-label="Close"
                    onClick={() => {
                      setIsAddOpen(false);
                      setEditingItemId(null);
                      setEditingItemImageUrl(null);
                      setEditingItemImagePublicId(null);
                    }}
                  >
                    ×
                  </ModalClose>
                </ModalHeader>
                <ModalForm onSubmit={handleSubmitNewItem}>
                  <ModalField>
                    <label htmlFor="item-name">Name</label>
                    <input
                      id="item-name"
                      type="text"
                      value={newItem.name}
                      onChange={(event) =>
                        setNewItem((prev) => ({ ...prev, name: event.target.value }))
                      }
                      required
                    />
                  </ModalField>
                  <ModalField>
                    <label htmlFor="item-description">Description</label>
                    <textarea
                      id="item-description"
                      rows={3}
                      value={newItem.description}
                      onChange={(event) =>
                        setNewItem((prev) => ({ ...prev, description: event.target.value }))
                      }
                    />
                  </ModalField>
                  <ModalRow>
                    <ModalField>
                      <label htmlFor="item-price">Price</label>
                      <input
                        id="item-price"
                        type="number"
                        step="0.01"
                        value={newItem.price}
                        onChange={(event) =>
                          setNewItem((prev) => ({ ...prev, price: event.target.value }))
                        }
                        required
                      />
                    </ModalField>
                    <ModalField>
                      <label htmlFor="item-image">Image</label>
                      <input
                        id="item-image"
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          setNewItem((prev) => ({
                            ...prev,
                            imageFile: event.target.files?.[0] ?? null
                          }))
                        }
                      />
                    </ModalField>
                  </ModalRow>
                  <ModalRow>
                    <ModalField>
                      <label htmlFor="item-available">Available</label>
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
                    </ModalField>
                  </ModalRow>
                  <ModalActions>
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        setIsAddOpen(false);
                        setEditingItemId(null);
                        setEditingItemImageUrl(null);
                        setEditingItemImagePublicId(null);
                      }}
                    >
                      Cancel
                    </SecondaryButton>
                    <PrimaryButton type="submit">
                      {editingItemId ? "Update item" : "Save item"}
                    </PrimaryButton>
                  </ModalActions>
                </ModalForm>
              </ModalCard>
            </ModalOverlay>
          )}
          <ItemsPanel>
            {selectedCategory ? (
              selectedItems.length === 0 ? (
                <EmptyState>No items in this category yet.</EmptyState>
              ) : (
                <ItemsList>
                  {selectedItems.map((item) => (
                    <ItemRow key={item.id}>
                      <ItemInfo>
                        {item.image_url ? (
                          <ItemThumb src={item.image_url} alt={item.name} />
                        ) : (
                          <ItemThumbPlaceholder>No image</ItemThumbPlaceholder>
                        )}
                        <div>
                          <ItemTitle>{item.name}</ItemTitle>
                          {item.description && (
                            <ItemDescription>{item.description}</ItemDescription>
                          )}
                        </div>
                      </ItemInfo>
                      <ItemMeta>
                        <ItemPrice>${Number(item.price).toFixed(2)}</ItemPrice>
                        <ItemBadge $active={item.available}>
                          {item.available ? "Available" : "Unavailable"}
                        </ItemBadge>
                        <SwitchLabel>
                          <SwitchInput
                            type="checkbox"
                            checked={item.available ?? true}
                            onChange={(event) =>
                              handleToggleItemAvailability(item.id, event.target.checked)
                            }
                          />
                          <SwitchSlider />
                        </SwitchLabel>
                        <ItemActions>
                          <ItemIconButton
                            type="button"
                            aria-label="Edit item"
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
                            aria-label="Delete item"
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
              <EmptyState>Select a category to see items.</EmptyState>
            )}
          </ItemsPanel>
        </RightPane>
      </SplitLayout>
    </div>
  );
};

const Heading = styled.h1`
  margin: 0 0 6px;
  font-size: 28px;
  font-weight: 600;
`;

const Subheading = styled.p`
  margin: 0 0 20px;
  color: var(--text-muted);
`;

const List = styled.div`
  display: grid;
  gap: 12px;
`;

const Row = styled.div`
  background: var(--surface);
  padding: 14px;
  border-radius: var(--radius-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border: 1px solid
    ${({ $isDragOver, $isSelected }) =>
      $isDragOver || $isSelected ? "rgba(99, 102, 241, 0.6)" : "var(--border)"};
  box-shadow: ${({ $isDragging }) =>
    $isDragging ? "0 20px 36px rgba(0, 0, 0, 0.35)" : "0 0 0 rgba(0,0,0,0)"};
  transform: ${({ $isDragging }) => ($isDragging ? "scale(1.02)" : "none")};
  opacity: ${({ $isDragging }) => ($isDragging ? 0.35 : 1)};
  background: ${({ $isDragOver, $isSelected }) =>
    $isDragOver || $isSelected ? "rgba(99, 102, 241, 0.12)" : "var(--surface)"};
  transition: box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease,
    background 0.2s ease, border-color 0.2s ease;
  cursor: ${({ $isDragging }) => ($isDragging ? "grabbing" : "grab")};
`;

const DragHandle = styled.button`
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  border-radius: 10px;
  padding: 6px 8px;
  cursor: grab;
  line-height: 1;

  &:active {
    cursor: grabbing;
  }
`;

const CategoryName = styled.span`
  color: var(--text);
  font-weight: 500;
  flex: 1;
  text-align: left;
`;

const CategoryEditInput = styled.input`
  border: 1px solid var(--border);
  padding: 6px 8px;
  border-radius: 8px;
  width: 100%;
  flex: 1;
  text-align: left;
  background: rgba(15, 23, 42, 0.6);
  color: var(--text);
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
  border: 1px solid rgba(239, 68, 68, 0.4);
  background: rgba(15, 23, 42, 0.6);
  color: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-weight: 600;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.6);
    transform: translateY(-1px);
  }
`;

const TrashIcon = styled.svg`
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
    background: #bbf7d0;
  }
`;

const SwitchSlider = styled.span`
  position: absolute;
  inset: 0;
  background: rgba(148, 163, 184, 0.2);
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 999px;
  transition: background 0.2s ease, border-color 0.2s ease;

  &::before {
    content: "";
    position: absolute;
    height: 18px;
    width: 18px;
    left: 3px;
    top: 2px;
    background: #e2e8f0;
    border-radius: 50%;
    transition: transform 0.2s ease, background 0.2s ease;
  }
`;

const ItemsPanel = styled.div`
  background: var(--surface-2);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  padding: 14px;
  box-shadow: var(--shadow-sm);
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
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
`;

const ItemInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ItemThumb = styled.img`
  width: 52px;
  height: 52px;
  object-fit: cover;
  border-radius: 10px;
`;

const ItemThumbPlaceholder = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.12);
  color: var(--text-muted);
  display: grid;
  place-items: center;
  font-size: 10px;
`;

const ItemTitle = styled.h4`
  margin: 0 0 4px;
  font-size: 16px;
`;

const ItemDescription = styled.p`
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
`;

const ItemPrice = styled.span`
  font-weight: 600;
  color: #fff;
`;

const ItemMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted);
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
      $variant === "danger" ? "rgba(239, 68, 68, 0.5)" : "rgba(99, 102, 241, 0.4)"};
  background: rgba(15, 23, 42, 0.6);
  color: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: ${({ $variant }) =>
      $variant === "danger" ? "rgba(239, 68, 68, 0.18)" : "rgba(99, 102, 241, 0.18)"};
    border-color: ${({ $variant }) =>
      $variant === "danger" ? "rgba(239, 68, 68, 0.6)" : "rgba(99, 102, 241, 0.6)"};
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
  background: ${({ $active }) =>
    $active ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"};
  color: ${({ $active }) => ($active ? "#bbf7d0" : "#fecaca")};
  border: 1px solid
    ${({ $active }) => ($active ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)")};
`;

const EmptyState = styled.p`
  margin: 0;
  color: var(--text-muted);
`;

const SplitLayout = styled.div`
  display: grid;
  grid-template-columns: 30% 1fr;
  gap: 18px;
  align-items: start;
`;

const LeftPane = styled.div`
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: 16px;
  box-shadow: var(--shadow-sm);
`;

const RightPane = styled.div`
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: 18px;
  box-shadow: var(--shadow-sm);
`;

const PaneHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const PaneTitle = styled.h3`
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
`;

const PaneMeta = styled.span`
  font-size: 12px;
  color: var(--text-muted);
`;

const RightSubtitle = styled.p`
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
`;

const PaneActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const PrimaryButton = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.2);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);
`;

const SecondaryButton = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.6);
  color: var(--text);
  cursor: pointer;
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(10, 15, 28, 0.65);
  display: grid;
  place-items: center;
  z-index: 20;
  padding: 24px;
`;

const ModalCard = styled.div`
  width: min(560px, 100%);
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  padding: 20px;
  display: grid;
  gap: 16px;
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
`;

const ModalSubtitle = styled.p`
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
`;

const ModalClose = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.6);
  color: var(--text);
  cursor: pointer;
  font-size: 18px;
`;

const ModalForm = styled.form`
  display: grid;
  gap: 12px;
`;

const ModalField = styled.div`
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
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
