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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST so we don't miss SIGNED_IN events
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setLoading(false);
    });
    // Then load existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Clear local state immediately so RequireAuth doesn't bounce
    setSession(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — local state already cleared
    }
  };

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>{children}</Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
