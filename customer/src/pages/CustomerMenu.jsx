import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import styled from "styled-components";
import { supabase } from "../services/supabase";

const FOOTER_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CustomerMenu = () => {
  const { restaurantId, tableId } = useParams();
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [restaurantName, setRestaurantName] = useState("Menu");
  const [restaurantProfile, setRestaurantProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    instagram: "",
    facebook: ""
  });
  const [restaurantHours, setRestaurantHours] = useState([]);
  const [tableNumber, setTableNumber] = useState(null);
  const [tableName, setTableName] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState({});
  const statusTimersRef = useRef({});
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [language, setLanguage] = useState("en");
  const [showCart, setShowCart] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [sheetOffset, setSheetOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragStartRef = useRef(null);
  const sheetRef = useRef(null);
  const footerRef = useRef(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});
  const [statusLoading, setStatusLoading] = useState(false);

  const setView = (next) => {
    setShowStatus(next);
    if (!tableId) return;
    localStorage.setItem(`qrmenu_view_${tableId}`, next ? "status" : "menu");
  };

  const persistOrders = (orders) => {
    if (!tableId) return;
    if (!orders.length) {
      localStorage.removeItem(`qrmenu_orders_${tableId}`);
      localStorage.removeItem(`qrmenu_view_${tableId}`);
      return;
    }
    localStorage.setItem(`qrmenu_orders_${tableId}`, JSON.stringify({ orders }));
  };

  const updateOrders = (updater) => {
    setActiveOrders((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persistOrders(next);
      if (!next.length) {
        setView(false);
      }
      return next;
    });
  };

  const normalizeOrders = (orders) =>
    orders.map((order) => {
      const status = order.status ?? "pending";
      const acceptedAt = status === "accepted" ? order.acceptedAt ?? Date.now() : null;
      const displayStatus =
        status === "accepted" ? order.displayStatus ?? "accepted" : status;
      return {
        ...order,
        status,
        acceptedAt,
        displayStatus
      };
    });

  useEffect(() => {
    const loadMenu = async () => {
      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("name, email, phone, address, instagram, facebook")
        .eq("id", restaurantId)
        .single();

      setRestaurantName(restaurantData?.name ?? "Menu");
      setRestaurantProfile({
        name: restaurantData?.name ?? "",
        email: restaurantData?.email ?? "",
        phone: restaurantData?.phone ?? "",
        address: restaurantData?.address ?? "",
        instagram: restaurantData?.instagram ?? "",
        facebook: restaurantData?.facebook ?? ""
      });

      const { data: tableData } = await supabase
        .from("tables")
        .select("table_number, table_name")
        .eq("id", tableId)
        .single();

      setTableNumber(tableData?.table_number ?? null);
      setTableName(tableData?.table_name ?? "");

      const { data: categoryData } = await supabase
        .from("categories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("available", true)
        .order("order_index", { ascending: true });

      const { data: itemData } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("available", true)
        .order("name", { ascending: true });

      const { data: hoursData } = await supabase
        .from("restaurant_hours")
        .select("day_of_week, open_time, close_time, closed")
        .eq("restaurant_id", restaurantId)
        .order("day_of_week", { ascending: true });

      const activeCategoryIds = new Set((categoryData ?? []).map((category) => category.id));
      const visibleItems = (itemData ?? []).filter(
        (item) => !item.category_id || activeCategoryIds.has(item.category_id)
      );

      setCategories(categoryData ?? []);
      setMenuItems(visibleItems);
      setRestaurantHours(hoursData ?? []);
    };

    loadMenu();
  }, [restaurantId, tableId]);

  useEffect(() => {
    const stored = localStorage.getItem(`qrmenu_cart_${tableId}`);
    if (stored) {
      setCart(JSON.parse(stored));
    }
  }, [tableId]);

  useEffect(() => {
    localStorage.setItem(`qrmenu_cart_${tableId}`, JSON.stringify(cart));
  }, [cart, tableId]);

  useEffect(() => {
    if (!selectedItem) return;
    const existing = cart.find((entry) => entry.id === selectedItem.id);
    setModalQuantity(existing?.quantity ?? 1);
  }, [selectedItem, cart]);

  useEffect(() => {
    if (!selectedItem) {
      setSheetOpen(false);
      return;
    }
    const id = requestAnimationFrame(() => setSheetOpen(true));
    return () => cancelAnimationFrame(id);
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [selectedItem]);

  useEffect(() => {
    if (!menuOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!tableId) return;
    const stored = localStorage.getItem(`qrmenu_orders_${tableId}`);
    const viewState = localStorage.getItem(`qrmenu_view_${tableId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      const nextOrders = normalizeOrders(parsed.orders ?? []);
      updateOrders(nextOrders);
      if (viewState) {
        setShowStatus(viewState === "status");
      } else {
        setShowStatus(nextOrders.length > 0);
      }
    } else {
      updateOrders([]);
      setShowStatus(false);
    }
  }, [tableId]);

  useEffect(() => {
    if (!activeOrders.length) return;
    const latestId = activeOrders[activeOrders.length - 1]?.orderId;
    const next = activeOrders.reduce((acc, order) => {
      acc[order.orderId] = order.orderId === latestId;
      return acc;
    }, {});
    setExpandedOrders(next);
  }, [activeOrders]);

  const toggleOrder = (id) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openFooter = () => {
    footerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const formatTableLabel = () => {
    if (tableName && tableNumber) {
      return `${tableName} ${tableNumber}`;
    }
    if (tableName) {
      return tableName;
    }
    if (tableNumber) {
      return `Table ${tableNumber}`;
    }
    return `Table ${tableId}`;
  };

  useEffect(() => {
    const timers = statusTimersRef.current;
    const activeIds = new Set();

    activeOrders.forEach((order) => {
      activeIds.add(order.orderId);
      if (order.status === "accepted" && order.displayStatus !== "preparing") {
        const acceptedAt = order.acceptedAt ?? Date.now();
        const remaining = 5000 - (Date.now() - acceptedAt);
        if (remaining <= 0) {
          updateOrders((prev) =>
            prev.map((item) =>
              item.orderId === order.orderId
                ? { ...item, displayStatus: "preparing" }
                : item
            )
          );
        } else if (!timers[order.orderId]) {
          timers[order.orderId] = setTimeout(() => {
            updateOrders((prev) =>
              prev.map((item) =>
                item.orderId === order.orderId
                  ? { ...item, displayStatus: "preparing" }
                  : item
              )
            );
            delete timers[order.orderId];
          }, remaining);
        }
      } else if (timers[order.orderId]) {
        clearTimeout(timers[order.orderId]);
        delete timers[order.orderId];
      }
    });

    Object.keys(timers).forEach((id) => {
      if (!activeIds.has(id)) {
        clearTimeout(timers[id]);
        delete timers[id];
      }
    });
  }, [activeOrders, tableId]);

  useEffect(
    () => () => {
      const timers = statusTimersRef.current;
      Object.values(timers).forEach((timerId) => clearTimeout(timerId));
      statusTimersRef.current = {};
    },
    []
  );

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return menuItems;
    return menuItems.filter((item) => {
      const name = item.name?.toLowerCase() ?? "";
      const description = item.description?.toLowerCase() ?? "";
      return name.includes(term) || description.includes(term);
    });
  }, [menuItems, searchTerm]);

  const groupedItems = useMemo(() => {
    const grouped = {};
    filteredItems.forEach((item) => {
      const key = item.category_id || "uncategorized";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });
    return grouped;
  }, [filteredItems]);

  const categoryFilters = useMemo(() => {
    const list = categories.map((category) => ({
      id: category.id,
      name: category.name
    }));
    const hasUncategorized = (groupedItems.uncategorized ?? []).length > 0;
    return [
      { id: "all", name: "All" },
      ...list,
      ...(hasUncategorized ? [{ id: "uncategorized", name: "More" }] : [])
    ];
  }, [categories, groupedItems]);

  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    if (!categories.length) return;
    setExpandedCategories((prev) => {
      const next = { ...prev };
      categories.forEach((category) => {
        if (!(category.id in next)) {
          next[category.id] = true;
        }
      });
      if (groupedItems.uncategorized && !("uncategorized" in next)) {
        next.uncategorized = true;
      }
      return next;
    });
  }, [categories, groupedItems]);

  const toggleCategory = (id) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSheetPointerDown = (event) => {
    if (sheetRef.current && sheetRef.current.scrollTop > 0) return;
    dragStartRef.current = event.clientY;
    setIsDraggingSheet(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleSheetPointerMove = (event) => {
    if (!isDraggingSheet || dragStartRef.current === null) return;
    const delta = event.clientY - dragStartRef.current;
    if (delta > 0) {
      setSheetOffset(delta);
      event.preventDefault();
    }
  };

  const handleSheetPointerUp = () => {
    if (!isDraggingSheet) return;
    setIsDraggingSheet(false);
    if (sheetOffset > 120) {
      setSheetOpen(false);
      setTimeout(() => setSelectedItem(null), 500);
    } else {
      setSheetOffset(0);
    }
    dragStartRef.current = null;
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((entry) => entry.id === item.id);
      if (existing) {
        return prev.map((entry) =>
          entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prev) =>
      prev
        .map((entry) =>
          entry.id === itemId ? { ...entry, quantity: entry.quantity - 1 } : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  };

  const submitOrder = async () => {
    if (!cart.length) return;
    setOrderError("");
    setSubmitting(true);
    const orderPayload = cart.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price
    }));

    const { data, error } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        items: orderPayload,
        comment: comment.trim() || null,
        status: "pending"
      })
      .select("id, order_number")
      .single();

    if (error) {
      setOrderError(error.message);
      setSubmitting(false);
      return;
    }

    const newOrder = {
      orderId: data.id,
      orderNumber: data.order_number,
      status: "pending",
      displayStatus: "pending",
      acceptedAt: null,
      items: orderPayload,
      comment: comment.trim() || ""
    };
    updateOrders((prev) => [...prev, newOrder]);
    setStatusLoading(true);
    setShowCart(false);
    setTimeout(() => {
      setStatusLoading(false);
      setView(true);
    }, 1400);
    setComment("");
    setCart([]);
    setSubmitting(false);
  };

  useEffect(() => {
    const channel = supabase
      .channel("order-status")
      .on(
        "broadcast",
        {
          event: "status"
        },
        (payload) => {
          if (payload.payload?.tableId !== tableId) return;
          const { orderId: updatedId, status } = payload.payload;
          updateOrders((prev) =>
            prev
              .map((order) => {
                if (order.orderId !== updatedId) return order;
                if (status === "accepted") {
                  return {
                    ...order,
                    status,
                    displayStatus: "accepted",
                    acceptedAt: Date.now()
                  };
                }
                return {
                  ...order,
                  status,
                  displayStatus: status,
                  acceptedAt: null
                };
              })
              .filter((order) => order.status !== "finish")
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId]);

  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  const hasCartBar = !showStatus && !showCart && cart.length > 0;
  const hasOrdersBar = !showStatus && !showCart && activeOrders.length > 0 && !hasCartBar;

  const currentYear = new Date().getFullYear();

  return (
    <Shell $hasCart={hasCartBar || hasOrdersBar}>
      {!showCart && !showStatus && (
        <Header>
          {searchOpen ? (
          <SearchRow>
            <SearchInput
              type="search"
              placeholder="Search menu..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              autoFocus
            />
            <IconButton
              type="button"
              aria-label="Close search"
              onClick={() => {
                setSearchTerm("");
                setSearchOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </IconButton>
          </SearchRow>
          ) : (
          <>
            <Title>{restaurantName}</Title>
            <HeaderActions>
              <LanguageSelect
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="en">English</option>
                <option value="ru">Russian</option>
                <option value="uz">Uzbek</option>
              </LanguageSelect>
              <IconButton
                type="button"
                aria-label="Open search"
                onClick={() => setSearchOpen(true)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="6" />
                  <path d="M16 16l5 5" />
                </svg>
              </IconButton>
              <MenuWrapper>
                <IconButton
                  type="button"
                  aria-label="Open menu"
                  onClick={() => setMenuOpen(true)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </IconButton>
              </MenuWrapper>
            </HeaderActions>
          </>
          )}
        </Header>
      )}

      {menuOpen && (
        <SidebarOverlay
          onClick={() => setMenuOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenuOpen(false);
          }}
          role="presentation"
        >
          <Sidebar
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Menu"
          >
            <SidebarHeader>
              <SidebarTitle>{restaurantProfile.name || restaurantName}</SidebarTitle>
              <SidebarClose type="button" onClick={() => setMenuOpen(false)}>
                ✕
              </SidebarClose>
            </SidebarHeader>
            <SidebarSection>
              <SidebarSectionTitle>Menu</SidebarSectionTitle>
              <SidebarList>
                <SidebarRow
                  type="button"
                  onClick={() => {
                    setShowCart(false);
                    setShowStatus(false);
                    setMenuOpen(false);
                  }}
                >
                  <SidebarRowLeft>
                    <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 12h16M4 6h16M4 18h16" />
                    </SidebarIcon>
                    <SidebarRowText>Home</SidebarRowText>
                  </SidebarRowLeft>
                  <SidebarArrow>›</SidebarArrow>
                </SidebarRow>
                {activeOrders.length > 0 && (
                  <SidebarRow
                    type="button"
                    onClick={() => {
                      setShowCart(false);
                      setView(true);
                      setMenuOpen(false);
                    }}
                  >
                    <SidebarRowLeft>
                      <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 4h14v16H5z" />
                        <path d="M8 8h8M8 12h8M8 16h5" />
                      </SidebarIcon>
                      <SidebarRowText>My orders</SidebarRowText>
                    </SidebarRowLeft>
                    <SidebarArrow>›</SidebarArrow>
                  </SidebarRow>
                )}
                {cart.length > 0 && (
                  <SidebarRow
                    type="button"
                    onClick={() => {
                      setShowCart(true);
                      setMenuOpen(false);
                    }}
                  >
                    <SidebarRowLeft>
                      <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="9" cy="20" r="1.6" />
                        <circle cx="17" cy="20" r="1.6" />
                        <path d="M3 4h2l2.5 10h10l2-7H7.2" />
                      </SidebarIcon>
                      <SidebarRowText>Cart</SidebarRowText>
                    </SidebarRowLeft>
                    <SidebarArrow>›</SidebarArrow>
                  </SidebarRow>
                )}
              </SidebarList>
            </SidebarSection>
            <SidebarSection>
              <SidebarSectionTitle>Contact</SidebarSectionTitle>
              <SidebarList>
                {restaurantProfile.address && (
                  <SidebarRow as="div" $static>
                    <SidebarRowLeft>
                      <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
                        <circle cx="12" cy="10" r="2.5" />
                      </SidebarIcon>
                      <SidebarRowText>{restaurantProfile.address}</SidebarRowText>
                    </SidebarRowLeft>
                  </SidebarRow>
                )}
                {restaurantProfile.phone && (
                  <SidebarRow as="div" $static>
                    <SidebarRowLeft>
                      <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4c0 1-1 2-2 2A16 16 0 0 1 5 6c0-1 1-2 2-2Z" />
                      </SidebarIcon>
                      <SidebarRowText>{restaurantProfile.phone}</SidebarRowText>
                    </SidebarRowLeft>
                  </SidebarRow>
                )}
                {restaurantProfile.email && (
                  <SidebarRow as="div" $static>
                    <SidebarRowLeft>
                      <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 6h16v12H4z" />
                        <path d="m4 7 8 6 8-6" />
                      </SidebarIcon>
                      <SidebarRowText>{restaurantProfile.email}</SidebarRowText>
                    </SidebarRowLeft>
                  </SidebarRow>
                )}
                {restaurantProfile.instagram && (
                  <SidebarRow as="div" $static>
                    <SidebarRowLeft>
                      <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="4" y="4" width="16" height="16" rx="5" />
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="17" cy="7" r="1.2" />
                      </SidebarIcon>
                      <SidebarRowText>
                        @{restaurantProfile.instagram.replace(/^@/, "")}
                      </SidebarRowText>
                    </SidebarRowLeft>
                  </SidebarRow>
                )}
                {restaurantProfile.facebook && (
                  <SidebarRow as="div" $static>
                    <SidebarRowLeft>
                      <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M14 8h3V5h-3c-2.2 0-4 1.8-4 4v2H7v3h3v5h3v-5h3l1-3h-4V9c0-.6.4-1 1-1Z" />
                      </SidebarIcon>
                      <SidebarRowText>{restaurantProfile.facebook}</SidebarRowText>
                    </SidebarRowLeft>
                  </SidebarRow>
                )}
              </SidebarList>
            </SidebarSection>
            <SidebarSection>
              <SidebarSectionTitle>Business hours</SidebarSectionTitle>
              <SidebarList>
                {restaurantHours.length ? (
                  restaurantHours.map((entry) => (
                    <SidebarRow key={entry.day_of_week} as="div" $static>
                      <SidebarRowLeft>
                        <SidebarIcon viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="12" r="8" />
                          <path d="M12 8v4l3 2" />
                        </SidebarIcon>
                        <SidebarRowText>{FOOTER_DAYS[entry.day_of_week] || "-"}</SidebarRowText>
                      </SidebarRowLeft>
                      <SidebarRowMeta>
                        {entry.closed
                          ? "Closed"
                          : `${(entry.open_time ?? "").slice(0, 5)} - ${(
                              entry.close_time ?? ""
                            ).slice(0, 5)}`}
                      </SidebarRowMeta>
                    </SidebarRow>
                  ))
                ) : (
                  <SidebarRow as="div" $static>
                    <SidebarRowLeft>
                      <SidebarRowText>Hours not set.</SidebarRowText>
                    </SidebarRowLeft>
                  </SidebarRow>
                )}
              </SidebarList>
            </SidebarSection>
          </Sidebar>
        </SidebarOverlay>
      )}

      {!searchOpen && !showCart && !showStatus && (
        <CategoryCarousel>
          {categoryFilters.map((category) => (
            <CategoryChip
              key={category.id}
              type="button"
              $active={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.name}
            </CategoryChip>
          ))}
        </CategoryCarousel>
      )}

      {!showStatus ? (
        <>
          {showCart ? (
            <CartScreen>
              <CartTopBar>
                <BackButton type="button" onClick={() => setShowCart(false)}>
                  ← Back
                </BackButton>
                <CartTitle>Cart</CartTitle>
                <CartMeta>{formatTableLabel()}</CartMeta>
              </CartTopBar>
              <CartBody>
                <CartList>
                  {cart.map((item) => (
                    <CartRow key={item.id}>
                      {item.image_url && (
                        <CartImage src={item.image_url} alt={item.name} />
                      )}
                      <CartInfo>
                        <span>{item.name}</span>
                        {item.description && <SmallText>{item.description}</SmallText>}
                        <SmallText>${Number(item.price || 0).toFixed(2)}</SmallText>
                      </CartInfo>
                      <CartControls>
                        <LineTotal>
                          ${(Number(item.price || 0) * item.quantity).toFixed(2)}
                        </LineTotal>
                        <QuantityControls>
                          <SmallButton type="button" onClick={() => removeFromCart(item.id)}>
                            -
                          </SmallButton>
                          <span>{item.quantity}</span>
                          <SmallButton type="button" onClick={() => addToCart(item)}>
                            +
                          </SmallButton>
                        </QuantityControls>
                      </CartControls>
                    </CartRow>
                  ))}
                </CartList>
              </CartBody>
              <CartFooter>
                <CommentField
                  placeholder="Add a comment (e.g., no onions)"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
                <TotalRow>
                  <span>Total</span>
                  <strong>${total.toFixed(2)}</strong>
                </TotalRow>
                {orderError && <ErrorText>{orderError}</ErrorText>}
                <CartPrimaryButton
                  type="button"
                  onClick={submitOrder}
                  disabled={!cart.length || submitting}
                >
                  {submitting ? "Submitting..." : "Place Order"}
                </CartPrimaryButton>
              </CartFooter>
            </CartScreen>
          ) : (
            <>
              {searchTerm.trim() ? (
                <Section>
                  <Items>
                    {filteredItems.map((item) => (
                      <ItemCard key={item.id}>
                        <ItemContentButton
                          type="button"
                          onClick={() => setSelectedItem(item)}
                        >
                          <h3>{item.name}</h3>
                          <p>{item.description}</p>
                          <strong>${Number(item.price).toFixed(2)}</strong>
                        </ItemContentButton>
                        <ItemActions>
                          {item.image_url && (
                            <ItemImageButton
                              type="button"
                              onClick={() => setSelectedItem(item)}
                            >
                              <ItemImage src={item.image_url} alt={item.name} />
                            </ItemImageButton>
                          )}
                          {cart.find((entry) => entry.id === item.id) ? (
                            <MenuItemControls>
                              <MenuItemControlButton
                                type="button"
                                onClick={() => removeFromCart(item.id)}
                              >
                                -
                              </MenuItemControlButton>
                              <span>
                                {cart.find((entry) => entry.id === item.id)?.quantity ?? 0}
                              </span>
                              <MenuItemControlButton
                                type="button"
                                onClick={() => addToCart(item)}
                              >
                                +
                              </MenuItemControlButton>
                            </MenuItemControls>
                          ) : (
                            <ItemButton type="button" onClick={() => addToCart(item)}>
                              Add
                            </ItemButton>
                          )}
                        </ItemActions>
                      </ItemCard>
                    ))}
                  </Items>
                </Section>
              ) : (
                <>
                  {categories.map((category) => {
                if (activeCategory !== "all" && activeCategory !== category.id) {
                  return null;
                }
                return (
                <Section key={category.id}>
                  <CategoryHeader
                    $collapsed={!expandedCategories[category.id]}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <h2>{category.name}</h2>
                <StatusGroup>
                  {!expandedCategories[category.id] && <ExploreBadge>Explore</ExploreBadge>}
                  <Chevron $expanded={expandedCategories[category.id]}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </Chevron>
                </StatusGroup>
                  </CategoryHeader>
                  <CategoryContent $expanded={expandedCategories[category.id]}>
                    <Items>
                      {(groupedItems[category.id] || []).map((item) => (
                    <ItemCard key={item.id}>
                      <ItemContentButton
                        type="button"
                        onClick={() => setSelectedItem(item)}
                      >
                        <h3>{item.name}</h3>
                        <p>{item.description}</p>
                        <strong>${Number(item.price).toFixed(2)}</strong>
                      </ItemContentButton>
                      <ItemActions>
                        {item.image_url && (
                          <ItemImageButton
                            type="button"
                            onClick={() => setSelectedItem(item)}
                          >
                            <ItemImage src={item.image_url} alt={item.name} />
                          </ItemImageButton>
                        )}
                      {cart.find((entry) => entry.id === item.id) ? (
                        <MenuItemControls>
                          <MenuItemControlButton
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                          >
                            -
                          </MenuItemControlButton>
                          <span>
                            {cart.find((entry) => entry.id === item.id)?.quantity ?? 0}
                          </span>
                          <MenuItemControlButton
                            type="button"
                            onClick={() => addToCart(item)}
                          >
                            +
                          </MenuItemControlButton>
                        </MenuItemControls>
                        ) : (
                          <ItemButton type="button" onClick={() => addToCart(item)}>
                            Add
                          </ItemButton>
                        )}
                      </ItemActions>
                    </ItemCard>
                      ))}
                    </Items>
                  </CategoryContent>
                </Section>
              );
              })}

              {groupedItems.uncategorized &&
                (activeCategory === "all" || activeCategory === "uncategorized") && (
                  <Section>
                    <CategoryHeader
                      $collapsed={!expandedCategories.uncategorized}
                      onClick={() => toggleCategory("uncategorized")}
                    >
                      <h2>More</h2>
                      <StatusGroup>
                        {!expandedCategories.uncategorized && <ExploreBadge>Explore</ExploreBadge>}
                        <Chevron $expanded={expandedCategories.uncategorized}>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </Chevron>
                      </StatusGroup>
                    </CategoryHeader>
                    <CategoryContent $expanded={expandedCategories.uncategorized}>
                      <Items>
                        {groupedItems.uncategorized.map((item) => (
                          <ItemCard key={item.id}>
                            <ItemContentButton
                              type="button"
                              onClick={() => setSelectedItem(item)}
                            >
                              <h3>{item.name}</h3>
                              <p>{item.description}</p>
                              <strong>${Number(item.price).toFixed(2)}</strong>
                            </ItemContentButton>
                            <ItemActions>
                              {item.image_url && (
                                <ItemImageButton
                                  type="button"
                                  onClick={() => setSelectedItem(item)}
                                >
                                  <ItemImage src={item.image_url} alt={item.name} />
                                </ItemImageButton>
                              )}
                            {cart.find((entry) => entry.id === item.id) ? (
                              <MenuItemControls>
                                <MenuItemControlButton
                                  type="button"
                                  onClick={() => removeFromCart(item.id)}
                                >
                                  -
                                </MenuItemControlButton>
                                <span>
                                  {cart.find((entry) => entry.id === item.id)?.quantity ?? 0}
                                </span>
                                <MenuItemControlButton
                                  type="button"
                                  onClick={() => addToCart(item)}
                                >
                                  +
                                </MenuItemControlButton>
                              </MenuItemControls>
                              ) : (
                                <ItemButton type="button" onClick={() => addToCart(item)}>
                                  Add
                                </ItemButton>
                              )}
                            </ItemActions>
                          </ItemCard>
                        ))}
                      </Items>
                    </CategoryContent>
                  </Section>
                )}
                </>
              )}

              {hasOrdersBar && (
                <OrdersBar $aboveCart={hasCartBar}>
                  <SummaryText>Active orders • {activeOrders.length}</SummaryText>
                  <OrderButton type="button" onClick={() => setView(true)}>
                    View My Orders
                  </OrderButton>
                </OrdersBar>
              )}
              {cart.length > 0 && (
                <StickyCart>
                  <CartSummary>
                    <SummaryText>
                      {cart.reduce((sum, item) => sum + item.quantity, 0)} items • $
                      {total.toFixed(2)}
                    </SummaryText>
                    <OrderButton type="button" onClick={() => setShowCart(true)}>
                      Order
                    </OrderButton>
                  </CartSummary>
                </StickyCart>
              )}
              <Footer ref={footerRef}>
                <FooterInner>
                  <FooterBrand>
                    <FooterLogo>{restaurantProfile.name || restaurantName}</FooterLogo>
                  {restaurantProfile.address && (
                    <FooterItem>
                      <FooterIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
                        <circle cx="12" cy="10" r="2.5" />
                      </FooterIcon>
                      <FooterText>{restaurantProfile.address}</FooterText>
                    </FooterItem>
                  )}
                  {restaurantProfile.phone && (
                    <FooterItem>
                      <FooterIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4c0 1-1 2-2 2A16 16 0 0 1 5 6c0-1 1-2 2-2Z" />
                      </FooterIcon>
                      <FooterText>{restaurantProfile.phone}</FooterText>
                    </FooterItem>
                  )}
                  {restaurantProfile.email && (
                    <FooterItem>
                      <FooterIcon viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 6h16v12H4z" />
                        <path d="m4 7 8 6 8-6" />
                      </FooterIcon>
                      <FooterText>{restaurantProfile.email}</FooterText>
                    </FooterItem>
                  )}
                    {(restaurantProfile.instagram || restaurantProfile.facebook) && (
                    <FooterLinks>
                        {restaurantProfile.instagram && (
                          <FooterLink
                            href={`https://instagram.com/${restaurantProfile.instagram.replace(
                              /^@/,
                              ""
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                          <FooterLinkIcon viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="4" y="4" width="16" height="16" rx="5" />
                            <circle cx="12" cy="12" r="4" />
                            <circle cx="17" cy="7" r="1.2" />
                          </FooterLinkIcon>
                            Instagram
                          </FooterLink>
                        )}
                        {restaurantProfile.facebook && (
                          <FooterLink
                            href={
                              restaurantProfile.facebook.startsWith("http")
                                ? restaurantProfile.facebook
                                : `https://${restaurantProfile.facebook}`
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                          <FooterLinkIcon viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M14 8h3V5h-3c-2.2 0-4 1.8-4 4v2H7v3h3v5h3v-5h3l1-3h-4V9c0-.6.4-1 1-1Z" />
                          </FooterLinkIcon>
                            Facebook
                          </FooterLink>
                        )}
                      </FooterLinks>
                    )}
                  </FooterBrand>
                  <FooterColumn>
                    <FooterTitle>Business hours</FooterTitle>
                    {restaurantHours.length ? (
                      <HoursList>
                        {restaurantHours.map((entry) => (
                          <HoursRow key={entry.day_of_week}>
                            <HoursDay>
                              <FooterIcon viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="8" />
                                <path d="M12 8v4l3 2" />
                              </FooterIcon>
                              <span>{FOOTER_DAYS[entry.day_of_week] || "-"}</span>
                            </HoursDay>
                            <strong>
                              {entry.closed
                                ? "Closed"
                                : `${(entry.open_time ?? "").slice(0, 5)} - ${(
                                    entry.close_time ?? ""
                                  ).slice(0, 5)}`}
                            </strong>
                          </HoursRow>
                        ))}
                      </HoursList>
                    ) : (
                      <FooterText>Hours not set.</FooterText>
                    )}
                  </FooterColumn>
                </FooterInner>
                <FooterBottom>
                  <span>Powered by QR Menu</span>
                  <span>
                    © {currentYear} {restaurantProfile.name || restaurantName}
                  </span>
                </FooterBottom>
              </Footer>
            </>
          )}
        </>
      ) : (
        <StatusCard>
          <StatusHeader>
            <StatusHeaderCenter>
              <StatusTitle>Order Status</StatusTitle>
              <StatusSubtitle>
                Live updates for {formatTableLabel()}
              </StatusSubtitle>
            </StatusHeaderCenter>
          </StatusHeader>
          {[...activeOrders].reverse().map((order) => {
            const orderTotal = order.items.reduce(
              (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
              0
            );
            return (
            <OrderCard
              key={order.orderId}
              role="button"
              tabIndex={0}
              onClick={() => toggleOrder(order.orderId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleOrder(order.orderId);
                }
              }}
            >
              <OrderHeader>
                <OrderNumber>Order #{order.orderNumber ?? "---"}</OrderNumber>
                <StatusGroup>
                  <StatusBadge>{order.displayStatus ?? order.status}</StatusBadge>
                  <ToggleButton
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleOrder(order.orderId);
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      style={{
                        transform: expandedOrders[order.orderId]
                          ? "rotate(0deg)"
                          : "rotate(-90deg)"
                      }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </ToggleButton>
                </StatusGroup>
              </OrderHeader>
              {expandedOrders[order.orderId] && (
                <>
                  {order.comment && (
                    <OrderComment>
                      <strong>Comment</strong>
                      <span>{order.comment}</span>
                    </OrderComment>
                  )}
                  <OrderItems>
                    {order.items.map((item) => (
                      <OrderRow key={`${order.orderId}-${item.id}`}>
                      <span>
                        {item.quantity}x {item.name}
                      </span>
                        <strong>
                          ${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                        </strong>
                      </OrderRow>
                    ))}
                  </OrderItems>
                  <OrderTotalRow>
                    <span>Order Total</span>
                    <strong>${orderTotal.toFixed(2)}</strong>
                  </OrderTotalRow>
                </>
              )}
            </OrderCard>
          );
          })}
          <StatusActions>
            <PrimaryButton type="button" onClick={() => setView(false)}>
              Back to Menu
            </PrimaryButton>
          </StatusActions>
        </StatusCard>
      )}
      {statusLoading && (
        <StatusLoading>
          <Spinner />
          <span>Preparing your order...</span>
        </StatusLoading>
      )}
      {selectedItem && (
          <ModalOverlay
            onClick={() => {
              setSheetOpen(false);
              setTimeout(() => setSelectedItem(null), 500);
            }}
          >
          <ModalSheet
            $open={sheetOpen}
            $offset={sheetOffset}
            $dragging={isDraggingSheet}
            onClick={(event) => event.stopPropagation()}
            ref={sheetRef}
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerUp}
            onPointerCancel={handleSheetPointerUp}
          >
            <ModalClose
              type="button"
              aria-label="Close"
              onClick={() => {
                setSheetOpen(false);
                setTimeout(() => setSelectedItem(null), 500);
              }}
            >
              ✕
            </ModalClose>
            <ModalHandle />
            {selectedItem.image_url && (
              <ModalImage src={selectedItem.image_url} alt={selectedItem.name} />
            )}
            <ModalContent>
              <h2>{selectedItem.name}</h2>
              {selectedItem.description && <p>{selectedItem.description}</p>}
              <ModalPrice>${Number(selectedItem.price).toFixed(2)}</ModalPrice>
            </ModalContent>
            <ModalActions>
              <ModalControls>
                <ItemControlButton
                  type="button"
                  onClick={() => setModalQuantity((qty) => Math.max(1, qty - 1))}
                >
                  -
                </ItemControlButton>
                <span>{modalQuantity}</span>
                <ItemControlButton
                  type="button"
                  onClick={() => setModalQuantity((qty) => qty + 1)}
                >
                  +
                </ItemControlButton>
              </ModalControls>
              <ModalAddButton
                type="button"
                onClick={() => {
                  if (!selectedItem) return;
                  setCart((prev) => {
                    const existing = prev.find((entry) => entry.id === selectedItem.id);
                    if (existing) {
                      return prev.map((entry) =>
                        entry.id === selectedItem.id
                          ? { ...entry, quantity: modalQuantity }
                          : entry
                      );
                    }
                    return [
                      ...prev,
                      {
                        id: selectedItem.id,
                        name: selectedItem.name,
                        description: selectedItem.description,
                        price: selectedItem.price,
                        image_url: selectedItem.image_url,
                        quantity: modalQuantity
                      }
                    ];
                  });
                }}
              >
                Add
              </ModalAddButton>
            </ModalActions>
          </ModalSheet>
        </ModalOverlay>
      )}
    </Shell>
  );
};

