import { Stethoscope, Mail } from "lucide-react";
import { SiGithub } from "@icons-pack/react-simple-icons";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-[#E7E0D8] dark:border-[#322D28] mt-16">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Brand - left */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-[#1A1613] dark:bg-[#EDE8E2] flex items-center justify-center">
              <Stethoscope size={14} className="text-[#EA580C] dark:text-[#1A1613]" />
            </div>
            <span className="font-display font-semibold text-sm tracking-tight text-[#1A1613] dark:text-[#EDE8E2]">Salus Care</span>
          </div>

          {/* Socials - right */}
          <div className="flex items-center gap-3">
              <a
                href="https://github.com/Aryan-1947"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-[8px] bg-[#F5F0E8] dark:bg-white/[0.05] flex items-center justify-center text-[#57534E] dark:text-[#A8A29E] hover:text-[#EA580C] hover:bg-[#FFF3EA] dark:hover:bg-[#EA580C]/10 transition-colors"
                aria-label="GitHub"
              >
                <SiGithub size={15} />
              </a>
              <a
                href="https://linkedin.com/in/aryan-shekhawat-bb26902b8"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-[8px] bg-[#F5F0E8] dark:bg-white/[0.05] flex items-center justify-center text-[#57534E] dark:text-[#A8A29E] hover:text-[#EA580C] hover:bg-[#FFF3EA] dark:hover:bg-[#EA580C]/10 transition-colors"
                aria-label="LinkedIn"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a
                href="mailto:aryanshekhawat1947@gmail.com"
                className="w-8 h-8 rounded-[8px] bg-[#F5F0E8] dark:bg-white/[0.05] flex items-center justify-center text-[#57534E] dark:text-[#A8A29E] hover:text-[#EA580C] hover:bg-[#FFF3EA] dark:hover:bg-[#EA580C]/10 transition-colors"
                aria-label="Email"
              >
              <Mail size={15} />
          </a>
          </div>
        </div>

        <div className="mt-4 text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed text-center max-w-xl mx-auto">
          © {new Date().getFullYear()} Salus Care. Informational only, not a substitute for professional medical care.
        </div>
      </div>
    </footer>
  );
}