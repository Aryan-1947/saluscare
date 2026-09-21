import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#EEF2F7] dark:bg-[#0B0F19] transition-colors">
      <Navbar />
      <div className="relative">
        <div className="fixed inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.025] dark:opacity-[0.035]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "28px 28px",
              color: "#0F172A",
            }}
          />
          <div
            className="absolute -top-32 right-0 w-[500px] h-[500px] rounded-full opacity-[0.10] dark:opacity-[0.07] blur-3xl"
            style={{ background: "radial-gradient(circle, #0EA5A4, transparent 70%)" }}
          />
        </div>
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}