const Shell = styled.div`
  padding: 12px 16px ${({ $hasCart }) => ($hasCart ? "200px" : "40px")};
  max-width: 900px;
  margin: 0 auto;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex: 1;
  min-width: 260px;
  justify-content: flex-end;
`;

const SearchInput = styled.input`
  padding: 10px 12px;
  border-radius: 10px;
  border: none;
  width: 100%;
  font-size: 16px;
`;

const LanguageSelect = styled.select`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #fff;
`;

const IconButton = styled.button`
  border: 1px solid #e2e8f0;
  background: #fff;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  cursor: pointer;

  svg {
    width: 20px;
    height: 20px;
    stroke: #0f172a;
    stroke-width: 2;
    stroke-linecap: round;
    fill: none;
  }
`;

const MenuWrapper = styled.div`
  position: relative;
`;

const SidebarOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  z-index: 60;
  display: flex;
  justify-content: flex-start;
  overscroll-behavior: contain;
`;

const Sidebar = styled.div`
  width: min(300px, 78vw);
  height: 100%;
  background: #fff;
  padding: 18px;
  display: grid;
  gap: 16px;
  box-shadow: 20px 0 40px rgba(15, 23, 42, 0.2);
  animation: slideIn 0.25s ease;
  overflow-y: auto;
  overscroll-behavior: contain;

  @keyframes slideIn {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
    }
  }
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SidebarTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  color: #0f172a;
`;

const SidebarClose = styled.button`
  border: none;
  background: #f1f5f9;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
