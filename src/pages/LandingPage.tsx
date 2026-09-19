import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
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
  Zap,
  Clock,
  Heart,
  ChevronDown,
  Lock,
  EyeOff,
  Trash2,
  Quote,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const features = [
  {
    icon: MessageSquareText,
    title: "AI Symptom Analysis",
    description:
      "Describe what you're feeling in your own words. Our system extracts structured symptom data and reasons through it like a triage nurse would.",
  },
  {
    icon: ImagePlus,
    title: "Image Analysis",
    description:
      "Share a photo of a visible symptom — a rash, a cut, a reaction — and get an informed assessment combined with your description.",
  },
  {
    icon: History,
    title: "Follow-up Care",
    description:
      "Symptoms change. Come back anytime to report how you're doing, and we'll reassess against your prior visit, not start from scratch.",
  },
  {
    icon: ShieldCheck,
    title: "Safety-First Approach",
    description:
      "Every response is grounded in structured medical guidance, never invented. Uncertain cases are escalated, not guessed at.",
  },
  {
    icon: Siren,
    title: "Emergency Routing",
    description:
      "Red-flag symptoms are detected before anything else runs, routing you to emergency guidance immediately, no delay.",
  },
  {
    icon: Stethoscope,
    title: "Specialist Referral",
    description:
      "When your symptoms call for professional care, we tell you exactly which specialist to see and why, with safe interim steps.",
  },
];

type Stat = {
  icon: LucideIcon;
  value: number | null; // null = render static text instead of counting up
  prefix?: string;
  suffix?: string;
  staticValue?: string;
  label: string;
};

