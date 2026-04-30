import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
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
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 px-3 flex flex-row items-center gap-2 border-b border-sidebar-border">
        <SidebarTrigger className="shrink-0" />
        <Link to="/app" className="flex items-center min-w-0">
          {collapsed ? <span className="font-mono font-black text-primary text-lg">n7</span> : <Logo />}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("dashboard")}</SidebarGroupLabel>
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
                          "flex items-center gap-3 text-black hover:bg-sidebar-accent hover:text-black",
                          isActive && "bg-sidebar-primary text-black font-medium hover:bg-sidebar-primary hover:text-black"
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
        <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-3">
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t("logout")}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export const TeacherLayout = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-20 flex items-center justify-end px-3 md:px-6">
            <LangToggle />
          </header>
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
