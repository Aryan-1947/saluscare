import { create } from "zustand";

type ThemeStore = {
  isDark: boolean;
  toggle: () => void;
};

/** Resolve the initial theme: an explicit choice wins; otherwise the OS
 * preference decides on the very first visit. */
export function resolveInitialTheme(): boolean {
  try {
    const stored = localStorage.getItem("salus-theme");
    if (stored === "light") return false;
    if (stored === "dark") return true;
  } catch {
    /* storage unavailable - fall through to the system preference */
  }
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return false;
  }
  return true;
}

/** Apply (or re-apply) the theme class to <html>. Called from main.tsx before
 * React mounts so the first paint already carries the right colors. */
export function applyThemeClass(isDark: boolean): void {
  document.documentElement.classList.toggle("dark", isDark);
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: resolveInitialTheme(),
  toggle: () => {
    const next = !get().isDark;
    try {
      localStorage.setItem("salus-theme", next ? "dark" : "light");
    } catch {
      /* keep the session theme even if persistence fails */
    }
    applyThemeClass(next);
    set({ isDark: next });
  },
}));