const stats: Stat[] = [
  { icon: Zap, value: 60, prefix: "<", suffix: "s", label: "Assessment Time" },
  { icon: ShieldCheck, value: 3, suffix: "-Tier", label: "Safety System" },
  { icon: Clock, value: 24, suffix: "/7", label: "Always Available" },
  { icon: Heart, value: null, staticValue: "Free", label: "No Cost" },
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

const faqs = [
  {
    q: "Is Salus Care a replacement for a doctor?",
    a: "No. Salus Care provides educational health information to help you understand your symptoms and choose a safe next step. It never diagnoses, prescribes, or replaces professional medical care.",
  },
  {
    q: "How does the triage actually work?",
    a: "Your description (and photo, if you add one) is checked against emergency red-flag patterns first. If nothing urgent matches, the system extracts structured symptom data and reasons through it like a triage nurse would, mapping you to self-care guidance or a specialist referral.",
  },
  {
    q: "What happens if my symptoms are serious?",
    a: "Red-flag symptoms are detected before anything else runs. You're shown emergency guidance immediately — the assessment ends there and directs you to seek immediate care.",
  },
  {
    q: "Do you store my conversations?",
    a: "Sessions are kept so you can follow up and review your history, and they're visible only to you. We still recommend not submitting highly sensitive personal or medical information.",
  },
  {
    q: "Can I describe symptoms with a photo?",
    a: "Yes — attach a photo of a visible symptom like a rash, cut, or reaction. It's analysed together with your written description, and you may be asked a clarifying question first.",
  },
  {
    q: "Is it really free?",
    a: "Yes. Salus Care is free to use, with no account fees or paywalled features.",
  },
];

const testimonials = [
  {
    quote: "I described symptoms late at night and got clear, calm guidance in under a minute. It told me exactly what to watch for overnight.",
    name: "Priya S.",
    role: "Parent of two",
  },
  {
    quote: "The follow-up feature is what sets it apart. I reported how I was feeling two days later and it reassessed instead of starting over.",
    name: "Marcus T.",
    role: "Marathon runner",
  },
  {
    quote: "It didn't guess. It asked me two sensible questions, then recommended the right specialist and what to do while I waited.",
    name: "Elena R.",
    role: "Graduate student",
  },
];

function FaqItem({ faq, open, onToggle }: { faq: (typeof faqs)[number]; open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-[12px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-[#0F172A] dark:text-white">{faq.q}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
          <ChevronDown size={16} className="text-[#64748B] dark:text-neutral-400" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <p className="px-5 pb-4 text-sm text-[#64748B] dark:text-neutral-400 leading-relaxed">{faq.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();
  const heroRef = useRef<HTMLDivElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);

  const goToApp = () => navigate(isAuthenticated ? "/ask" : "/login");

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-[#0F172A] dark:text-white transition-colors">
      {/* Ambient background — gradient mesh, ultra-slow drift */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 50, -30, 0], y: [0, -40, 25, 0] }}
          transition={{ duration: 60, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -right-20 w-[700px] h-[700px] rounded-full opacity-[0.18] dark:opacity-[0.22] blur-3xl"
          style={{ background: "radial-gradient(circle, #0EA5A4, transparent 70%)" }}
        />
        <motion.div
          animate={{ x: [0, -40, 30, 0], y: [0, 30, -25, 0] }}
          transition={{ duration: 75, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] -left-32 w-[600px] h-[600px] rounded-full opacity-[0.12] dark:opacity-[0.16] blur-3xl"
          style={{ background: "radial-gradient(circle, #0F172A, transparent 70%)" }}
        />
        <motion.div
          animate={{ x: [0, 35, -45, 0], y: [0, 25, -30, 0] }}
          transition={{ duration: 50, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.1] dark:opacity-[0.14] blur-3xl"
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
        {/* Backdrop: faint dot grid + breathing teal glow */}
        <div className="absolute inset-0 -z-10 bg-dots opacity-60 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_35%,black,transparent)]" />
        <div className="absolute left-1/2 top-24 -z-10 -translate-x-1/2">
          <motion.div
            animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            className="h-[420px] w-[620px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(14,165,164,0.2), transparent 70%)" }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0EA5A4]/10 border border-[#0EA5A4]/20 text-[#0EA5A4] text-xs font-medium mb-6"
        >
          <span className="relative w-1.5 h-1.5 rounded-full bg-[#0EA5A4] pulse-ring" />
          AI-Powered Health Triage
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]"
        >
          Your intelligent guide to{" "}
          <span className="gradient-text animate-gradient">safer healthcare decisions.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          className="mt-6 text-lg md:text-xl text-[#64748B] max-w-2xl mx-auto leading-relaxed"
        >
          Describe your symptoms, share a photo, and get a clinically-grounded
          assessment — routed safely to self-care, a specialist, or emergency care.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          <button
            onClick={goToApp}
            className="group flex items-center gap-2.5 rounded-[12px] bg-[#0F172A] text-white px-7 py-3.5 text-sm font-semibold hover:bg-[#1E293B] transition-all shadow-[0_4px_16px_rgba(15,23,42,0.2),0_0_28px_rgba(14,165,164,0.22)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.25),0_0_40px_rgba(14,165,164,0.32)] hover:-translate-y-0.5"
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
          className="mt-12 flex flex-wrap items-center justify-center gap-4 md:gap-6 text-xs text-[#94A3B8] dark:text-neutral-500"
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#059669]" />
            <span>HIPAA-Inspired Privacy</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-[#E2E8F0] dark:bg-neutral-700 hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-[#0EA5A4]" />
            <span>Instant Results</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-[#E2E8F0] dark:bg-neutral-700 hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <Heart size={14} className="text-[#DC2626]" />
            <span>Built with Care</span>
          </div>
        </motion.div>
      </motion.section>

      {/* Stats bar */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 pb-16 md:pb-20">
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
              <div className="w-9 h-9 rounded-[10px] bg-[#0EA5A4]/10 flex items-center justify-center mb-3">
                <stat.icon size={16} className="text-[#0EA5A4]" />
              </div>
              <AnimatedCounter stat={stat} delay={0.1 + i * 0.08} />
              <span className="text-xs text-[#64748B] dark:text-neutral-400 mt-1">{stat.label}</span>
            </motion.div>
          ))}
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
          <h2 className="text-2xl md:text-3xl font-bold mb-3">How it works</h2>
          <p className="text-[#64748B] dark:text-neutral-400 text-sm max-w-md mx-auto">
            Three simple steps to understand your symptoms and find the right care path.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: "01", title: "Describe your symptoms", desc: "Tell us what you're experiencing in your own words, or share a photo." },
            { step: "02", title: "Get a safe assessment", desc: "Our system checks for emergencies first, then reasons through your symptoms." },
            { step: "03", title: "Follow the right path", desc: "Self-care guidance, a specialist referral, or emergency direction — clearly explained." },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative text-center p-6 rounded-[14px] bg-white/50 dark:bg-white/[0.02] border border-[#E2E8F0]/50 dark:border-white/[0.04] hover:border-[#0EA5A4]/30 dark:hover:border-[#0EA5A4]/20 transition-all duration-300"
            >
              <div className="text-4xl font-bold text-[#0EA5A4]/20 dark:text-[#0EA5A4]/15 mb-3">{item.step}</div>
              <h3 className="font-semibold text-lg text-[#0F172A] dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-[#64748B] dark:text-neutral-400 leading-relaxed">{item.desc}</p>
              {i < 2 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-[#E2E8F0] dark:bg-white/10" />
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
          <h2 className="text-2xl md:text-3xl font-bold mb-3">What you get</h2>
          <p className="text-[#64748B] dark:text-neutral-400 text-sm max-w-md mx-auto">
            Everything you need for safe, informed health decisions — all in one place.
          </p>
        </motion.div>
      </div>

      {/* Features grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
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
              <div className="w-11 h-11 rounded-[11px] bg-[#0EA5A4]/10 group-hover:bg-[#0EA5A4]/15 flex items-center justify-center mb-4 transition-colors duration-300">
                <feature.icon size={18} className="text-[#0EA5A4]" />
              </div>
              <h3 className="font-semibold text-base mb-2 dark:text-white">{feature.title}</h3>
              <p className="text-sm text-[#64748B] dark:text-neutral-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">People rely on it when it matters</h2>
          <p className="text-[#64748B] dark:text-neutral-400 text-sm max-w-md mx-auto">
            Real moments where a fast, calm second opinion made the difference.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
              }}
              className="spotlight-card rounded-[14px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] p-6 flex flex-col shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.06)]"
            >
              <Quote size={18} className="text-[#0EA5A4]/60 mb-3" />
              <blockquote className="text-sm text-[#0F172A] dark:text-neutral-200 leading-relaxed flex-1">
                "{t.quote}"
              </blockquote>
              <figcaption className="mt-5 pt-4 border-t border-[#E2E8F0] dark:border-white/[0.06] flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0F172A] dark:text-white">{t.name}</p>
                  <p className="text-xs text-[#64748B] dark:text-neutral-500">{t.role}</p>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, s) => (
                    <Star key={s} size={12} className="fill-[#F59E0B] text-[#F59E0B]" />
                  ))}
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      {/* Privacy & security */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[16px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] p-8 md:p-10 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.06)]"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium mb-4">
              <ShieldCheck size={13} />
              Privacy First
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Your health data stays yours</h2>
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
                desc: "Keep only what helps you — sessions exist so follow-ups work, and nothing more.",
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
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Frequently asked questions</h2>
          <p className="text-[#64748B] dark:text-neutral-400 text-sm max-w-md mx-auto">
            Everything you might be wondering about, answered plainly.
          </p>
        </motion.div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <FaqItem
              key={faq.q}
              faq={faq}
              open={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            />
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 pb-16 md:pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-[16px] bg-[#0F172A] px-6 md:px-10 py-12 md:py-16 overflow-hidden"
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
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Ready to understand your symptoms?
            </h2>
            <p className="text-[#94A3B8] mb-8 max-w-lg mx-auto leading-relaxed">
              Start a free assessment in under a minute. No waiting rooms, no guesswork.
            </p>
            <button
              onClick={goToApp}
              className="group inline-flex items-center gap-2 rounded-[12px] bg-[#0EA5A4] text-white px-7 py-3.5 text-sm font-semibold hover:bg-[#0C8E8D] transition-all hover:-translate-y-0.5 shadow-[0_0_24px_rgba(14,165,164,0.3)] hover:shadow-[0_0_36px_rgba(14,165,164,0.45)]"
            >
              Start Assessment
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </motion.div>
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
