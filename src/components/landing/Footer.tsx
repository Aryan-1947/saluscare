import { Stethoscope, Mail } from "lucide-react";
import { SiGithub } from "@icons-pack/react-simple-icons";

const techStack = ["React", "TypeScript", "Supabase", "Groq LLaMA", "Auth0", "Tailwind"];

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-[#E2E8F0] dark:border-white/[0.06] mt-16">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-[8px] bg-[#0F172A] dark:bg-white/[0.08] flex items-center justify-center">
                <Stethoscope size={14} className="text-[#0EA5A4]" />
              </div>
              <span className="font-semibold text-sm text-[#0F172A] dark:text-white">Salus Care</span>
            </div>
            <p className="text-sm text-[#64748B] dark:text-neutral-400 leading-relaxed mb-4">
              An AI-assisted triage guide that helps you understand symptoms and find the safest next step.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/Aryan-1947"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-[8px] bg-[#F8FAFC] dark:bg-white/[0.05] flex items-center justify-center text-[#64748B] dark:text-neutral-400 hover:text-[#0EA5A4] hover:bg-[#0EA5A4]/10 transition-colors"
                aria-label="GitHub"
              >
                <SiGithub size={15} />
              </a>
              <a
                href="https://linkedin.com/in/aryan-shekhawat-bb26902b8"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-[8px] bg-[#F8FAFC] dark:bg-white/[0.05] flex items-center justify-center text-[#64748B] dark:text-neutral-400 hover:text-[#0EA5A4] hover:bg-[#0EA5A4]/10 transition-colors"
                aria-label="LinkedIn"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a
                href="mailto:aryanshekhawat1947@gmail.com"
                className="w-8 h-8 rounded-[8px] bg-[#F8FAFC] dark:bg-white/[0.05] flex items-center justify-center text-[#64748B] dark:text-neutral-400 hover:text-[#0EA5A4] hover:bg-[#0EA5A4]/10 transition-colors"
                aria-label="Email"
              >
                <Mail size={15} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-neutral-500 mb-3">
              How it works
            </h4>
            <ul className="text-sm text-[#64748B] dark:text-neutral-400 space-y-2">
              <li>Describe symptoms in text or with a photo</li>
              <li>Safety checks run before anything else</li>
              <li>Structured guidance from a clinical knowledge base</li>
              <li>Follow up anytime to reassess</li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-neutral-500 mb-3">
              Built with
            </h4>
            <div className="flex flex-wrap gap-2">
              {techStack.map((tech) => (
                <span
                  key={tech}
                  className="text-xs px-2.5 py-1 rounded-full bg-[#F8FAFC] dark:bg-white/[0.05] text-[#64748B] dark:text-neutral-400 border border-[#E2E8F0] dark:border-white/[0.06]"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#E2E8F0] dark:border-white/[0.06] text-xs text-[#64748B] dark:text-neutral-500 leading-relaxed">
          © {new Date().getFullYear()} Salus Care. Informational only, not a substitute for professional medical care.
        </div>
      </div>
    </footer>
  );
}