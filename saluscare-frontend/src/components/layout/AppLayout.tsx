import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#191614]">
      <Navbar />
      {/* Navbar is fixed; offset the app content below its 4rem height */}
      <div className="pt-16">{children}</div>
    </div>
  );
}