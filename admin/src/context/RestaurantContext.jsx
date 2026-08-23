import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import { useAuth } from "./AuthContext";

const RestaurantContext = createContext(null);

export const RestaurantProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurant = async () => {
      if (authLoading) {
        return;
      }
      if (!user) {
        setRestaurant(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      setRestaurant(!error ? (data ?? [])[0] ?? null : null);

      setLoading(false);
    };

    fetchRestaurant();
  }, [user, authLoading]);

  useEffect(() => {
    if (!restaurant?.id) return;
    const channel = supabase
      .channel(`admin-restaurant-sync-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurants",
          filter: `id=eq.${restaurant.id}`,
        },
        (payload) => {
          if (payload.new) setRestaurant(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant?.id || !user || authLoading) return;
    const id = setInterval(async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurant.id)
        .single();
      if (!error && data) {
        setRestaurant(data);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [restaurant?.id, user, authLoading]);

  const value = useMemo(
    () => ({
      restaurant,
      loading,
      refresh: async () => {
        if (!user || authLoading) return;
        const { data } = await supabase
          .from("restaurants")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        setRestaurant((data ?? [])[0] ?? null);
      }
    }),
    [restaurant, loading, user, authLoading]
  );

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
};

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error("useRestaurant must be used within RestaurantProvider");
  }
  return context;
};
