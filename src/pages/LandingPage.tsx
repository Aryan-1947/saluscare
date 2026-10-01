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
import { TierPreview } from "@/components/landing/TierPreview";
import { Faq } from "@/components/landing/Faq";
import { LandingBackground } from "@/components/landing/LandingBackground";
import { ScrollProgress } from "@/components/landing/ScrollProgress";
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
  ChevronLeft,
  Mic,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type FeatureTag = "Core" | "Capture" | "Trust";

const FEATURE_FILTERS: { key: "All" | FeatureTag; label: string }[] = [
  { key: "All", label: "All features" },
  { key: "Core", label: "Core triage" },
  { key: "Capture", label: "Symptom capture" },
  { key: "Trust", label: "Safety & privacy" },
];

const features: {
  icon: LucideIcon;
  title: string;
  description: string;
  tag: FeatureTag;
  tile: string;
}[] = [
  {
    icon: MessageSquareText,
    title: "AI Symptom Analysis",
    description:
      "Describe what you're feeling in your own words. Our system extracts structured symptom data and reasons through it like a triage nurse would.",
    tag: "Core",
    tile: "bg-[#FFF3EA] text-[#EA580C]",
  },
  {
    icon: ImagePlus,
    title: "Image Analysis",
    description:
      "Share a photo of a visible symptom - a rash, a cut, a reaction - and get an informed assessment combined with your description.",
    tag: "Capture",
    tile: "bg-[#FFF3EA] text-[#EA580C]",
  },
  {
    icon: History,
    title: "Follow-up Care",
    description:
      "Symptoms change. Come back anytime to report how you're doing, and we'll reassess against your prior visit, not start from scratch.",
    tag: "Core",
    tile: "bg-[#FFF3EA] text-[#EA580C]",
  },
  {
    icon: ShieldCheck,
    title: "Safety-First Approach",
    description:
      "Every response is grounded in structured medical guidance, never invented. Uncertain cases are escalated, not guessed at.",
    tag: "Trust",
    tile: "bg-[#FFF3EA] text-[#EA580C]",
  },
  {
    icon: Siren,
    title: "Emergency Routing",
    description:
      "Red-flag symptoms are detected before anything else runs - with one-tap emergency calling and the nearest hospital on the map, built right into the result.",
    tag: "Trust",
    tile: "bg-[#FFF3EA] text-[#EA580C]",
  },
  {
    icon: Mic,
    title: "Voice Input",
    description:
      "Too unwell to type? Dictate your symptoms instead. The mic lives right in the chat, and you can mix speaking and typing freely.",
    tag: "Capture",
    tile: "bg-[#FFF3EA] text-[#EA580C]",
  },
  {
    icon: FileText,
    title: "Doctor Visit Summary",
    description:
      "One click turns your whole conversation into a clean clinical handover note - timeline, escalation, and what was advised - ready to show a doctor.",
    tag: "Capture",
    tile: "bg-[#FFF3EA] text-[#EA580C]",
  },
  {
    icon: Stethoscope,
    title: "Specialist Referral",
    description:
      "When your symptoms call for professional care, we tell you exactly which specialist to see and why, with safe interim steps.",
    tag: "Core",
    tile: "bg-[#FFF3EA] text-[#EA580C]",
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
  { icon: Activity, value: 60, prefix: "<", suffix: "s", label: "Average assessment", tile: "bg-[#FFF3EA] text-[#EA580C]" },
  { icon: ClipboardCheck, value: 3, suffix: "-Tier", label: "Safety system", tile: "bg-[#FFF3EA] text-[#EA580C]" },
  { icon: Siren, value: null, staticValue: "24/7", label: "Emergency ready", tile: "bg-[#FFF3EA] text-[#EA580C]" },
  { icon: Heart, value: null, staticValue: "Free", label: "No cost, ever", tile: "bg-[#FFF3EA] text-[#EA580C]" },
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
      className="text-3xl md:text-4xl font-bold font-display text-[#EA580C]"
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
  // Hero fades and shrinks noticeably as it scrolls out - fully gone at 75%
  // of the scroll-out range so the effect is clearly visible.
  const heroOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.93]);

  const goToApp = () => navigate(isAuthenticated ? "/ask" : "/login");

  // Feature scroller: category filter + horizontal snap browsing. Eight
  // identical cards in a grid read as a wall; a scroller keeps each card
  // large and gives the section a natural end.
  const [filter, setFilter] = useState<"All" | FeatureTag>("All");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const shownFeatures = filter === "All" ? features : features.filter((f) => f.tag === filter);
  const scrollFeatures = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("article");
    const step = card ? card.offsetWidth + 20 : 360;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative min-h-screen bg-[#FAF7F2] dark:bg-[#191614] text-[#1A1613] dark:text-[#EDE8E2]">
      <LandingBackground />
      <ScrollProgress />
      <Navbar />

      {/* Hero */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 pt-20 md:pt-28 pb-16 md:pb-24 text-center"
      >
        {/* No backdrop ornament - the typography carries the hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[8px] bg-white dark:bg-[#26221E] border border-[#EA580C]/30 text-[#EA580C] text-xs font-semibold tracking-wide mb-7"
        >
          <span className="blink-dot w-1.5 h-1.5 rounded-full bg-[#EA580C]" />
          AI-POWERED HEALTH TRIAGE
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="font-display text-4xl md:text-6xl lg:text-[68px] font-extrabold tracking-tight leading-[1.05]"
        >
          Your intelligent guide to{" "}
          <span className="text-[#EA580C]">safer healthcare decisions.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          className="mt-6 text-lg md:text-xl text-[#57534E] dark:text-[#A8A29E] max-w-2xl mx-auto leading-relaxed"
        >
          Describe your symptoms, share a photo, and get a clinically-grounded
          assessment - routed safely to self-care, a specialist, or emergency care.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          <button
            onClick={goToApp}
            className="group flex items-center gap-2.5 rounded-[8px] bg-[#EA580C] text-white px-7 py-3.5 text-sm font-semibold hover:bg-[#C2410C] transition-colors shadow-[0_2px_8px_rgba(234,88,12,0.25)]"
          >
            Start Assessment
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-[8px] border border-[#E7E0D8] dark:border-[#322D28] bg-white dark:bg-[#26221E] px-7 py-3.5 text-sm font-semibold text-[#1A1613] dark:text-[#EDE8E2] hover:bg-[#F5F0E8] dark:hover:bg-white/[0.06] transition-colors"
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
            { icon: ShieldCheck, text: "Private by design", cls: "text-[#EA580C]" },
            { icon: Activity, text: "Results in under a second", cls: "text-[#EA580C]" },
            { icon: Heart, text: "Built with care", cls: "text-[#EA580C]" },
          ].map((b) => (
            <div
              key={b.text}
              className="flex items-center gap-1.5 rounded-[8px] bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] px-3.5 py-1.5 text-[#57534E] dark:text-[#A8A29E]"
            >
              <b.icon size={13} className={b.cls} />
              <span>{b.text}</span>
            </div>
          ))}
        </motion.div>

        {/* Soft divider under the hero */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="mt-14 flex items-center justify-center gap-6"
          aria-hidden="true"
        >
          <span className="w-24 h-px bg-[#E7E0D8] dark:bg-[#322D28]" />
        </motion.div>
      </motion.section>

      {/* Stats bar */}
      <section className="relative z-10 pb-16 md:pb-20">
        <div className="relative max-w-4xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className="flex flex-col items-center p-5 rounded-[10px] bg-white dark:bg-[#211D1A] border border-[#E7E0D8] dark:border-[#322D28]"
            >
              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center mb-3 ${stat.tile}`}>
                <stat.icon size={16} />
              </div>
              <AnimatedCounter stat={stat} delay={0.1 + i * 0.08} />
              <span className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">{stat.label}</span>
            </motion.div>
          ))}
        </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="eyebrow mb-4">The process</div>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">How it works</h2>
          <p className="text-[#57534E] dark:text-[#A8A29E] text-sm max-w-md mx-auto">
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
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative text-center p-6 rounded-[10px] bg-white dark:bg-[#211D1A] border border-[#E7E0D8] dark:border-[#322D28] hover:border-[#EA580C]/40 transition-colors duration-200"
            >
              <div className="w-11 h-11 mx-auto mb-4 rounded-[8px] bg-[#1A1613] dark:bg-[#EDE8E2] text-white dark:text-[#1A1613] flex items-center justify-center text-sm font-bold">
                {i + 1}
              </div>
              <h3 className="font-display font-semibold text-lg text-[#1A1613] dark:text-[#EDE8E2] mb-2">{item.title}</h3>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">{item.desc}</p>
              {i < 2 && (
                <div className="hidden md:flex absolute top-1/2 -right-[13px] -translate-y-1/2 items-center">
                  <ChevronRight size={14} className="text-[#EA580C]" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Care-routing preview */}
      <TierPreview />

      {/* Heading for features grid */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="eyebrow mb-4">Features</div>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">What you get</h2>
          <p className="text-[#57534E] dark:text-[#A8A29E] text-sm max-w-md mx-auto">
            Everything you need for safe, informed health decisions - all in one place.
          </p>
        </motion.div>
      </div>

      {/* Features: category filter + horizontal snap scroller */}
      <section className="relative z-10 pb-16 md:pb-24">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          {/* Filter chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {FEATURE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-[8px] px-4 py-2 text-xs font-semibold border transition-colors ${
                  filter === f.key
                    ? "bg-[#1A1613] dark:bg-[#EDE8E2] text-white dark:text-[#1A1613] border-[#1A1613] dark:border-[#EDE8E2]"
                    : "bg-white dark:bg-[#26221E] text-[#57534E] dark:text-[#A8A29E] border-[#E7E0D8] dark:border-[#322D28] hover:border-[#EA580C]/40 hover:text-[#EA580C]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Scroller */}
          <div className="relative">
            <div
              ref={scrollerRef}
              className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 pt-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {shownFeatures.map((feature, i) => (
                <motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: Math.min(i * 0.06, 0.3) }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="group shrink-0 w-[80%] sm:w-[46%] lg:w-[31.5%] snap-start rounded-[10px] bg-white dark:bg-[#211D1A] border border-[#E7E0D8] dark:border-[#322D28] p-6 shadow-[0_1px_2px_rgba(26,22,19,0.05)] hover:shadow-[0_4px_12px_rgba(26,22,19,0.09)] hover:border-[#EA580C]/30 transition-all duration-200 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-[8px] flex items-center justify-center ${feature.tile}`}>
                      <feature.icon size={18} />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A8A29E] dark:text-[#78716C]">
                      {FEATURE_FILTERS.find((f) => f.key === feature.tag)?.label}
                    </span>
                  </div>
                  <h3 className="font-display font-semibold text-base mb-2 text-[#1A1613] dark:text-[#EDE8E2]">{feature.title}</h3>
                  <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                    {feature.description}
                  </p>
                </motion.article>
              ))}
            </div>

            {/* Edge fades hint at more content off-screen */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#FAF7F2] to-transparent dark:from-[#191614] hidden md:block" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#FAF7F2] to-transparent dark:from-[#191614] hidden md:block" />

            {/* Arrows */}
            <button
              onClick={() => scrollFeatures(-1)}
              aria-label="Scroll features back"
              className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] shadow-[0_2px_8px_rgba(26,22,19,0.10)] text-[#57534E] dark:text-[#A8A29E] hover:text-[#EA580C] hover:border-[#EA580C]/40 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scrollFeatures(1)}
              aria-label="Scroll features forward"
              className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] shadow-[0_2px_8px_rgba(26,22,19,0.10)] text-[#57534E] dark:text-[#A8A29E] hover:text-[#EA580C] hover:border-[#EA580C]/40 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Privacy & security */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white dark:bg-[#211D1A] p-8 md:p-10 border border-[#E7E0D8] dark:border-[#322D28] rounded-[12px]"
        >
          <div className="text-center mb-8">
            <div className="eyebrow mb-4">Privacy first</div>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">Your health data stays yours</h2>
            <p className="text-[#57534E] dark:text-[#A8A29E] text-sm max-w-lg mx-auto">
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
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-[10px] bg-[#F5F0E8] dark:bg-white/[0.04] border border-[#E7E0D8]/70 dark:border-[#322D28] p-5"
              >
                <div className="w-10 h-10 rounded-[8px] bg-[#FFF3EA] dark:bg-[#EA580C]/10 flex items-center justify-center mb-3">
                  <item.icon size={17} className="text-[#EA580C]" />
                </div>
                <h3 className="text-sm font-semibold text-[#1A1613] dark:text-[#EDE8E2] mb-1.5">{item.title}</h3>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <Faq />

      {/* Footer CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 pb-16 md:pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative bg-white dark:bg-[#211D1A] px-6 md:px-10 py-12 md:py-16 overflow-hidden rounded-[12px] border border-[#E7E0D8] dark:border-[#322D28] shadow-[0_1px_2px_rgba(26,22,19,0.05)]"
        >
          <div className="relative z-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-[#1A1613] dark:text-[#FAF7F2] mb-3">
              Ready to understand your symptoms?
            </h2>
            <p className="text-[#57534E] dark:text-[#A8A29E] mb-8 max-w-lg mx-auto leading-relaxed">
              Start a free assessment in under a minute. No waiting rooms, no guesswork.
            </p>
            <button
              onClick={goToApp}
              className="group inline-flex items-center gap-2 rounded-[8px] bg-[#EA580C] text-white px-7 py-3.5 text-sm font-semibold hover:bg-[#C2410C] transition-colors"
            >
              Start Assessment
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
    </MotionConfig>
  );
}
