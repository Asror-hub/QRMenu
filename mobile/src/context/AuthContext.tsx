import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../services/supabase";
import type { Session, User } from "@supabase/supabase-js";
import { ensureFreshSession } from "../utils/authSession";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const fingerprintRef = useRef<string>("");

  useEffect(() => {
    let mounted = true;

    const applySession = (event: string, next: Session | null) => {
      const finger = sessionFingerprint(next);
      if (__DEV__) {
        const expiresIn =
          next?.expires_at != null
            ? Math.round(next.expires_at - Date.now() / 1000)
            : null;
        console.log(
          "[auth]",
          event,
          next ? `session ok (expires in ${expiresIn}s)` : "no session"
        );
      }
      // Skip redundant state updates that amplify refresh churn under Fast Refresh.
      if (finger === fingerprintRef.current && event === "TOKEN_REFRESHED") {
        return;
      }
      fingerprintRef.current = finger;
      setSession(next);
      setLoading(false);
    };

    const init = async () => {
      // Always refresh on launch so Android tablets with clock skew / stale
      // access tokens don't hit PostgREST with an expired JWT.
      const session = await ensureFreshSession();
      if (!mounted) return;
      applySession("INITIAL", session);
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