`;

const SidebarSection = styled.div`
  display: grid;
  gap: 10px;
`;

const SidebarSectionTitle = styled.h4`
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const SidebarList = styled.div`
  display: grid;
  gap: 6px;
`;

const SidebarRow = styled.button`
  border: 1px solid #e2e8f0;
  background: #fff;
  text-align: left;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: ${({ $static }) => ($static ? "default" : "pointer")};
  color: #0f172a;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 14px;
`;

const SidebarRowLeft = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`;

const SidebarRowText = styled.span`
  font-weight: 600;
`;

const SidebarRowMeta = styled.span`
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
`;

const SidebarArrow = styled.span`
  color: #cbd5f5;
  font-size: 18px;
  line-height: 1;
`;

const SidebarIcon = styled.svg`
  width: 18px;
  height: 18px;
  stroke: #64748b;
  stroke-width: 1.6;
  fill: none;
`;

const SearchRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
`;

const CategoryCarousel = styled.div`
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin: 0 0 14px;
  position: sticky;
  top: 0;
  background: #fff;
  padding-top: 0;
  z-index: 5;
  scroll-snap-type: x mandatory;

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #d9e2ec;
    border-radius: 999px;
  }
`;

const CategoryChip = styled.button`
  border: 1px solid ${({ $active }) => ($active ? "var(--color-primary)" : "#e2e8f0")};
  background: ${({ $active }) => ($active ? "var(--color-primary)" : "#fff")};
  color: ${({ $active }) => ($active ? "#fff" : "#0f172a")};
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  scroll-snap-align: start;
`;

