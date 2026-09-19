import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  MessageSquareText,
  History,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  ChevronDown,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";

const navItems = [
  { to: "/ask", icon: MessageSquareText, label: "Ask" },
  { to: "/sessions", icon: History, label: "Sessions" },
];

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth0();
  const { isDark, toggle } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  // The landing page stays minimal: no app nav links there, just the brand,
  // theme toggle and Sign In / account menu. App links appear only inside
  // the app (under /ask, /sessions, ...).
  const onLanding = location.pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  const menuRef = useClickOutside(closeMenu);

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-[#E2E8F0] dark:border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-[8px] bg-[#0F172A] dark:bg-white/[0.08] flex items-center justify-center">
            <Stethoscope size={16} className="text-[#0EA5A4]" />
          </div>
          <span className="font-semibold text-[15px] text-[#0F172A] dark:text-white">
            Salus Care
          </span>
        </button>

        {isAuthenticated && !onLanding && (
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#0EA5A4]/10 text-[#0EA5A4]"
                      : "text-[#64748B] dark:text-neutral-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F8FAFC] dark:hover:bg-white/[0.04]"
                  )
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggle}
            className="p-2 rounded-[8px] text-[#64748B] dark:text-neutral-400 hover:bg-[#F8FAFC] dark:hover:bg-white/[0.06] hover:text-[#0F172A] dark:hover:text-white transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {isAuthenticated ? (
            <div ref={menuRef} className="relative hidden sm:block">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 pl-2 border-l border-[#E2E8F0] dark:border-white/10 ml-1 group"
                aria-label="Account menu"
                aria-expanded={menuOpen}
              >
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt=""
                    className={cn(
                      "w-7 h-7 rounded-full ring-2 transition-all",
                      menuOpen ? "ring-[#0EA5A4]/60" : "ring-transparent group-hover:ring-[#0EA5A4]/30"
                    )}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#F8FAFC] dark:bg-white/10 flex items-center justify-center">
                    <User size={13} className="text-[#64748B] dark:text-neutral-400" />
                  </div>
                )}
                <ChevronDown
                  size={13}
                  className={cn(
                    "text-[#64748B] dark:text-neutral-400 transition-transform",
                    menuOpen && "rotate-180"
                  )}
                />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 rounded-[12px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.08] shadow-[0_8px_32px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.08)] overflow-hidden z-50"
                  >
                    {/* Profile header */}
                    <div className="px-4 py-3.5 border-b border-[#E2E8F0] dark:border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        {user?.picture ? (
                          <img src={user.picture} alt="" className="w-9 h-9 rounded-full" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#0EA5A4]/10 flex items-center justify-center">
                            <User size={15} className="text-[#0EA5A4]" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#0F172A] dark:text-white truncate">
                            {user?.name || user?.given_name || "Account"}
                          </p>
                          <p className="text-xs text-[#64748B] dark:text-neutral-400 truncate">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="py-1.5">
                      <button
                        onClick={toggle}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#0F172A] dark:text-neutral-200 hover:bg-[#F8FAFC] dark:hover:bg-white/[0.05] transition-colors"
                      >
                        {isDark ? (
                          <Sun size={15} className="text-[#64748B] dark:text-neutral-400" />
                        ) : (
                          <Moon size={15} className="text-[#64748B] dark:text-neutral-400" />
                        )}
                        {isDark ? "Light mode" : "Dark mode"}
                      </button>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-[#E2E8F0] dark:border-white/[0.06] py-1.5">
                      <button
                        onClick={() =>
                          logout({ logoutParams: { returnTo: window.location.origin } })
                        }
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#DC2626] hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      >
                        <LogOut size={15} />
                        Log out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="hidden sm:block rounded-[10px] bg-[#0F172A] dark:bg-[#0EA5A4] text-white px-4 py-2 text-sm font-medium hover:bg-[#1E293B] dark:hover:bg-[#0C8E8D] transition-colors ml-1"
            >
              Sign In
            </button>
          )}

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 rounded-[8px] text-[#0F172A] dark:text-white" aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[#E2E8F0] dark:border-white/[0.06] px-4 py-3 flex flex-col gap-1">
          {isAuthenticated &&
            !onLanding &&
            navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#0EA5A4]/10 text-[#0EA5A4]"
                      : "text-[#64748B] dark:text-neutral-400"
                  )
                }
              >
                <item.icon size={17} />
                {item.label}
              </NavLink>
            ))}

          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-2.5 px-3 py-2.5 mt-1 border-t border-[#E2E8F0] dark:border-white/[0.06] pt-3">
                {user?.picture && <img src={user.picture} alt="" className="w-7 h-7 rounded-full" />}
                <span className="text-sm text-[#0F172A] dark:text-white">{user?.given_name}</span>
              </div>
              <button
                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                className="flex items-center gap-2 text-left px-3 py-2 text-sm text-[#DC2626]"
              >
                <LogOut size={16} /> Log out
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="rounded-[10px] bg-[#0F172A] dark:bg-[#0EA5A4] text-white px-4 py-2.5 text-sm font-semibold mt-2 transition-all"
            >
              Sign In
            </button>
          )}
        </div>
      )}
    </header>
  );
}