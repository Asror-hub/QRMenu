import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../services/supabase";
import { useRestaurant } from "./RestaurantContext";
import notificationSound from "../assets/sounds/notification.mp3";

const STORAGE_SOUND = "admin_sound_enabled";
const ALARM_MS = 6000;
const POLL_MS = 10000;

const FeedbackAlertsContext = createContext(null);

export function FeedbackAlertsProvider({ children }) {
  const { restaurant } = useRestaurant();
  const [incomingIds, setIncomingIds] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(STORAGE_SOUND) === "true"
  );
  const [lastEventAt, setLastEventAt] = useState(0);
  const audioRef = useRef(null);
  const alarmRef = useRef(null);
  const restaurantIdRef = useRef(restaurant?.id);
  const incomingIdsRef = useRef([]);
  const soundEnabledRef = useRef(soundEnabled);
  const shouldRepeatRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const mountTimestampRef = useRef(Date.now());
  const acknowledgingRef = useRef(new Set());

  useEffect(() => {
    restaurantIdRef.current = restaurant?.id;
  }, [restaurant?.id]);

  useEffect(() => {
    incomingIdsRef.current = incomingIds;
  }, [incomingIds]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const playBeep = useCallback(async () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(notificationSound);
        audioRef.current.preload = "auto";
      }
      const audio = audioRef.current;
      audio.currentTime = 0;
      await audio.play();
    } catch {
      // ignore autoplay / missing asset
    }
  }, []);

  const setIncoming = useCallback((ids, { play = false } = {}) => {
    const unique = [...new Set(ids.filter(Boolean))];
    incomingIdsRef.current = unique;
    setIncomingIds(unique);
    if (!unique.length) {
      shouldRepeatRef.current = false;
      return;
    }
    setLastEventAt(Date.now());
    if (play) {
      shouldRepeatRef.current = true;
      if (soundEnabledRef.current) {
        void playBeep();
      }
    }
  }, [playBeep]);

  const markIncoming = useCallback((id, { play = true } = {}) => {
    if (!id || incomingIdsRef.current.includes(id)) return;
    setIncoming([id, ...incomingIdsRef.current], { play });
  }, [setIncoming]);

  const clearIncomingLocal = useCallback((id) => {
    if (!id) return;
    setIncoming(
      incomingIdsRef.current.filter((item) => item !== id),
      { play: false }
    );
  }, [setIncoming]);

  const acknowledge = useCallback(async (id) => {
    if (!id || acknowledgingRef.current.has(id)) return;
    acknowledgingRef.current.add(id);
    clearIncomingLocal(id);

    const { error } = await supabase
      .from("order_feedbacks")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", id)
      .is("acknowledged_at", null);

    acknowledgingRef.current.delete(id);
    if (error) {
      console.warn("[FeedbackAlerts] acknowledge failed:", error.message);
      // Restore if server reject — next poll/realtime will correct either way.
      markIncoming(id, { play: false });
    }
  }, [clearIncomingLocal, markIncoming]);

  const acknowledgeAll = useCallback(async () => {
    const ids = [...incomingIdsRef.current];
    setIncoming([], { play: false });
    if (!ids.length || !restaurant?.id) return;

    const { error } = await supabase
      .from("order_feedbacks")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("restaurant_id", restaurant.id)
      .is("acknowledged_at", null);

    if (error) {
      console.warn("[FeedbackAlerts] acknowledgeAll failed:", error.message);
    }
  }, [restaurant?.id, setIncoming]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_SOUND, String(next));
      if (next && incomingIdsRef.current.length) {
        shouldRepeatRef.current = true;
        void playBeep();
      }
      return next;
    });
  }, [playBeep]);

  const loadUnacknowledged = useCallback(async ({ playNew = false } = {}) => {
    if (!restaurant?.id) return;

    const { data, error } = await supabase
      .from("order_feedbacks")
      .select("id")
      .eq("restaurant_id", restaurant.id)
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) {
      // Column may not exist until migration 037 is applied.
      console.warn("[FeedbackAlerts] load unacked failed:", error.message);
      return;
    }

    const ids = (data ?? []).map((row) => row.id).filter(Boolean);
    const prev = new Set(incomingIdsRef.current);
    const added = ids.filter((id) => !prev.has(id));
    const isPastGrace = Date.now() - mountTimestampRef.current > 3000;
    const shouldPlay =
      playNew &&
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
  }, [restaurant?.id, setIncoming]);

  useEffect(() => {
    hasLoadedRef.current = false;
    mountTimestampRef.current = Date.now();
    shouldRepeatRef.current = false;
    setIncoming([], { play: false });
    if (!restaurant?.id) return;
    void loadUnacknowledged({ playNew: false });
  }, [restaurant?.id, loadUnacknowledged, setIncoming]);

  useEffect(() => {
    if (!restaurant?.id) return undefined;

    const channel = supabase
      .channel(`feedback-alerts-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_feedbacks",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        (payload) => {
          const row = payload?.new;
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
          const row = payload?.new;
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

    const shouldRepeat = shouldRepeatRef.current && soundEnabled && hasIncoming;
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
  }, [incomingIds.length, soundEnabled, playBeep]);

  useEffect(
    () => () => {
      if (alarmRef.current) {
        clearInterval(alarmRef.current);
        alarmRef.current = null;
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      incomingIds,
      incomingCount: incomingIds.length,
      isIncoming: (id) => Boolean(id && incomingIds.includes(id)),
      markIncoming,
      acknowledge,
      acknowledgeAll,
      soundEnabled,
      toggleSound,
      playBeep,
      lastEventAt,
    }),
    [
      incomingIds,
      markIncoming,
      acknowledge,
      acknowledgeAll,
      soundEnabled,
      toggleSound,
      playBeep,
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
    throw new Error("useFeedbackAlerts must be used within FeedbackAlertsProvider");
  }
  return ctx;
}