const Section = styled.section`
  margin-bottom: 24px;

  h2 {
    margin-bottom: 12px;
  }
`;

const CategoryHeader = styled.button`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: ${({ $collapsed }) => ($collapsed ? "#fff" : "transparent")};
  border: ${({ $collapsed }) => ($collapsed ? "1px solid #e2e8f0" : "none")};
  border-radius: 12px;
  padding: ${({ $collapsed }) => ($collapsed ? "12px 14px" : "0")};
  margin-bottom: ${({ $collapsed }) => ($collapsed ? "0" : "12px")};
  cursor: pointer;
  box-shadow: ${({ $collapsed }) =>
    $collapsed ? "0 10px 20px rgba(15, 23, 42, 0.06)" : "none"};
  transition: box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease,
    padding 0.2s ease;

  h2 {
    margin: 0;
    color: #0f172a;
    font-size: 20px;
  }
`;

const Chevron = styled.span`
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: rotate(${({ $expanded }) => ($expanded ? "0deg" : "-90deg")});
  transition: transform 0.45s ease;

  svg {
    width: 18px;
    height: 18px;
    stroke: #0f172a;
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const ExploreBadge = styled.span`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 999px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 11px;
  text-transform: capitalize;
`;

const CategoryContent = styled.div`
  overflow: hidden;
  max-height: ${({ $expanded }) => ($expanded ? "1200px" : "0")};
  opacity: ${({ $expanded }) => ($expanded ? 1 : 0)};
  transform: translateY(${({ $expanded }) => ($expanded ? "0" : "-10px")});
  transform-origin: top;
  transition: max-height 0.35s ease, opacity 0.2s ease, transform 0.25s ease;

  ${({ $expanded }) =>
    $expanded &&
    `
    transition: max-height 1.1s ease, opacity 0.75s ease 0.16s,
      transform 0.95s ease;
  `}
