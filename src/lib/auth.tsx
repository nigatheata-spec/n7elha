import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

const clearStoredAuth = () => {
  Object.keys(localStorage)
    .filter((key) => key.startsWith("sb-") && key.includes("auth-token"))
    .forEach((key) => localStorage.removeItem(key));
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Resolve the initial session FIRST, then mark loading done.
    // onAuthStateChange must NOT set loading=false — it fires before
    // getSession resolves on cold load, which would briefly show no-user
    // and trigger RequireAuth to redirect before the real session arrives.
    let initialised = false;

    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      if (evt === "SIGNED_OUT") clearStoredAuth();
      setSession(s);
      // Only unblock loading after the first getSession() has already run.
      // Subsequent auth changes (sign-in, token refresh) can clear loading freely.
      if (initialised) setLoading(false);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) clearStoredAuth();
      setSession(data.session);
      initialised = true;
      setLoading(false);
    }).catch(() => {
      clearStoredAuth();
      setSession(null);
      initialised = true;
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Clear local state immediately so RequireAuth doesn't bounce
    setSession(null);
    clearStoredAuth();
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore — local state already cleared
    } finally {
      clearStoredAuth();
    }
  };

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>{children}</Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
