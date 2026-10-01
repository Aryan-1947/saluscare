import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Download, Stethoscope, AlertTriangle } from "lucide-react";
import { CopyButton } from "@/components/ask/CopyButton";
import type { DoctorSummaryResponse } from "@/types/api";
import { downloadDoctorSummaryPdf } from "@/lib/doctorSummaryPdf";

/** Lightweight Markdown rendering: headings, bullets, plain paragraphs - the
 * subset the summary prompt produces. Nothing else is supported on purpose. */
function renderMarkdown(md: string): { type: "h2" | "li" | "p"; text: string }[] {
  return md
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("## ")) return { type: "h2" as const, text: line.slice(3) };
      if (line.startsWith("- ") || line.startsWith("* ")) return { type: "li" as const, text: line.slice(2) };
      return { type: "p" as const, text: line };
    });
}

/** Inline Markdown subset: **bold**, *italic*, `code` - everything the
 * summary prompt may sprinkle inside a line. Text outside matches passes
 * through verbatim. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  const keys = { n: 0 };
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong
          key={keys.n++}
          className="font-semibold text-[#1A1613] dark:text-[#EDE8E2]"
        >
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={keys.n++}
          className="px-1 py-0.5 rounded bg-[#F5F0E8] dark:bg-white/[0.06] text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(
        <em key={keys.n++} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function MarkdownNote({ md }: { md: string }) {
  const blocks = renderMarkdown(md);
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((b, i) => {
        if (b.type === "h2") {
          return (
            <h3
              key={i}
              className="text-xs font-semibold uppercase tracking-[0.14em] text-[#EA580C] pt-3 first:pt-0"
            >
              {renderInline(b.text)}
            </h3>
          );
        }
        if (b.type === "li") {
          return (
            <div key={i} className="flex gap-2 text-sm text-[#1A1613] dark:text-[#EDE8E2] leading-relaxed">
              <span aria-hidden="true" className="mt-[9px] w-1 h-1 rounded-full bg-[#A8A29E] shrink-0" />
              <span>{renderInline(b.text)}</span>
            </div>
          );
        }
        return (            <p key={i} className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
              {renderInline(b.text)}
            </p>
        );
      })}
    </div>
  );
}



type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; summary: DoctorSummaryResponse };

/**
 * Doctor-visit summary modal. The page passes `fetchSummary` (so the Auth0
 * token handling stays in the page's useApi hook); the modal owns loading,
 * error and display states. Fetches once per open, on mount.
 */
export function DoctorSummaryModal({
  sessionId,
  fetchSummary,
  onClose,
}: {
  sessionId: string;
  fetchSummary: () => Promise<DoctorSummaryResponse>;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>({ phase: "loading" });
  // Latest-callback ref so the fetch runs exactly once per open even if the
  // caller passes an unstable inline arrow (AskPage does).
  const fetchRef = useRef(fetchSummary);
  useEffect(() => {
    fetchRef.current = fetchSummary;
  }, [fetchSummary]);

  useEffect(() => {
    let cancelled = false;

    // Hard client-side timeout: the edge function normally answers in
    // seconds; beyond this the user gets an actionable error, not a spinner.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The summary took too long to generate. Please close and try again.")), 60_000)
    );

    Promise.race([fetchRef.current(), timeout])
      .then((summary) => {
        if (!cancelled) setState({ phase: "ready", summary });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            phase: "error",
            message:
              err instanceof Error ? err.message : "Could not generate the summary. Please try again.",
          });
        }
      });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKey);
    };
    // Intentionally run-once: identity churn is handled via fetchRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#1A1613]/50 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-[#211D1A] border border-[#E7E0D8] dark:border-[#322D28] rounded-[12px] shadow-[0_12px_32px_rgba(26,22,19,0.18)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#E7E0D8] dark:border-[#322D28]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[8px] bg-[#FFF3EA] dark:bg-[#EA580C]/10 flex items-center justify-center shrink-0">
                <Stethoscope size={17} className="text-[#EA580C]" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display font-semibold text-[15px] text-[#1A1613] dark:text-[#EDE8E2] truncate">
                  Doctor visit summary
                </h2>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] truncate">
                  Clinical handover note - written from this conversation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close summary"
              className="p-2 rounded-[8px] text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F5F0E8] dark:hover:bg-white/[0.06] transition-colors"
            >
              <X size={17} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            {state.phase === "loading" && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#57534E] dark:text-[#A8A29E]">
                <Loader2 size={22} className="animate-spin text-[#EA580C]" />
                <p className="text-sm">Writing the clinical summary...</p>
              </div>
            )}

            {state.phase === "error" && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <AlertTriangle size={22} className="text-[#DC2626]" />
                <p className="text-sm text-[#1A1613] dark:text-[#EDE8E2]">{state.message}</p>
                <button
                  onClick={onClose}
                  className="rounded-[8px] bg-[#EA580C] hover:bg-[#C2410C] text-white px-4 py-2 text-sm font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {state.phase === "ready" && (
              <>
                <MarkdownNote md={state.summary.narrative} />
                <p className="text-[11px] text-[#A8A29E] dark:text-[#78716C] leading-relaxed mt-5 pt-3 border-t border-[#E7E0D8] dark:border-[#322D28]">
                  Generated by SalusCare from the patient's own chat transcript on{" "}
                  {new Date(state.summary.generatedAt).toLocaleString()}. Informational only -
                  not a diagnosis. Medication dosages are excluded by design.
                </p>
              </>
            )}
          </div>

          {/* Footer */}
          {state.phase === "ready" && (
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-[#E7E0D8] dark:border-[#322D28]">
              <div className="flex items-center gap-1.5" title="Copy for records or email">
                <CopyButton text={state.summary.narrative} alwaysVisible />
                <span className="text-xs text-[#57534E] dark:text-[#A8A29E]">Copy note</span>
              </div>
              <button
                onClick={() => downloadDoctorSummaryPdf(sessionId, state.summary)}
                className="flex items-center gap-2 rounded-[8px] bg-[#EA580C] hover:bg-[#C2410C] text-white px-4 py-2 text-sm font-semibold transition-colors"
              >
                <Download size={15} />
                Download (PDF)
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
