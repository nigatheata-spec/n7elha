import { useEffect, lazy, Suspense } from "react";
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
import { PageLoader } from "@/components/PageLoader";

// Every route is its own chunk instead of one monolith bundle: a first-time
// visitor to the marketing site (the whole point of the SEO work — fast,
// indexable, decent on Saudi mobile networks) used to download the quiz
// editor, the teacher dashboard, and all nine game-mode canvases/physics
// engines before ever seeing the landing page.
const Landing     = lazy(() => import("./pages/Landing"));
const Services    = lazy(() => import("./pages/Services"));
const About       = lazy(() => import("./pages/About"));
const Partners    = lazy(() => import("./pages/Partners"));
const Contact     = lazy(() => import("./pages/Contact"));
const Schools     = lazy(() => import("./pages/Schools"));
const Blog        = lazy(() => import("./pages/Blog"));
const BlogPost    = lazy(() => import("./pages/BlogPost"));
const Auth        = lazy(() => import("./pages/Auth"));
const Dashboard   = lazy(() => import("./pages/teacher/Dashboard"));
const Quizzes     = lazy(() => import("./pages/teacher/Quizzes"));
const QuizEditor  = lazy(() => import("./pages/teacher/QuizEditor"));
const HostGame    = lazy(() => import("./pages/teacher/HostGame"));
const HostedGames = lazy(() => import("./pages/teacher/HostedGames"));
const HomeworkMonitorPage = lazy(() => import("./pages/teacher/HomeworkMonitorPage"));
const GameMonitor = lazy(() => import("./pages/teacher/GameMonitor"));
const GameResults = lazy(() => import("./pages/teacher/GameResults"));
const Analytics    = lazy(() => import("./pages/teacher/Stubs").then(m => ({ default: m.Analytics })));
const SettingsPage = lazy(() => import("./pages/teacher/Stubs").then(m => ({ default: m.SettingsPage })));
const Join        = lazy(() => import("./pages/play/Join"));
const Game        = lazy(() => import("./pages/play/Game"));
const ScanSquare  = lazy(() => import("./pages/play/ScanSquare"));
const Homework    = lazy(() => import("./pages/play/Homework"));
// Dev-only art preview for Don't Look Down (see the file header).
const DldPreview  = lazy(() => import("./pages/play/DldPreview"));
const NotFound    = lazy(() => import("./pages/NotFound"));

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
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/services" element={<Services />} />
            <Route path="/about" element={<About />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/schools" element={<Schools />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/play" element={<Join />} />
            {import.meta.env.DEV && <Route path="/play/dld-preview" element={<DldPreview />} />}
            <Route path="/play/:sessionId" element={<Game />} />
            <Route path="/scan/:kitId/:typeCode" element={<ScanSquare />} />
            {/* Homework links are shared straight to students — short, no code, no lobby. */}
            <Route path="/hw/:sessionId" element={<Homework />} />
            <Route path="/app" element={<RequireAuth><TeacherLayout /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="quizzes" element={<Quizzes />} />
              <Route path="quizzes/new" element={<QuizEditor />} />
              <Route path="quizzes/:id/edit" element={<QuizEditor />} />
              <Route path="host/:quizId" element={<HostGame />} />
              <Route path="games" element={<HostedGames />} />
              <Route path="games/:sessionId/homework" element={<HomeworkMonitorPage />} />
              <Route path="games/:sessionId/results" element={<GameResults />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            {/* Full-screen projector view (no sidebar/header) — this is the only
                page that's genuinely live in front of a class; results and
                homework are reviewed after the fact, so they stay in the shell. */}
            <Route path="/app/games/:sessionId/monitor" element={<RequireAuth><GameMonitor /></RequireAuth>} />
            <Route path="/index" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
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
