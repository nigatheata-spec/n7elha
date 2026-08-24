import type { CSSProperties } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import logoLight from "@/assets/logo-light.png";
import {
  Sidebar, SidebarContent, SidebarProvider,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { LayoutDashboard, FileQuestion, History, BarChart3, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Seo } from "@/components/Seo";

const links = [
  { to: "/app", icon: LayoutDashboard, key: "dashboard", end: true },
  { to: "/app/quizzes", icon: FileQuestion, key: "my_quizzes" },
  { to: "/app/games", icon: History, key: "hosted_games" },
  { to: "/app/analytics", icon: BarChart3, key: "analytics" },
  { to: "/app/settings", icon: Settings, key: "settings" },
];

const AppSidebar = () => {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <Sidebar collapsible="none" className="border-2 border-[hsl(var(--nb-border))] rounded-l-2xl overflow-hidden mb-2" style={{ height: "calc(100vh - 0.5rem)", boxShadow: "-4px 0px 0px 0px hsl(var(--nb-border))" }}>
      {/* Logo */}
      <SidebarHeader className="h-12 md:h-16 flex items-center justify-center border-b border-sidebar-border px-2">
        <Link to="/app" className="flex items-center justify-center">
          <img src={logoLight} alt="nfelha" className="h-7 w-7 md:h-10 md:w-10 object-contain" />
        </Link>
      </SidebarHeader>

      {/* Nav items */}
      <SidebarContent className="py-2 md:py-3">
        <nav className="flex flex-col gap-1 px-1 md:px-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 md:gap-1.5 rounded-xl py-2 md:py-3 px-0.5 md:px-1 transition-all text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <l.icon className={cn("h-5 w-5 md:h-6 md:w-6 shrink-0", isActive && "text-accent")} />
                  <span className="text-[8px] md:text-[10px] font-medium text-center leading-tight max-w-[3rem] md:max-w-[3.5rem] truncate">
                    {t(l.key)}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </SidebarContent>

      {/* Logout */}
      <SidebarFooter className="border-t border-sidebar-border p-1.5 md:p-2">
        <button
          onClick={handleLogout}
          className="w-full flex flex-col items-center gap-1 md:gap-1.5 py-2 md:py-3 px-0.5 md:px-1 rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
        >
          <LogOut className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
          <span className="text-[8px] md:text-[10px] font-medium">{t("logout")}</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
};

export const TeacherLayout = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  // SidebarProvider applies --sidebar-width as an inline style, which always
  // wins over a responsive Tailwind class on the same property — so the
  // breakpoint has to be resolved in JS rather than in CSS here.
  const sidebarWidth = isMobile ? "3.75rem" : "5.5rem";

  return (
    <SidebarProvider style={{ "--sidebar-width": sidebarWidth } as CSSProperties}>
      {/* Everything under /app is behind auth — a teacher's own dashboard,
          quiz editor, live game controls. None of it is content the public
          should land on from search, so the whole layout is noindex. */}
      <Seo
        path={location.pathname}
        titleAr="لوحة المعلم"
        titleEn="Teacher Dashboard"
        descriptionAr="لوحة تحكم المعلم في نفلها."
        descriptionEn="Teacher dashboard on nfelha."
        index={false}
      />
      <div className="min-h-screen bg-background flex w-full items-start">
        <div className="sticky top-2 self-start shrink-0">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