`;

const Items = styled.div`
  display: grid;
  gap: 12px;
`;

const ItemCard = styled.div`
  background: #fff;
  border-radius: 0;
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
  border-bottom: 1px dashed #d9e2ec;

  h3 {
    margin: 0 0 4px;
  }

  p {
    margin: 0 0 6px;
    color: #64748b;
    font-size: 14px;
  }
`;

const ItemContentButton = styled.button`
  border: none;
  background: transparent;
  text-align: left;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  padding-top: 6px;

  h3,
  strong {
    color: #0f172a;
  }

  h3 {
    font-size: 18px;
  }

  strong {
    margin-top: auto;
    padding-top: 0;
    transform: translateY(-5px);
    font-size: 17px;
  }
`;

const ItemActions = styled.div`
  display: grid;
  gap: 10px;
  justify-items: end;
`;

const ItemImage = styled.img`
  width: 120px;
  height: 88px;
  border-radius: 10px;
  object-fit: contain;
  background: #fff;
`;

const ItemImageButton = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
`;

const ItemButton = styled.button`
  background: #fff;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  width: 120px;
  font-size: 15px;
`;

const ItemControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  height: 36px;
  width: 120px;
  justify-content: center;
`;

const MenuItemControls = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  height: 36px;
  width: 120px;
  justify-content: center;
`;

const ItemControlButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
`;

const MenuItemControlButton = styled.button`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: grid;
  align-items: end;
  z-index: 50;
  overscroll-behavior: contain;
`;

const ModalSheet = styled.div`
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px;
  display: grid;
  gap: 12px;
  max-height: 85vh;
  overflow-y: auto;
  transform: translateY(${({ $open, $offset }) => ($open ? $offset : 1000)}px);
  transition: ${({ $dragging }) => ($dragging ? "none" : "transform 0.9s ease")};
  touch-action: pan-y;
  position: relative;
  overscroll-behavior: contain;
`;

const ModalHandle = styled.div`
  width: 48px;
  height: 4px;
  border-radius: 999px;
  background: #e2e8f0;
  margin: 0 auto;
  cursor: grab;
`;

const ModalClose = styled.button`
  position: absolute;
  top: 10px;
  right: 12px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-size: 20px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
`;

const ModalImage = styled.img`
  width: 100%;
  max-height: 280px;
  object-fit: contain;
  background: #fff;
  border-radius: 12px;
`;

const ModalContent = styled.div`
  display: grid;
  gap: 6px;

  h2 {
    margin: 0;
  }

  p {
    margin: 0;
    color: #64748b;
  }
`;

const ModalPrice = styled.span`
  font-size: 18px;
  font-weight: 600;
