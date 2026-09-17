import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";import { lazy, Suspense } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

// Code-split: each route loads its own chunk on demand
const LandingPage = lazy(() => import("@/pages/LandingPage").then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const AskPage = lazy(() => import("@/pages/AskPage").then((m) => ({ default: m.AskPage })));
const SessionsPage = lazy(() => import("@/pages/SessionsPage").then((m) => ({ default: m.SessionsPage })));
const SessionDetailPage = lazy(() =>
  import("@/pages/SessionDetailPage").then((m) => ({ default: m.SessionDetailPage }))
);

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-[#94A3B8]">
      <Loader2 size={22} className="animate-spin" />
    </div>
  );
}

function NotFoundPage() {
  const location = useLocation();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
      <p className="text-5xl font-bold gradient-text mb-3">404</p>
      <h1 className="text-lg font-semibold text-[#0F172A] dark:text-white mb-1.5">Page not found</h1>
      <p className="text-sm text-[#64748B] dark:text-neutral-400 mb-6 max-w-sm">
        The page at <span className="font-medium">{location.pathname}</span> doesn't exist or may have moved.
      </p>
      <a
        href="/"
        className="rounded-[10px] bg-[#0F172A] dark:bg-[#0EA5A4] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Back to home
      </a>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth0();
  const location = useLocation();

  if (isLoading) return <PageLoader />;

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <AppLayout>{children}</AppLayout>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            path="/dashboard"
            element={
              <Protected>
                <DashboardPage />
              </Protected>
            }
          />
          <Route
            path="/ask"
            element={
              <Protected>
                <AskPage />
              </Protected>
            }
          />
          <Route
            path="/sessions"
            element={
              <Protected>
                <SessionsPage />
              </Protected>
            }
          />
          <Route
            path="/sessions/:sessionId"
            element={
              <Protected>
                <SessionDetailPage />
              </Protected>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
