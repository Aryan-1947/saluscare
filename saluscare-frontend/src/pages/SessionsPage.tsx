import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { Clock, ChevronRight, Inbox, Search, ShieldCheck, Stethoscope, Siren } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { getLoggedSessions } from "@/lib/sessionLog";
import { cn } from "@/lib/utils";
import type { SessionSummary } from "@/types/api";

const tierLabel: Record<number, { label: string; color: string; tile: string; stripe: string; icon: LucideIcon }> = {
  1: {
    label: "Self Care",
    color: "text-[#15803D] dark:text-[#4ADE80]",
    tile: "bg-[#F0FDF4] dark:bg-[#15803D]/10 text-[#15803D] dark:text-[#4ADE80]",
    stripe: "bg-[#15803D]/70",
    icon: ShieldCheck,
  },
  2: {
    label: "Specialist Referral",
    color: "text-[#B45309] dark:text-[#FBBF24]",
    tile: "bg-[#FFFBEB] dark:bg-[#B45309]/10 text-[#B45309] dark:text-[#FBBF24]",
    stripe: "bg-[#B45309]/70",
    icon: Stethoscope,
  },
  3: {
    label: "Emergency Care",
    color: "text-[#DC2626] dark:text-[#F87171]",
    tile: "bg-[#FEF2F2] dark:bg-[#DC2626]/10 text-[#DC2626] dark:text-[#F87171]",
    stripe: "bg-[#DC2626]/70",
    icon: Siren,
  },
};