`;

const ModalActions = styled.div`
  display: grid;
  grid-template-columns: 40% 60%;
  gap: 12px;
  align-items: center;
  width: 100%;
`;

const ModalControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  height: 48px;
  padding: 0 14px;
  width: 100%;
  justify-content: space-between;
  font-size: 16px;
`;

const ModalAddButton = styled.button`
  background: var(--color-primary);
  color: #fff;
  border: none;
  height: 48px;
  border-radius: 999px;
  cursor: pointer;
  width: 100%;
  font-size: 16px;
`;

const Cart = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  display: grid;
  gap: 12px;
`;

const StickyCart = styled(Cart)`
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 12px;
  max-width: 900px;
  margin: 0 auto;
  box-shadow: 0 -8px 20px rgba(15, 23, 42, 0.08);
  z-index: 10;
`;

const OrdersBar = styled(StickyCart)`
  bottom: ${({ $aboveCart }) => ($aboveCart ? "84px" : "12px")};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const CartScreen = styled(Cart)`
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
  gap: 16px;
  height: calc(100vh - 32px);
  overflow: hidden;
  padding-bottom: 140px;
  display: grid;
  grid-template-rows: auto 1fr;
  position: relative;
`;

const CartTopBar = styled.div`
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #fff;
  padding-bottom: 8px;
`;

