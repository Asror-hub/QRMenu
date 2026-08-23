import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { supabase } from "../services/supabase";
import { useRestaurant } from "./RestaurantContext";
import { useOrders } from "./OrdersContext";
import { withAuthRetry } from "../utils/authSession";

const ALARM_MS = 6000;
const POLL_MS = 10000;

type FeedbackAlertsContextValue = {
  incomingIds: string[];
  incomingCount: number;
  isIncoming: (id?: string | null) => boolean;
  markIncoming: (id: string, opts?: { play?: boolean }) => void;
  acknowledge: (id: string) => Promise<void>;
  acknowledgeAll: () => Promise<void>;
  soundEnabled: boolean;
  toggleSound: () => Promise<void>;
  lastEventAt: number;
};

const FeedbackAlertsContext = createContext<FeedbackAlertsContextValue | null>(
  null
);

async function playBeep() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      require("../../assets/sounds/notification.mp3"),
      { shouldPlay: true }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {
    // ignore
  }
}

export function FeedbackAlertsProvider({ children }: { children: ReactNode }) {
  const { restaurant } = useRestaurant();
  const { soundEnabled, toggleSound } = useOrders();
  const [incomingIds, setIncomingIds] = useState<string[]>([]);
  const [lastEventAt, setLastEventAt] = useState(0);
  const alarmRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restaurantIdRef = useRef(restaurant?.id);
  const soundEnabledRef = useRef(soundEnabled);
  const incomingIdsRef = useRef<string[]>([]);
  const shouldRepeatRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const mountTimestampRef = useRef(Date.now());
  const acknowledgingRef = useRef(new Set<string>());

  useEffect(() => {
    restaurantIdRef.current = restaurant?.id;
  }, [restaurant?.id]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    incomingIdsRef.current = incomingIds;
  }, [incomingIds]);

  const setIncoming = useCallback(
    (ids: string[], opts?: { play?: boolean }) => {
      const unique = [...new Set(ids.filter(Boolean))];
      incomingIdsRef.current = unique;
      setIncomingIds(unique);
      if (!unique.length) {
        shouldRepeatRef.current = false;
        return;
      }
      setLastEventAt(Date.now());
      if (opts?.play) {
        shouldRepeatRef.current = true;
        if (soundEnabledRef.current) {
          void playBeep();
        }
      }
    },
    []
  );

  const markIncoming = useCallback(
    (id: string, opts?: { play?: boolean }) => {
      if (!id || incomingIdsRef.current.includes(id)) return;
      setIncoming([id, ...incomingIdsRef.current], { play: opts?.play !== false });
    },
    [setIncoming]
  );

  const clearIncomingLocal = useCallback(
    (id: string) => {
      if (!id) return;
      setIncoming(
        incomingIdsRef.current.filter((item) => item !== id),
        { play: false }
      );
    },
    [setIncoming]
  );

  const acknowledge = useCallback(
    async (id: string) => {
      if (!id || acknowledgingRef.current.has(id)) return;
      acknowledgingRef.current.add(id);
      clearIncomingLocal(id);

      const { error } = await withAuthRetry(() =>
        supabase
          .from("order_feedbacks")
          .update({ acknowledged_at: new Date().toISOString() })
          .eq("id", id)
          .is("acknowledged_at", null)
      );

      acknowledgingRef.current.delete(id);
      if (error) {
        console.warn("[FeedbackAlerts] acknowledge failed:", error.message);
        markIncoming(id, { play: false });
      }
    },
    [clearIncomingLocal, markIncoming]
  );

  const acknowledgeAll = useCallback(async () => {
    const ids = [...incomingIdsRef.current];
    setIncoming([], { play: false });
    if (!ids.length || !restaurant?.id) return;

    const { error } = await withAuthRetry(() =>
      supabase
        .from("order_feedbacks")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("restaurant_id", restaurant.id)
        .is("acknowledged_at", null)
    );

    if (error) {
      console.warn("[FeedbackAlerts] acknowledgeAll failed:", error.message);
    }
  }, [restaurant?.id, setIncoming]);

  const loadUnacknowledged = useCallback(
    async (opts?: { playNew?: boolean }) => {
      if (!restaurant?.id) return;

      const { data, error } = await withAuthRetry(() =>
        supabase
          .from("order_feedbacks")
          .select("id")
          .eq("restaurant_id", restaurant.id)
          .is("acknowledged_at", null)
          .order("created_at", { ascending: false })
          .limit(80)
      );

      if (error) {
        console.warn("[FeedbackAlerts] load unacked failed:", error.message);
        return;
      }

      const ids = ((data ?? []) as { id: string }[])
        .map((row) => row.id)
        .filter(Boolean);
      const prev = new Set(incomingIdsRef.current);
      const added = ids.filter((id) => !prev.has(id));
      const isPastGrace = Date.now() - mountTimestampRef.current > 3000;
      const shouldPlay =
        Boolean(opts?.playNew) &&
        hasLoadedRef.current &&
        isPastGrace &&
        added.length > 0;

      hasLoadedRef.current = true;
      setIncoming(ids, { play: shouldPlay });
      if (ids.length) {
        shouldRepeatRef.current = true;
      } else {
        shouldRepeatRef.current = false;
      }
    },
    [restaurant?.id, setIncoming]
  );

  useEffect(() => {
    hasLoadedRef.current = false;
    mountTimestampRef.current = Date.now();
    shouldRepeatRef.current = false;
    setIncoming([], { play: false });
    if (!restaurant?.id) return;
    void loadUnacknowledged({ playNew: false });
  }, [restaurant?.id, loadUnacknowledged, setIncoming]);

  useEffect(() => {
    if (!restaurant?.id) return;

    const channel = supabase
      .channel(`feedback-alerts-mobile-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_feedbacks",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        (payload) => {
          const row = payload?.new as
            | { id?: string; acknowledged_at?: string | null }
            | undefined;
          if (!row?.id) return;
          if (restaurantIdRef.current !== restaurant.id) return;
          if (row.acknowledged_at) return;
          markIncoming(row.id, { play: true });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "order_feedbacks",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        (payload) => {
          const row = payload?.new as
            | { id?: string; acknowledged_at?: string | null }
            | undefined;
          if (!row?.id) return;
          if (restaurantIdRef.current !== restaurant.id) return;
          if (row.acknowledged_at) {
            clearIncomingLocal(row.id);
          } else {
            markIncoming(row.id, { play: false });
          }
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      void loadUnacknowledged({ playNew: true });
    }, POLL_MS);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id, markIncoming, clearIncomingLocal, loadUnacknowledged]);

  useEffect(() => {
    const hasIncoming = incomingIds.length > 0;
    if (!hasIncoming) {
      shouldRepeatRef.current = false;
    }

    const shouldRepeat =
      shouldRepeatRef.current && soundEnabled && hasIncoming;

    if (shouldRepeat && !alarmRef.current) {
      alarmRef.current = setInterval(() => {
        void playBeep();
      }, ALARM_MS);
    }

    if ((!shouldRepeat || !soundEnabled || !hasIncoming) && alarmRef.current) {
      clearInterval(alarmRef.current);
      alarmRef.current = null;
    }

    return () => {
      if (alarmRef.current) {
        clearInterval(alarmRef.current);
        alarmRef.current = null;
      }
    };
  }, [incomingIds.length, soundEnabled]);

  const prevSoundRef = useRef(soundEnabled);
  useEffect(() => {
    const turnedOn = !prevSoundRef.current && soundEnabled;
    prevSoundRef.current = soundEnabled;
    if (turnedOn && incomingIdsRef.current.length > 0) {
      shouldRepeatRef.current = true;
      void playBeep();
    }
  }, [soundEnabled]);

  const value = useMemo(
    () => ({
      incomingIds,
      incomingCount: incomingIds.length,
      isIncoming: (id?: string | null) =>
        Boolean(id && incomingIds.includes(id)),
      markIncoming,
      acknowledge,
      acknowledgeAll,
      soundEnabled,
      toggleSound,
      lastEventAt,
    }),
    [
      incomingIds,
      markIncoming,
      acknowledge,
      acknowledgeAll,
      soundEnabled,
      toggleSound,
      lastEventAt,
    ]
  );

  return (
    <FeedbackAlertsContext.Provider value={value}>
      {children}
    </FeedbackAlertsContext.Provider>
  );
}

export function useFeedbackAlerts() {
  const ctx = useContext(FeedbackAlertsContext);
  if (!ctx) {
    throw new Error(
      "useFeedbackAlerts must be used within FeedbackAlertsProvider"
    );
  }
  return ctx;
}
