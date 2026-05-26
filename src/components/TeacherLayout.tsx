import type { CSSProperties } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, FileQuestion, Gamepad2, BarChart3, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/app", icon: LayoutDashboard, key: "dashboard", end: true },
  { to: "/app/quizzes", icon: FileQuestion, key: "my_quizzes" },
  { to: "/app/games", icon: Gamepad2, key: "hosted_games" },
  { to: "/app/analytics", icon: BarChart3, key: "analytics" },
  { to: "/app/settings", icon: Settings, key: "settings" },
];

const AppSidebar = () => {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-16 px-4 flex flex-row items-center gap-3 border-b border-sidebar-border">
        <SidebarTrigger className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" />
        <Link to="/app" className="flex items-center min-w-0">
          {collapsed ? <span className="font-mono font-black text-accent text-lg">n7</span> : <Logo className="[&_span]:text-accent" />}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">{t("dashboard")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map((l) => (
                <SidebarMenuItem key={l.to}>
                  <SidebarMenuButton asChild tooltip={t(l.key)}>
                    <NavLink
                      to={l.to}
                      end={l.end}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 text-sidebar-foreground/95 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                          isActive && "bg-sidebar-accent text-sidebar-foreground font-medium hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )
                      }
                    >
                      <l.icon className="h-4 w-4 shrink-0" />
                      <span>{t(l.key)}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t("logout")}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export const TeacherLayout = () => {
  return (
    <SidebarProvider style={{ "--sidebar-width": "12.75rem" } as CSSProperties}>
      <div className="min-h-screen bg-background flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile-only top bar for sidebar trigger */}
          <header className="h-14 border-b border-border bg-background sticky top-0 z-20 flex items-center px-3 md:hidden">
            <SidebarTrigger className="text-primary hover:bg-primary/10" />
          </header>
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
