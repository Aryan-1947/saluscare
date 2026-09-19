import { motion } from "framer-motion";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "react-router-dom";
import { Stethoscope, Shield, Lock } from "lucide-react";

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
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B0F19] px-4 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div animate={{ x: [0, 30, -20, 0], y: [0, -20, 10, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.08]" style={{ background: "radial-gradient(circle, #0EA5A4, transparent 70%)" }} />
        <motion.div animate={{ x: [0, -20, 30, 0], y: [0, 20, -10, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -left-40 w-[400px] h-[400px] rounded-full opacity-[0.06]" style={{ background: "radial-gradient(circle, #0F172A, transparent 70%)" }} />
        <motion.div animate={{ x: [0, 15, -15, 0], y: [0, -15, 15, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #0EA5A4, transparent 70%)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm rounded-[16px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] shadow-[0_4px_24px_rgba(15,23,42,0.08),0_12px_48px_rgba(15,23,42,0.04)] p-8"
      >
        <div className="w-14 h-14 rounded-[12px] bg-[#0F172A] dark:bg-white/[0.08] flex items-center justify-center mx-auto mb-6">
          <Stethoscope size={26} className="text-[#0EA5A4]" />
        </div>

        <h1 className="text-xl font-bold text-[#0F172A] dark:text-white text-center mb-1.5">
          Welcome to Salus Care
        </h1>
        <p className="text-sm text-[#64748B] dark:text-neutral-400 text-center mb-7 leading-relaxed">
          Sign in to start your health assessment. Your conversations are private and only visible to you.
        </p>

        <div className="flex flex-col gap-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleLogin}
            className="w-full rounded-[12px] bg-[#0F172A] dark:bg-[#0EA5A4] text-white py-3 text-sm font-semibold hover:bg-[#1E293B] dark:hover:bg-[#0C8E8D] transition-all shadow-[0_2px_8px_rgba(15,23,42,0.15)]"
          >
            Sign In
          </motion.button>

          <div className="flex items-center gap-3 my-1">
            <div className="h-px flex-1 bg-[#E2E8F0] dark:bg-white/10" />
            <span className="text-xs text-[#94A3B8] dark:text-neutral-500">or</span>
            <div className="h-px flex-1 bg-[#E2E8F0] dark:bg-white/10" />
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 rounded-[12px] border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-white/[0.03] py-3 text-sm font-semibold text-[#0F172A] dark:text-white hover:bg-[#F8FAFC] dark:hover:bg-white/[0.06] transition-all"
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

        <div className="flex items-center justify-center gap-4 mt-6 pt-5 border-t border-[#E2E8F0] dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8] dark:text-neutral-500"><Shield size={12} /><span>Encrypted</span></div>
          <div className="w-1 h-1 rounded-full bg-[#E2E8F0] dark:bg-neutral-700" />
          <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8] dark:text-neutral-500"><Lock size={12} /><span>Private</span></div>
        </div>
          <p className="text-[10px] text-[#94A3B8] dark:text-neutral-500 text-center mt-4 leading-relaxed">
          By signing in, you agree that Salus Care provides educational information only, not medical diagnosis or treatment.
        </p>
      </motion.div>
    </div>
  );
}
