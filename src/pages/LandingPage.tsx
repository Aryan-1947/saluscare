import {
  motion,
  useScroll,
  useTransform,
  MotionConfig,
  useInView,
  animate,
} from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Footer } from "@/components/landing/Footer";
import { useEffect, useRef, useState } from "react";
import {
  Stethoscope,
  MessageSquareText,
  ImagePlus,
  History,
  ShieldCheck,
  Siren,
  ArrowRight,
  Activity,
  ClipboardCheck,
  Heart,
  Lock,
  EyeOff,
  Trash2,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const features = [
  {
    icon: MessageSquareText,
    title: "AI Symptom Analysis",
    description:
      "Describe what you're feeling in your own words. Our system extracts structured symptom data and reasons through it like a triage nurse would.",
    tile: "bg-[#0EA5A4]/10 text-[#0EA5A4] group-hover:bg-[#0EA5A4]/15",
  },
  {
    icon: ImagePlus,
    title: "Image Analysis",
    description:
      "Share a photo of a visible symptom - a rash, a cut, a reaction - and get an informed assessment combined with your description.",
    tile: "bg-violet-500/10 text-violet-500 group-hover:bg-violet-500/15",
  },
  {
    icon: History,
    title: "Follow-up Care",
    description:
      "Symptoms change. Come back anytime to report how you're doing, and we'll reassess against your prior visit, not start from scratch.",
    tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/15",
  },
  {
    icon: ShieldCheck,
    title: "Safety-First Approach",
    description:
      "Every response is grounded in structured medical guidance, never invented. Uncertain cases are escalated, not guessed at.",
    tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/15",
  },
  {
    icon: Siren,
    title: "Emergency Routing",
    description:
      "Red-flag symptoms are detected before anything else runs, routing you to emergency guidance immediately, no delay.",
    tile: "bg-red-500/10 text-red-500 group-hover:bg-red-500/15",
  },
  {
    icon: Stethoscope,
    title: "Specialist Referral",
    description:
      "When your symptoms call for professional care, we tell you exactly which specialist to see and why, with safe interim steps.",
    tile: "bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500/15",
  },
];

type Stat = {
  icon: LucideIcon;
  value: number | null; // null = render static text instead of counting up
  prefix?: string;
  suffix?: string;
  staticValue?: string;
  label: string;
  tile: string;
};

const stats: Stat[] = [
  { icon: Activity, value: 60, prefix: "<", suffix: "s", label: "Average assessment", tile: "bg-[#0EA5A4]/10 text-[#0EA5A4]" },
  { icon: ClipboardCheck, value: 3, suffix: "-Tier", label: "Safety system", tile: "bg-violet-500/10 text-violet-500" },
  { icon: Siren, value: null, staticValue: "24/7", label: "Emergency ready", tile: "bg-red-500/10 text-red-500" },
  { icon: Heart, value: null, staticValue: "Free", label: "No cost, ever", tile: "bg-rose-500/10 text-rose-500" },
];

// Counts 0 -> target the first time the stat scrolls into view. Static
// values ("Free") render as-is.
function AnimatedCounter({ stat, delay }: { stat: Stat; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(() =>
    stat.value === null ? (stat.staticValue ?? "") : `${stat.prefix ?? ""}0${stat.suffix ?? ""}`
  );

  useEffect(() => {
    if (!inView || stat.value === null) return;
    const controls = animate(0, stat.value, {
      duration: 1.1,
      delay,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(`${stat.prefix ?? ""}${Math.round(v)}${stat.suffix ?? ""}`),
    });
    return () => controls.stop();
  }, [inView, delay, stat]);

  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="text-3xl md:text-4xl font-bold gradient-text"
    >
      {display}
    </motion.span>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);

  const goToApp = () => navigate(isAuthenticated ? "/ask" : "/login");

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-[#EEF2F7] dark:bg-[#0B0F19] text-[#0F172A] dark:text-white transition-colors">
      {/* Ambient background - gradient mesh, ultra-slow drift */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 50, -30, 0], y: [0, -40, 25, 0] }}
          transition={{ duration: 60, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -right-20 w-[700px] h-[700px] rounded-full opacity-[0.3] dark:opacity-[0.22] blur-3xl"
          style={{ background: "radial-gradient(circle, #0EA5A4, transparent 70%)" }}
        />
        <motion.div
          animate={{ x: [0, -40, 30, 0], y: [0, 30, -25, 0] }}
          transition={{ duration: 75, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] -left-32 w-[600px] h-[600px] rounded-full opacity-[0.2] dark:opacity-[0.16] blur-3xl"
          style={{ background: "radial-gradient(circle, #0F172A, transparent 70%)" }}
        />
        <motion.div
          animate={{ x: [0, 35, -45, 0], y: [0, 25, -30, 0] }}
          transition={{ duration: 50, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.18] dark:opacity-[0.14] blur-3xl"
          style={{ background: "radial-gradient(circle, #0EA5A4, transparent 70%)" }}
        />
      </div>

      <Navbar />

      {/* Hero */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 pt-20 md:pt-28 pb-16 md:pb-24 text-center"
      >
        {/* Backdrop: plus-sign lattice + breathing teal glow */}
        <div className="absolute inset-0 -z-10 med-cross [mask-image:radial-gradient(ellipse_65%_65%_at_50%_30%,black,transparent)]" />
        <div className="absolute left-1/2 top-24 -z-10 -translate-x-1/2">
          <motion.div
            animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            className="h-[420px] w-[620px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(14,165,164,0.32), transparent 70%)" }}
          />
        </div>
        {/* Scattered plus marks drifting at the hero's edges */}
        {[
          { style: { left: "8%", top: "18%" }, dur: 7 },
          { style: { right: "10%", top: "30%" }, dur: 8.5 },
          { style: { left: "16%", bottom: "22%" }, dur: 9.5 },
          { style: { right: "16%", bottom: "14%" }, dur: 7.8, sm: true },
          { style: { left: "45%", top: "8%" }, dur: 8.2, sm: true },
        ].map((p, i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            animate={{ y: [0, -9, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: p.dur, repeat: Infinity, ease: "easeInOut", delay: i * 0.7 }}
            className="plus-mark hidden md:block"
            style={p.style}
          />
        ))}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-[#0EA5A4]/25 text-[#0EA5A4] text-xs font-semibold tracking-wide shadow-[0_2px_12px_rgba(14,165,164,0.12)] mb-7"
        >
          <span className="relative w-1.5 h-1.5 rounded-full bg-[#0EA5A4] pulse-ring" />
          AI-POWERED HEALTH TRIAGE
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="font-display text-4xl md:text-6xl lg:text-[68px] font-extrabold tracking-tight leading-[1.05]"
        >
          Your intelligent guide to{" "}
          <span className="gradient-text animate-gradient">safer healthcare decisions.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          className="mt-6 text-lg md:text-xl text-[#64748B] dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed"
        >
          Describe your symptoms, share a photo, and get a clinically-grounded
          assessment - routed safely to self-care, a specialist, or emergency care.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          <button
            onClick={goToApp}
            className="group btn-sheen flex items-center gap-2.5 rounded-[12px] bg-[#0F172A] text-white px-7 py-3.5 text-sm font-semibold hover:bg-[#1E293B] transition-all shadow-[0_4px_16px_rgba(15,23,42,0.2),0_0_28px_rgba(14,165,164,0.22)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.25),0_0_40px_rgba(14,165,164,0.32)] hover:-translate-y-0.5"
          >
            Start Assessment
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-[12px] border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-white/[0.03] px-7 py-3.5 text-sm font-semibold text-[#0F172A] dark:text-white hover:bg-[#F8FAFC] dark:hover:bg-white/[0.06] hover:border-[#0EA5A4]/40 transition-all hover:-translate-y-0.5"
          >
            Learn How It Works
          </button>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-3 text-xs font-medium"
        >
          {[
            { icon: ShieldCheck, text: "Private by design", cls: "text-emerald-600 dark:text-emerald-400" },
            { icon: Activity, text: "Results in under a minute", cls: "text-[#0EA5A4]" },
            { icon: Heart, text: "Built with care", cls: "text-rose-500" },
          ].map((b) => (
            <div
              key={b.text}
              className="flex items-center gap-1.5 rounded-full bg-white/70 dark:bg-white/[0.04] backdrop-blur-md border border-[#E2E8F0]/80 dark:border-white/[0.07] px-3.5 py-1.5 text-[#64748B] dark:text-neutral-400 shadow-[0_1px_6px_rgba(15,23,42,0.05)]"
            >
              <b.icon size={13} className={b.cls} />
              <span>{b.text}</span>
            </div>
          ))}
        </motion.div>

        {/* Medical plus-marker accents flanking the hero */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="mt-14 flex items-center justify-center gap-6"
          aria-hidden="true"
        >
          <span className="plus-ring" />
          <span className="w-16 h-px bg-gradient-to-r from-transparent via-[#0EA5A4]/40 to-transparent" />
          <span className="plus-ring" />
        </motion.div>
      </motion.section>

      {/* Stats bar - lifted cards over a faint medical-cross lattice */}
      <section className="relative z-10 pb-16 md:pb-20">
        <div className="absolute inset-0 -z-10 med-cross opacity-70 [mask-image:radial-gradient(ellipse_70%_80%_at_50%_40%,black,transparent)]" />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className="flex flex-col items-center p-5 rounded-[12px] bg-white/60 dark:bg-white/[0.03] border border-[#E2E8F0]/60 dark:border-white/[0.06] backdrop-blur-sm"
            >
              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center mb-3 ${stat.tile}`}>
                <stat.icon size={16} />
              </div>
              <AnimatedCounter stat={stat} delay={0.1 + i * 0.08} />
              <span className="text-xs text-[#64748B] dark:text-neutral-400 mt-1">{stat.label}</span>
            </motion.div>
          ))}
        </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="eyebrow mb-4">The process</div>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">How it works</h2>
          <p className="text-[#64748B] dark:text-neutral-400 text-sm max-w-md mx-auto">
            Three simple steps to understand your symptoms and find the right care path.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: "01", title: "Describe your symptoms", desc: "Tell us what you're experiencing in your own words, or share a photo." },
            { step: "02", title: "Get a safe assessment", desc: "Our system checks for emergencies first, then reasons through your symptoms." },
            { step: "03", title: "Follow the right path", desc: "Self-care guidance, a specialist referral, or emergency direction - clearly explained." },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative text-center p-6 rounded-[14px] bg-white/50 dark:bg-white/[0.02] border border-[#E2E8F0]/50 dark:border-white/[0.04] hover:border-[#0EA5A4]/30 dark:hover:border-[#0EA5A4]/20 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-11 h-11 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#0EA5A4] to-[#06B6B4] text-white flex items-center justify-center text-sm font-bold shadow-[0_4px_14px_rgba(14,165,164,0.35)]">
                {i + 1}
              </div>
              <h3 className="font-display font-semibold text-lg text-[#0F172A] dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-[#64748B] dark:text-neutral-400 leading-relaxed">{item.desc}</p>
              {i < 2 && (
                <div className="hidden md:flex absolute top-1/2 -right-[13px] -translate-y-1/2 items-center">
                  <ChevronRight size={14} className="text-[#0EA5A4] drop-shadow-[0_0_6px_rgba(14,165,164,0.7)]" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Heading for features grid */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="eyebrow mb-4">Features</div>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">What you get</h2>
          <p className="text-[#64748B] dark:text-neutral-400 text-sm max-w-md mx-auto">
            Everything you need for safe, informed health decisions - all in one place.
          </p>
        </motion.div>
      </div>

      {/* Features grid - over the medical plus lattice */}
      <section className="relative z-10 pb-16 md:pb-24">
        <div className="absolute inset-0 -z-10 med-cross [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
        <div className="relative max-w-6xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
              }}
              className="group spotlight-card rounded-[14px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.06)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.1),0_12px_32px_rgba(15,23,42,0.1)] transition-shadow duration-300"
            >
              <div className={`w-11 h-11 rounded-[11px] flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 ${feature.tile}`}>
                <feature.icon size={18} />
              </div>
              <h3 className="font-display font-semibold text-base mb-2 dark:text-white">{feature.title}</h3>
              <p className="text-sm text-[#64748B] dark:text-neutral-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
        </div>
      </section>

      {/* Privacy & security */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
        <div className="gradient-border">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white dark:bg-[#151B2C] p-8 md:p-10 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.06)]"
        >
          <div className="text-center mb-8">
            <div className="eyebrow mb-4">Privacy first</div>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">Your health data stays yours</h2>
            <p className="text-[#64748B] dark:text-neutral-400 text-sm max-w-lg mx-auto">
              We designed Salus Care so that the safest health tool is also the most private one.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: Lock,
                title: "Encrypted in transit",
                desc: "Every request is authenticated and encrypted end-to-end via your secure sign-in.",
              },
              {
                icon: EyeOff,
                title: "Private by default",
                desc: "Your sessions are visible only to you. No sharing, no third-party analytics on your health data.",
              },
              {
                icon: Trash2,
                title: "You're in control",
                desc: "Keep only what helps you - sessions exist so follow-ups work, and nothing more.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-[12px] bg-[#F8FAFC] dark:bg-white/[0.03] border border-[#E2E8F0]/60 dark:border-white/[0.04] p-5"
              >
                <div className="w-10 h-10 rounded-[10px] bg-[#0EA5A4]/10 flex items-center justify-center mb-3">
                  <item.icon size={17} className="text-[#0EA5A4]" />
                </div>
                <h3 className="text-sm font-semibold text-[#0F172A] dark:text-white mb-1.5">{item.title}</h3>
                <p className="text-xs text-[#64748B] dark:text-neutral-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 pb-16 md:pb-24 text-center">
        <div className="gradient-border">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative bg-[#0F172A] px-6 md:px-10 py-12 md:py-16 overflow-hidden"
        >
          <div
            className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, #0EA5A4, transparent 70%)" }}
          />
          <div
            className="absolute bottom-0 left-0 w-[200px] h-[200px] rounded-full opacity-10 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, #0EA5A4, transparent 70%)" }}
          />

          <div className="relative z-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-3">
              Ready to understand your symptoms?
            </h2>
            <p className="text-[#94A3B8] mb-8 max-w-lg mx-auto leading-relaxed">
              Start a free assessment in under a minute. No waiting rooms, no guesswork.
            </p>
            <button
              onClick={goToApp}
              className="group btn-sheen inline-flex items-center gap-2 rounded-[12px] bg-[#0EA5A4] text-white px-7 py-3.5 text-sm font-semibold hover:bg-[#0C8E8D] transition-all hover:-translate-y-0.5 shadow-[0_0_24px_rgba(14,165,164,0.3)] hover:shadow-[0_0_36px_rgba(14,165,164,0.45)]"
            >
              Start Assessment
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </motion.div>
        </div>
      </section>

      <p className="relative z-10 text-xs text-center text-[#94A3B8] dark:text-neutral-600 px-6 pb-6 max-w-2xl mx-auto leading-relaxed">
        Salus Care provides educational health information only and is not a substitute for professional
        medical advice, diagnosis, or treatment. Do not submit highly sensitive personal or medical information.
      </p>
      <Footer />
    </div>
    </MotionConfig>
  );
}
