import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileQuestion, Gamepad2, BarChart3, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/app", icon: LayoutDashboard, key: "dashboard", end: true },
  { to: "/app/quizzes", icon: FileQuestion, key: "my_quizzes" },
  { to: "/app/games", icon: Gamepad2, key: "hosted_games" },
  { to: "/app/analytics", icon: BarChart3, key: "analytics" },
  { to: "/app/settings", icon: Settings, key: "settings" },
];

export const TeacherLayout = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-e border-border bg-sidebar flex flex-col">
        <div className="h-16 px-5 flex items-center border-b border-sidebar-border">
          <Link to="/app"><Logo /></Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )
              }
            >
              <l.icon className="h-4 w-4" />
              {t(l.key)}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-3">
            <LogOut className="h-4 w-4" />
            {t("logout")}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-6">
          <div className="text-sm text-muted-foreground truncate">
            {user?.email}
          </div>
          <LangToggle />
        </header>
        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
