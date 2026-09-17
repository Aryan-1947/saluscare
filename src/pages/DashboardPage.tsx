import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import {
  MessageSquarePlus,
  RefreshCcw,
  ImagePlus,
  History,
  Activity,
  Clock,
  CalendarCheck,
  ArrowRight,
} from "lucide-react";
import { getLoggedSessions } from "@/lib/sessionLog";
import { useApi } from "@/hooks/useApi";
import type { FollowupSummary } from "@/types/api";

const actionCards = [
  {
    icon: MessageSquarePlus,
    title: "Start New Assessment",
    description: "Describe your symptoms and get a clinical assessment",
    to: "/ask",
    accent: "#0EA5A4",
  },
  {
    icon: RefreshCcw,
    title: "Continue Follow-up",
    description: "Report how you're feeling since your last visit",
    to: "/sessions",
    accent: "#D97706",
  },
  {
    icon: ImagePlus,
    title: "Upload Symptom Image",
    description: "Share a photo of a visible symptom for analysis",
    to: "/ask",
    accent: "#0EA5A4",
  },
  {
    icon: History,
    title: "Previous Sessions",
    description: "Review your assessment history and outcomes",
    to: "/sessions",
    accent: "#64748B",
  },
];export function DashboardPage() {
  const { user } = useAuth0();
  const { getFollowups } = useApi();
  const navigate = useNavigate();

  const [openFollowups, setOpenFollowups] = useState<FollowupSummary[]>([]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Locally-logged sessions drive the total/last-assessment metrics (React
  // Compiler memoizes automatically — no manual useMemo needed here).
  const sessions = user?.sub ? getLoggedSessions(user.sub) : [];
  const recent = sessions[0]; // stored most-recent-first

  // Active Follow-ups comes from the backend: sessions still awaiting a
  // follow-up, per the verified user — not a localStorage guess.
  useEffect(() => {
    let cancelled = false;
    getFollowups()
      .then((res) => {
        if (!cancelled) setOpenFollowups(res.followups ?? []);
      })
      .catch(() => {
        // Metric silently degrades to 0; the dashboard stays usable.
      });
    return () => {
      cancelled = true;
    };
  }, [getFollowups]);

  const total = sessions.length;
  const lastLabel = recent
    ? new Date(recent.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "—";

  const metrics = [
    { icon: Activity, label: "Total Assessments", value: total > 0 ? String(total) : "0" },
    {
      icon: Clock,
      label: "Active Follow-ups",
      value: String(openFollowups.length),
    },
    { icon: CalendarCheck, label: "Last Consultation", value: lastLabel },
  ];

  // "Continue where you left off": prefer an assessment that's actually still
  // open (a follow-up waiting on the user), else the most recent one.
  const continueTarget = openFollowups[0]
    ? {
        sessionId: openFollowups[0].sessionId,
        label: "Follow-up waiting",
        dateLabel: new Date(openFollowups[0].createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      }
    : recent
      ? {
          sessionId: recent.sessionId,
          label: "Last assessment",
          dateLabel: new Date(recent.startedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
        }
      : null;

  return (
    <div className="px-4 md:px-10 py-6 md:py-8 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-xl md:text-2xl font-semibold text-[#0F172A] dark:text-white">
          {greeting}, {user?.given_name}.
        </h1>
        <p className="text-[#64748B] dark:text-neutral-400 mt-1">Here's an overview of your health assessments.</p>
      </motion.div>

      {/* Metrics (top) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {metrics.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}
            className="rounded-[12px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] p-5 flex items-center gap-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.06)]"
          >
            <div className="w-10 h-10 rounded-[10px] bg-[#F8FAFC] dark:bg-white/[0.05] flex items-center justify-center shrink-0">
              <metric.icon size={18} className="text-[#0EA5A4]" />
            </div>
            <div>
              <p className="text-xs text-[#64748B] dark:text-neutral-400">{metric.label}</p>
              <p className="text-lg font-semibold text-[#0F172A] dark:text-white">{metric.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent session shortcut */}
      {continueTarget && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          onClick={() => navigate(`/sessions/${continueTarget.sessionId}`)}
          className="mt-4 w-full rounded-[12px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] p-4 flex items-center justify-between text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)] transition-shadow group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#0EA5A4]/10 flex items-center justify-center shrink-0">
              <History size={16} className="text-[#0EA5A4]" />
            </div>
            <div>
              <p className="text-xs text-[#64748B] dark:text-neutral-400">Continue where you left off</p>
              <p className="text-sm font-medium text-[#0F172A] dark:text-white">
                {continueTarget.label} · {continueTarget.dateLabel}
              </p>
            </div>
          </div>
          <ArrowRight size={16} className="text-[#94A3B8] group-hover:translate-x-0.5 transition-transform" />
        </motion.button>
      )}

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {actionCards.map((card, i) => (
          <motion.button
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            whileHover={{ y: -2 }}
            onClick={() => navigate(card.to)}
            className="text-left rounded-[12px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.06)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.08),0_12px_32px_rgba(15,23,42,0.08)] transition-shadow"
          >
            <div
              className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-3"
              style={{ backgroundColor: `${card.accent}1A` }}
            >
              <card.icon size={18} style={{ color: card.accent }} />
            </div>
            <h3 className="font-semibold text-[#0F172A] dark:text-white text-sm mb-1">{card.title}</h3>
            <p className="text-xs text-[#64748B] dark:text-neutral-400 leading-relaxed">{card.description}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}