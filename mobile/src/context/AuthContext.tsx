import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { supabase } from "../services/supabase";
import type { Session, User } from "@supabase/supabase-js";
import {
  ensureFreshSession,
  getSkewAwareRemainingSeconds,
  noteSessionReceipt,
} from "../utils/authSession";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionFingerprint(session: Session | null) {
  if (!session) return "null";
  return `${session.user.id}:${session.expires_at ?? 0}:${session.access_token.slice(0, 12)}`;
}

declare global {
  // Prevent Expo Fast Refresh from stacking AppState / interval binders.
  // eslint-disable-next-line no-var
  var __qrmenuSkewAuthBound: boolean | undefined;
}

function bindSkewAwareAuthRefresh() {
  if (Platform.OS === "web" || global.__qrmenuSkewAuthBound) return;
  global.__qrmenuSkewAuthBound = true;

  const onAppState = (state: AppStateStatus) => {
    if (state === "active") {
      void ensureFreshSession();
    }
  };

  onAppState(AppState.currentState);
  AppState.addEventListener("change", onAppState);

  setInterval(() => {
    if (AppState.currentState === "active") {
      void ensureFreshSession();
    }
  }, 60_000);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const fingerprintRef = useRef<string>("");

  useEffect(() => {
    let mounted = true;
    bindSkewAwareAuthRefresh();

    const applySession = (event: string, next: Session | null) => {
      if (next) noteSessionReceipt(next);
      const finger = sessionFingerprint(next);
      if (__DEV__) {
        const rawExpiresIn =
          next?.expires_at != null
            ? Math.round(next.expires_at - Date.now() / 1000)
            : null;
        const skewAware = next ? getSkewAwareRemainingSeconds(next) : null;
        const skewAwareRounded =
          skewAware != null ? Math.round(skewAware) : null;
        if (
          event !== "TOKEN_REFRESHED" ||
          (skewAwareRounded != null && skewAwareRounded < 120)
        ) {
          console.log(
            "[auth]",
            event,
            next
              ? `session ok (lifetime left ~${skewAwareRounded}s, raw clock ${rawExpiresIn}s)`
              : "no session"
          );
        }
      }
      if (finger === fingerprintRef.current && event === "TOKEN_REFRESHED") {
        return;
      }
      fingerprintRef.current = finger;
      setSession(next);
      setLoading(false);
    };

    const init = async () => {
      const next = await ensureFreshSession();
      if (!mounted) return;
      applySession("INITIAL", next);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      applySession(event, newSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signOut: () => supabase.auth.signOut(),
    }),
    [session, loading]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
