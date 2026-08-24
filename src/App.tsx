import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Notifications } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { LangTransitionOverlay } from "@/components/LangTransitionOverlay";
import { RequireAuth } from "@/components/RequireAuth";
import { TeacherLayout } from "@/components/TeacherLayout";
import Landing from "./pages/Landing";
import Services from "./pages/Services";
import About from "./pages/About";
import Partners from "./pages/Partners";
import Schools from "./pages/Schools";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Auth from "./pages/Auth";
import Dashboard from "./pages/teacher/Dashboard";
import Quizzes from "./pages/teacher/Quizzes";
import QuizEditor from "./pages/teacher/QuizEditor";
import HostGame from "./pages/teacher/HostGame";
import HostedGames from "./pages/teacher/HostedGames";
import GameMonitor from "./pages/teacher/GameMonitor";
import GameResults from "./pages/teacher/GameResults";
import { Analytics, SettingsPage } from "./pages/teacher/Stubs";
import Join from "./pages/play/Join";
import Game from "./pages/play/Game";
import ScanSquare from "./pages/play/ScanSquare";
import NotFound from "./pages/NotFound";

import { ScrollToTop } from "@/components/ScrollToTop";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();

  const getSweepColor = () => {
    if (location.pathname.startsWith("/play")) {
      return "rgba(255,255,255,0.7)";
    }
    return "#EBDFC7";
  };

  useEffect(() => {
    const sweep = document.getElementById("app-scan-sweep");
    if (sweep) {
      const handleAnimEnd = () => sweep.remove();
      sweep.addEventListener("animationend", handleAnimEnd);
      return () => sweep.removeEventListener("animationend", handleAnimEnd);
    }
  }, []);

  return (
    <>
      <div id="app-scan-sweep" className="scan-sweep" style={{ "--sweep-color": getSweepColor() } as React.CSSProperties} />
      <div className="scan-sweep-fade">
        <Notifications />
        <LangTransitionOverlay />
        <AuthProvider>
          <ScrollToTop />
          {/* keyed on pathname so the enter animation replays per navigation */}
          <div key={location.pathname} className="page-enter">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/services" element={<Services />} />
            <Route path="/about" element={<About />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/schools" element={<Schools />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/play" element={<Join />} />
            <Route path="/play/:sessionId" element={<Game />} />
            <Route path="/scan/:kitId/:typeCode" element={<ScanSquare />} />
            <Route path="/app" element={<RequireAuth><TeacherLayout /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="quizzes" element={<Quizzes />} />
              <Route path="quizzes/new" element={<QuizEditor />} />
              <Route path="quizzes/:id/edit" element={<QuizEditor />} />
              <Route path="host/:quizId" element={<HostGame />} />
              <Route path="games" element={<HostedGames />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            {/* Full-screen projector views (no sidebar/header) */}
            <Route path="/app/games/:sessionId/monitor" element={<RequireAuth><GameMonitor /></RequireAuth>} />
            <Route path="/app/games/:sessionId/results" element={<RequireAuth><GameResults /></RequireAuth>} />
            <Route path="/index" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </div>
        </AuthProvider>
      </div>
    </>
  );
};

const App = () => {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
