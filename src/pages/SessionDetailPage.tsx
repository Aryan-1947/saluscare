import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, Loader2, ArrowLeft } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { ResultCard } from "@/components/ask/ResultCard";
import { EcgMonitor } from "@/components/ask/EcgMonitor";
import type { AssessmentResult, GeneralAnswerResult, Tier } from "@/types/api";

type DbSession = {
  id: string;
  user_input_text: string;
  tier: Tier;
  confidence: number;
  final_response: AssessmentResult["response"];
  created_at: string;
};

type Turn =
  | { role: "user"; kind: "text"; content: string }
  | { role: "assistant"; kind: "result"; content: AssessmentResult }
  | { role: "assistant"; kind: "answer"; content: string };

function isGeneralAnswer(
  result: AssessmentResult | GeneralAnswerResult
): result is GeneralAnswerResult {
  return "isGeneralAnswer" in result;
}

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { getHistory, sendFollowup } = useApi();
  const navigate = useNavigate();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [latestSessionId, setLatestSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea as the user types (capped at ~5 rows)
  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  useEffect(() => {
    if (!sessionId) return;
    getHistory(sessionId)
      .then((res) => {
        const history = res as { sessions: DbSession[] };
        const built: Turn[] = [];
        history.sessions.forEach((s) => {
          built.push({ role: "user", kind: "text", content: s.user_input_text });
          built.push({
            role: "assistant",
            kind: "result",
            content: { sessionId: s.id, tier: s.tier, triage: null, response: s.final_response },
          });
        });
        setTurns(built);
        if (history.sessions.length > 0) {
          setLatestSessionId(history.sessions[history.sessions.length - 1].id);
        }
      })
      .catch(() => setError("Could not load this session."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const handleFollowup = async () => {
    if (!text.trim() || !latestSessionId) return;
    setSubmitting(true);
    setError(null);
    const submittedText = text.trim();
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setTurns((prev) => [...prev, { role: "user", kind: "text", content: submittedText }]);

    try {
      const newSessionId = crypto.randomUUID();
      const res = await sendFollowup(submittedText, latestSessionId, newSessionId);
      if (isGeneralAnswer(res)) {
        setTurns((prev) => [...prev, { role: "assistant", kind: "answer", content: res.answer }]);
      } else {
        setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
        setLatestSessionId(res.sessionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasEmergency = turns.some((t) => t.kind === "result" && (t.content as AssessmentResult).tier === 3);
  const lastResultTurn = [...turns].reverse().find((t) => t.role === "assistant" && t.kind === "result");
  const currentTier = lastResultTurn ? (lastResultTurn.content as AssessmentResult).tier : 1;

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#F8FAFC] dark:bg-[#0B0F19]">
      <EcgMonitor tier={currentTier} />

      <div className="relative z-10 flex flex-col flex-1 max-w-4xl w-full mx-auto px-4 md:px-8 py-4 min-h-0">
        <button
          onClick={() => navigate("/sessions")}
          className="flex items-center gap-1.5 text-sm text-[#64748B] dark:text-neutral-400 hover:text-[#0F172A] dark:hover:text-white mb-3 transition-colors w-fit"
        >
          <ArrowLeft size={15} /> Back to sessions
        </button>

        <div className="flex flex-col flex-1 bg-white/35 dark:bg-[#151B2C]/30 backdrop-blur-xl rounded-[16px] border border-white/30 dark:border-white/[0.06] overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {loading && (
              <div className="flex flex-col gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-[12px] bg-[#F1F5F9] dark:bg-white/[0.03] animate-pulse" />
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {turns.map((turn, i) => {
                if (turn.role === "user") {
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                      <div className="max-w-[80%] rounded-[14px] rounded-br-[4px] bg-[#0F172A] dark:bg-[#0EA5A4] text-white px-4 py-2.5 text-sm">
                        {turn.content}
                      </div>
                    </motion.div>
                  );
                }
                if (turn.kind === "answer") {
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                      <div className="max-w-[80%] rounded-[14px] rounded-bl-[4px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] text-[#0F172A] dark:text-white px-4 py-2.5 text-sm leading-relaxed">
                        {turn.content}
                      </div>
                    </motion.div>
                  );
                }
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <ResultCard result={turn.content as AssessmentResult} />
                  </motion.div>
                );
              })}
            </div>

            {hasEmergency && (
              <p className="text-xs text-center text-[#DC2626] font-medium mt-4">
                An emergency was flagged in this session — it has ended. Please seek immediate care.
              </p>
            )}

            <div ref={bottomRef} />
            {error && <p className="mt-4 text-sm text-[#DC2626] text-center">{error}</p>}
          </div>

          {!loading && !hasEmergency && (
            <div className="border-t border-white/40 dark:border-white/[0.08] p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    autoGrow(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleFollowup();
                    }
                  }}
                  placeholder={submitting ? "" : "How are things now? Better, worse, new symptoms..."}
                  rows={1}
                  disabled={submitting}
                  className="flex-1 resize-none bg-transparent outline-none text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-neutral-500 py-2 px-2 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleFollowup}
                  disabled={submitting || !text.trim()}
                  className="p-2.5 rounded-[10px] bg-[#0F172A] dark:bg-[#0EA5A4] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}