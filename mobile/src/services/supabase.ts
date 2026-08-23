import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus, Platform } from "react-native";
import Constants from "expo-constants";

const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl ??
  (process.env.EXPO_PUBLIC_SUPABASE_URL as string) ??
  "";
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string) ??
  "";

const isBrowser = typeof window !== "undefined";

/**
 * Auth session JSON (JWTs) often exceeds Expo SecureStore's ~2048-byte limit.
 * AsyncStorage supports large values (recommended for Expo + Supabase).
 */
const authStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") {
      if (!isBrowser) return null;
      return window.localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      if (!isBrowser) return;
      window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      if (!isBrowser) return;
      window.localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase env vars are missing. Check .env: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

declare global {
  // Prevent Expo Fast Refresh from stacking multiple AppState → refresh timers.
  // Parallel refresh + refresh-token rotation = unexpected SIGNED_OUT.
  // eslint-disable-next-line no-var
  var __qrmenuAuthAppStateBound: boolean | undefined;
}

function bindAuthAppState() {
  if (Platform.OS === "web" || global.__qrmenuAuthAppStateBound) return;
  global.__qrmenuAuthAppStateBound = true;

  const sync = (state: AppStateStatus) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  };

  sync(AppState.currentState);
  AppState.addEventListener("change", sync);
}

bindAuthAppState();