const BackButton = styled.button`
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #0f172a;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
`;

const CartTitle = styled.h2`
  margin: 0;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 20px;
`;

const CartMeta = styled.span`
  font-size: 14px;
  color: #0f172a;
  font-weight: 600;
`;

const CartList = styled.div`
  display: grid;
  gap: 12px;
`;

const CartBody = styled.div`
  overflow-y: auto;
  padding: 0 4px 12px;
`;

const CartInfo = styled.div`
  display: grid;
  gap: 4px;
`;

const SmallText = styled.span`
  font-size: 12px;
  color: #64748b;
`;

const LineTotal = styled.span`
  font-weight: 600;
`;

const CartControls = styled.div`
  display: grid;
  gap: 10px;
  justify-items: end;
  align-items: end;
`;

const CartSummary = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const SummaryText = styled.p`
  margin: 0;
  font-weight: 600;
`;

const OrderButton = styled.button`
  border: none;
  background: var(--color-primary);
  color: #fff;
  padding: 12px 20px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 16px;
  min-width: 120px;
`;

const CartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CartRow = styled.div`
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid #eef2f7;
  border-radius: 12px;
  background: #f9fbff;
`;

const CartImage = styled.img`
  width: 64px;
  height: 64px;
  border-radius: 10px;
  object-fit: cover;
`;

const QuantityControls = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const SmallButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
`;

const TotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  padding-top: 8px;
  border-top: 1px solid #eef2f7;
`;

const CartFooter = styled.div`
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  background: #fff;
  padding: 12px 16px;
  display: grid;
  gap: 10px;
  box-shadow: 0 -8px 20px rgba(15, 23, 42, 0.08);
  border-radius: 12px;
`;

const CommentField = styled.textarea`
  resize: none;
  min-height: 70px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  font-family: inherit;
  font-size: 16px;
`;

const PrimaryButton = styled.button`
  border: none;
  background: var(--color-primary);
  color: #fff;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: none;
  width: 80%;
  max-width: 420px;
`;

const CartPrimaryButton = styled(PrimaryButton)`
  width: 100%;
  max-width: none;
`;

const StatusLoading = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.85);
  display: grid;
  place-items: center;
  gap: 8px;
  color: #0f172a;
  font-size: 14px;
  z-index: 60;
`;

const Spinner = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid #e2e8f0;
  border-top-color: var(--color-primary);
  animation: spin 0.9s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const GhostButton = styled.button`
  border: 1px solid #cbd5f5;
  background: transparent;
  color: #0f172a;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
`;

const ErrorText = styled.p`
  margin: 0;
  color: #dc2626;
  font-size: 14px;
`;

const StatusCard = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 6px 24px 24px;
  text-align: center;
  display: grid;
  gap: 12px;
`;

const StatusHeader = styled.div`
  display: grid;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eef2f7;
`;

const StatusHeaderCenter = styled.div`
  display: grid;
  gap: 4px;
  text-align: center;
`;

const StatusTitle = styled.h2`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
`;

const StatusSubtitle = styled.p`
  margin: 0;
  font-size: 13px;
  color: #64748b;
`;


const StatusBadge = styled.span`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 999px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 11px;
  text-transform: capitalize;
`;

const StatusActions = styled.div`
  display: flex;
  justify-content: center;
  position: fixed;
  bottom: 16px;
  left: 0;
  right: 0;
  z-index: 10;
`;

const OrderItems = styled.div`
  display: grid;
  gap: 8px;
  text-align: left;
`;

const OrderComment = styled.div`
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff7ed;
  color: #9a3412;
  text-align: left;

  strong {
    font-size: 12px;
    color: #9a3412;
  }
`;

const OrderRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  font-size: 14px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #f8fafc;
`;

const OrderCard = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  display: grid;
  gap: 12px;
  border: 1px solid #eef2f7;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  cursor: pointer;
`;

const StatusGroup = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  padding: 6px 10px;
  border-radius: 999px;
`;

const ToggleButton = styled.button`
  border: none;
  background: #fff;
  width: 28px;
  height: 28px;
  cursor: pointer;
  color: #0f172a;
  display: grid;
  place-items: center;
  border-radius: 50%;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);

  svg {
    width: 18px;
    height: 18px;
    stroke: #0f172a;
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.2s ease;
  }
`;

const OrderTotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
`;

const OrderHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const OrderNumber = styled.span`
  font-weight: 600;
  font-size: 14px;
  color: #0f172a;
`;

const Footer = styled.footer`
  margin-top: 28px;
  border-radius: 20px;
  background: #0f172a;
  color: #e2e8f0;
  padding: 22px;
  display: grid;
  gap: 18px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
`;

const FooterInner = styled.div`
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const FooterBrand = styled.div`
  display: grid;
  gap: 6px;
`;

const FooterLogo = styled.h3`
  margin: 0;
  font-size: 16px;
  color: #fff;
`;

const FooterColumn = styled.div`
  display: grid;
  gap: 8px;
`;

const FooterTitle = styled.h4`
  margin: 0;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
`;

const FooterText = styled.p`
  margin: 0;
  font-size: 12px;
  color: #cbd5f5;
`;

const FooterItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FooterIcon = styled.svg`
  width: 16px;
  height: 16px;
  stroke: #94a3b8;
  stroke-width: 1.6;
  fill: none;
`;

const FooterLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const FooterLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #fff;
  text-decoration: none;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
`;

const FooterLinkIcon = styled.svg`
  width: 14px;
  height: 14px;
  stroke: #fff;
  stroke-width: 1.6;
  fill: none;
`;

const FooterBottom = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  color: #94a3b8;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  padding-top: 12px;
  flex-wrap: wrap;
`;

const HoursList = styled.div`
  display: grid;
  gap: 6px;
`;

const HoursRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #cbd5f5;

  strong {
    color: #fff;
    font-weight: 600;
  }
`;

const HoursDay = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

export default CustomerMenu;
