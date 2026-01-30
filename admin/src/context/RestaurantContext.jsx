import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import { useAuth } from "./AuthContext";

const RestaurantContext = createContext(null);

export const RestaurantProvider = ({ children }) => {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurant = async () => {
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
        .single();

      if (!error) {
        setRestaurant(data);
      } else {
        setRestaurant(null);
      }

      setLoading(false);
    };

    fetchRestaurant();
  }, [user]);

  const value = useMemo(
    () => ({
      restaurant,
      loading,
      refresh: async () => {
        if (!user) return;
        const { data } = await supabase
          .from("restaurants")
          .select("*")
          .eq("owner_id", user.id)
          .single();
        setRestaurant(data ?? null);
      }
    }),
    [restaurant, loading, user]
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
