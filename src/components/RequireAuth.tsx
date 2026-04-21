import { useAuth } from "@/lib/auth";
import { Navigate, useLocation } from "react-router-dom";

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">...</div>;
  if (!user) return <Navigate to="/auth" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
};
