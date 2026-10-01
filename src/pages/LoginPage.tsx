import { motion } from "framer-motion";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "react-router-dom";
import {
  Stethoscope,
  Shield,
  Lock,
  HeartPulse,
  Activity,
  Dna,
} from "lucide-react";

const reassurances = [
  { icon: Activity, text: "Triage in under a minute" },
  { icon: HeartPulse, text: "Red-flag emergency detection" },
  { icon: Dna, text: "Structured clinical knowledge" },
];

export function LoginPage() {
  const { loginWithRedirect } = useAuth0();
  const location = useLocation();

  // The page the user originally tried to visit (set by the Protected route guard)
  const returnTo = (location.state as { from?: string } | null)?.from ?? "/ask";

  const handleLogin = () => {
    loginWithRedirect({ appState: { returnTo } });
  };

  const handleGoogleLogin = () => {
    loginWithRedirect({
      authorizationParams: {
        connection: "google-oauth2",
      },
      appState: { returnTo },
    });
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#FAF7F2] dark:bg-[#191614] px-4">

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="bg-white dark:bg-[#211D1A] p-8 border border-[#E7E0D8] dark:border-[#322D28] rounded-[12px] shadow-[0_4px_12px_rgba(26,22,19,0.06)]">
          {/* Logo - flat ink tile with the orange accent mark */}
          <div className="w-[64px] h-[64px] mx-auto mb-5 rounded-[12px] bg-[#1A1613] dark:bg-[#EDE8E2] flex items-center justify-center">
            <Stethoscope size={28} className="text-[#EA580C] dark:text-[#1A1613]" />
          </div>

          <h1 className="font-display text-xl font-bold text-[#1A1613] dark:text-[#EDE8E2] text-center mb-1.5">
            Welcome to Salus Care
          </h1>
          <p className="text-sm text-[#57534E] dark:text-[#A8A29E] text-center mb-5 leading-relaxed">
            Sign in to start your health assessment. Your conversations are private and only visible to you.
          </p>

          {/* What you get - quiet reassurance strip */}
          <div className="flex flex-col gap-1.5 mb-5 rounded-[8px] bg-[#F5F0E8] dark:bg-white/[0.04] border border-[#E7E0D8]/70 dark:border-[#322D28] px-3.5 py-3">
            {reassurances.map((r) => (
              <div key={r.text} className="flex items-center gap-2.5 text-xs text-[#57534E] dark:text-[#A8A29E]">
                <r.icon size={13} className="text-[#EA580C] shrink-0" />
                <span>{r.text}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleLogin}
              className="w-full rounded-[8px] bg-[#EA580C] text-white py-3 text-sm font-semibold hover:bg-[#C2410C] transition-colors"
            >
              Sign In
            </motion.button>

            <div className="flex items-center gap-3 my-1">
              <div className="h-px flex-1 bg-[#E7E0D8] dark:border-[#322D28] dark:bg-[#322D28]" />
              <span className="text-xs text-[#A8A29E] dark:text-[#78716C]">or</span>
              <div className="h-px flex-1 bg-[#E7E0D8] dark:bg-[#322D28]" />
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 rounded-[8px] border border-[#E7E0D8] dark:border-[#322D28] bg-white dark:bg-[#26221E] py-3 text-sm font-semibold text-[#1A1613] dark:text-[#EDE8E2] hover:bg-[#F5F0E8] dark:hover:bg-white/[0.06] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </motion.button>
          </div>

          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="flex items-center gap-1.5 rounded-[6px] bg-[#F5F0E8] dark:bg-white/[0.04] border border-[#E7E0D8]/70 dark:border-[#322D28] px-3 py-1.5 text-[10px] font-medium text-[#57534E] dark:text-[#78716C]">
              <Shield size={11} className="text-[#15803D]" />
              <span>Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-[6px] bg-[#F5F0E8] dark:bg-white/[0.04] border border-[#E7E0D8]/70 dark:border-[#322D28] px-3 py-1.5 text-[10px] font-medium text-[#57534E] dark:text-[#78716C]">
              <Lock size={11} className="text-[#EA580C]" />
              <span>Private</span>
            </div>
          </div>

          <p className="text-[10px] text-[#A8A29E] dark:text-[#78716C] text-center mt-4 leading-relaxed">
            By signing in, you agree that Salus Care provides educational information only, not medical diagnosis or treatment.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
