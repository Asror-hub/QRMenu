import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../services/supabase";
import { useAuth } from "./AuthContext";
import { withAuthRetry } from "../utils/authSession";

type Restaurant = {
  id: string;
  name: string;
  owner_id: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  logo_url?: string | null;
  logo_public_id?: string | null;
  currency?: string | null;
  auto_accept?: boolean | null;
  sound_alerts?: boolean | null;
  prep_time?: number | null;
  email_alerts?: boolean | null;
  status_updates?: boolean | null;
  pos_webhook_enabled?: boolean | null;
  pos_type?: string | null;
  pos_webhook_url?: string | null;
  stripe_enabled?: boolean | null;
  plan_id?: string | null;
  subscription_status?: string | null;
} | null;

type RestaurantContextValue = {
  restaurant: Restaurant;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Update restaurant state with data just saved (avoids stale refresh) */
  updateRestaurant: (data: Restaurant) => void;
};

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

async function fetchRestaurantForUser(userId: string) {
  const { data, error } = await withAuthRetry(() =>
    supabase
      .from("restaurants")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
  );

  if (error) {
    console.warn("[Restaurant] load failed:", error.message);
    return null;
  }

  return ((data ?? [])[0] as Restaurant) ?? null;
}

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (authLoading) return;

      if (!user) {
        setRestaurant(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const next = await fetchRestaurantForUser(user.id);
      setRestaurant(next);
      setLoading(false);
    };

    void load();
  }, [user, authLoading]);

  useEffect(() => {
    if (!restaurant?.id) return;
    const channel = supabase
      .channel(`restaurant-sync-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurants",
          filter: `id=eq.${restaurant.id}`,
        },
        (payload) => {
          const next = (payload.new ?? null) as Restaurant;
          if (next) setRestaurant(next);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id]);

  const value = useMemo(
    () => ({
      restaurant,
      loading,
      refresh: async () => {
        if (!user || authLoading) return;
        const next = await fetchRestaurantForUser(user.id);
        if (next) setRestaurant(next);
      },
      updateRestaurant: (data: Restaurant) => setRestaurant(data),
    }),
    [restaurant, loading, user, authLoading]
  );

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error("useRestaurant must be used within RestaurantProvider");
  }
  return context;
}
