import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Code-split: each route loads its own chunk on demand
const LandingPage = lazy(() => import("@/pages/LandingPage").then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const AskPage = lazy(() => import("@/pages/AskPage").then((m) => ({ default: m.AskPage })));
const SessionsPage = lazy(() => import("@/pages/SessionsPage").then((m) => ({ default: m.SessionsPage })));
const SessionDetailPage = lazy(() =>
  import("@/pages/SessionDetailPage").then((m) => ({ default: m.SessionDetailPage }))
);

/** Remounts the detail page per session id, so switching sessions resets
 * local state (chat mode, turns, attachments) without setState-in-effect. */
function SessionDetailRoute() {
  const { sessionId } = useParams();
  return <SessionDetailPage key={sessionId ?? "none"} />;
}

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-[#A8A29E]">
      <Loader2 size={22} className="animate-spin" />
    </div>
  );
}

// Wraps a lazy route so a failed chunk load shows a recoverable "new version
// available - reload" fallback instead of an infinite spinner.
function LazyPage({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function NotFoundPage() {
  const location = useLocation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] dark:bg-[#191614] px-6">
      <div className="w-full max-w-md bg-white dark:bg-[#211D1A] border border-[#E7E0D8] dark:border-[#322D28] rounded-[12px] shadow-[0_4px_12px_rgba(26,22,19,0.06)] p-10 text-center">
        <p className="font-display text-6xl font-bold text-[#EA580C] mb-3">404</p>
        <h1 className="font-display text-lg font-semibold text-[#1A1613] dark:text-[#EDE8E2] mb-1.5">
          Page not found
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#A8A29E] mb-7 max-w-sm mx-auto leading-relaxed">
          The page at <span className="font-medium">{location.pathname}</span> doesn't exist or may
          have moved.
        </p>
        <a
          href="/"
          className="inline-block rounded-[8px] bg-[#EA580C] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#C2410C] transition-colors"
        >
          Back to home
        </a>
      </div>
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
  if (isAuthenticated) return <Navigate to="/ask" replace />;

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
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
            path="/ask"
            element={
              <Protected>
                <LazyPage>
                  <AskPage />
                </LazyPage>
              </Protected>
            }
          />
          <Route
            path="/sessions"
            element={
              <Protected>
                <LazyPage>
                  <SessionsPage />
                </LazyPage>
              </Protected>
            }
          />
          <Route
            path="/sessions/:sessionId"
            element={
              <Protected>
                <LazyPage>
                  <SessionDetailRoute />
                </LazyPage>
              </Protected>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
