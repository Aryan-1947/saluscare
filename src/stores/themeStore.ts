import { create } from "zustand";

type ThemeStore = {
  isDark: boolean;
  toggle: () => void;
};

const getInitial = () => {
  const stored = localStorage.getItem("salus-theme");
  if (stored === "light") return false;
  return true; // default to dark unless user explicitly chose light
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: getInitial(),
  toggle: () => {
    const next = !get().isDark;
    localStorage.setItem("salus-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
    set({ isDark: next });
  },
}));