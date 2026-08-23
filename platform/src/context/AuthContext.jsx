import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ensurePlatformAdmin, platformAdminExists, supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [seatTaken, setSeatTaken] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    platformAdminExists().then((exists) => setSeatTaken(exists));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function resolveAdmin(next) {
      if (!next?.user) {
        if (mounted) {
          setIsAdmin(false);
          bootstrappedRef.current = true;
          setBootstrapped(true);
        }
        return;
      }

      const ok = await ensurePlatformAdmin();
      if (!mounted) return;
      if (ok) setSeatTaken(true);
      setIsAdmin(ok);
      bootstrappedRef.current = true;
      setBootstrapped(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      resolveAdmin(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "TOKEN_REFRESHED" && bootstrappedRef.current) return;
      resolveAdmin(next);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;

  const value = useMemo(
    () => ({
      session,
      user,
      loading: !bootstrapped,
      isAdmin,
      seatTaken,
      signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
      signUp: (email, password) =>
        supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        }),
      signOut: () => supabase.auth.signOut(),
    }),
    [session, user, bootstrapped, isAdmin, seatTaken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