const tierFilters = [
  { value: "all", label: "All", icon: null, activeClass: "bg-[#1A1613] dark:bg-[#EDE8E2] dark:text-[#1A1613] text-white" },
  { value: "1", label: "Self Care", icon: ShieldCheck, activeClass: "bg-[#15803D] text-white" },
  { value: "2", label: "Specialist", icon: Stethoscope, activeClass: "bg-[#B45309] text-white" },
  { value: "3", label: "Emergency", icon: Siren, activeClass: "bg-[#DC2626] text-white" },
] as const;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (Number.isNaN(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

type SessionRow = SessionSummary & { startedAt: string };

export function SessionsPage() {
  const { user } = useAuth0();
  const { getSummaries } = useApi();
  const navigate = useNavigate();

  const [rows, setRows] = useState<SessionRow[]>([]);
  // Lazy init: if there are no logged sessions at mount, skip the loading
  // state entirely (nothing to fetch - show the empty state immediately).
  const [loading, setLoading] = useState(() => {
    const stored = localStorage.getItem(`salus-sessions:${user?.sub ?? ""}`);
    const parsed = stored ? (JSON.parse(stored) as unknown[]) : [];
    return parsed.length > 0;
  });
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const filteredRows = useMemo(() => {
    return rows.filter((s) => {
      if (tierFilter !== "all" && String(s.tier) !== tierFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!s.complaintText.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, tierFilter]);

  useEffect(() => {
    if (!user?.sub) return;

    const logged = getLoggedSessions(user.sub);
    if (logged.length === 0) return;

    let cancelled = false;

    // ONE batched request for all logged roots (previously one history call
    // per session - N+1, each pulling full turns + re-signing image URLs,
    // which made the list render progressively over seconds).
    getSummaries(logged.map((s) => s.sessionId))
      .then((res) => {
        if (cancelled) return;
        const byId = new Map((res.summaries ?? []).map((s) => [s.sessionId, s]));
        const next: SessionRow[] = logged.map((l) => {
          const s = byId.get(l.sessionId);
          return {
            sessionId: l.sessionId,
            // Session unknown to the backend (or empty): fall back to the
            // locally logged start time so the row still renders.
            complaintText: s?.complaintText ?? "Assessment",
            tier: s?.tier ?? 1,
            lastActivityAt: s?.lastActivityAt ?? l.startedAt,
            startedAt: l.startedAt,
          };
        });
        setRows(next.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()));
      })
      .catch(() => {
        // Silently degrade to the empty state; a retry happens on next mount.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.sub, getSummaries]);

  return (
    <div className="px-4 md:px-8 py-8 md:py-12 max-w-3xl mx-auto">
      <h1 className="font-display text-2xl font-bold tracking-tight text-[#1A1613] dark:text-[#EDE8E2] mb-1">Session History</h1>
      <p className="text-sm text-[#57534E] dark:text-[#A8A29E] mb-6 leading-relaxed">
        Review past assessments and continue any of them.
      </p>

      {/* Search + tier filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assessments..."
            className="w-full rounded-[8px] bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] pl-9 pr-3 py-2.5 text-sm text-[#1A1613] dark:text-[#EDE8E2] placeholder:text-[#A8A29E] dark:placeholder:text-[#78716C] outline-none focus:border-[#EA580C]/50 focus:ring-2 focus:ring-[#EA580C]/10 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {tierFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setTierFilter(f.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-[8px] px-3.5 py-2 text-xs font-medium transition-colors",
                tierFilter === f.value
                  ? f.activeClass
                  : "bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] text-[#57534E] dark:text-[#A8A29E] hover:border-[#EA580C]/40 hover:text-[#1A1613] dark:hover:text-[#EDE8E2]"
              )}
            >
              {f.icon && <f.icon size={12} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-[10px] shimmer-skeleton dark:bg-white/[0.03]" />
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-[10px] bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] flex items-center justify-center mx-auto mb-3">
            <Inbox size={22} className="text-[#A8A29E] dark:text-[#78716C]" />
          </div>
          <p className="text-[#57534E] dark:text-[#A8A29E] mb-4">No assessments yet.</p>
          <button
            onClick={() => navigate("/ask")}
            className="rounded-[8px] bg-[#EA580C] hover:bg-[#C2410C] text-white px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            Start an Assessment
          </button>
        </div>
      )}

      {!loading && rows.length > 0 && filteredRows.length === 0 && (
        <div className="text-center py-14">
          <Search size={28} className="mx-auto text-[#A8A29E] dark:text-[#78716C] mb-3" />
          <p className="text-sm text-[#57534E] dark:text-[#A8A29E]">No sessions match your search or filter.</p>
          <button
            onClick={() => {
              setQuery("");
              setTierFilter("all");
            }}
            className="mt-3 text-xs font-medium text-[#EA580C] hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
        {filteredRows.map((s, i) => {
          const config = tierLabel[s.tier] ?? tierLabel[1];
          return (
            <motion.button
              key={s.sessionId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              onClick={() => navigate(`/sessions/${s.sessionId}`)}
              className="relative overflow-hidden text-left rounded-[10px] bg-white dark:bg-[#211D1A] border border-[#E7E0D8] dark:border-[#322D28] p-4 pl-5 flex items-center gap-3.5 hover:border-[#EA580C]/40 hover:shadow-[0_4px_12px_rgba(26,22,19,0.08)] transition-colors duration-200"
            >
              {/* Tier accent stripe */}
              <span aria-hidden="true" className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${config.stripe}`} />
              <div
                aria-hidden="true"
                className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${config.tile}`}
              >
                <config.icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#1A1613] dark:text-[#EDE8E2] line-clamp-1">
                  {s.complaintText}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className={`text-xs font-medium ${config.label ? config.color : ""}`}>
                    {config.label}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-[#57534E] dark:text-[#78716C]">
                    <Clock size={11} />
                    {timeAgo(s.lastActivityAt)}
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-[#A8A29E] shrink-0" />
            </motion.button>
          );
        })}
        </AnimatePresence>
      </div>

      {rows.length > 0 && (
        <p className="text-xs text-[#A8A29E] dark:text-[#78716C] text-center mt-6">
          {filteredRows.length} of {rows.length} assessment{rows.length === 1 ? "" : "s"} shown
        </p>
      )}
    </div>
  );
}
