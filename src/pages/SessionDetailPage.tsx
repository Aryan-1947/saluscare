import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, Loader2, ArrowLeft } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { ResultCard } from "@/components/ask/ResultCard";
import { EcgMonitor } from "@/components/ask/EcgMonitor";
import type { AssessmentResult, GeneralAnswerResult, HistoryTurn, Tier } from "@/types/api";

type Turn =
  | { role: "user"; kind: "text"; content: string }
  | { role: "user"; kind: "image"; content: string; caption?: string }
  | { role: "assistant"; kind: "question"; content: string }
  | { role: "assistant"; kind: "answer"; content: string }
  | { role: "assistant"; kind: "result"; content: AssessmentResult };

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
      .then((history) => {
        // Backend returns { groupId, turns } where each turn already mirrors
        // the live chat structure (user text/image, assistant question/answer/result).
        const historyTurns: HistoryTurn[] = history.turns ?? [];
        const built: Turn[] = [];

        for (const t of historyTurns) {
          if (t.role === "user") {
            if (t.kind === "image" && t.imageUrl) {
              built.push({ role: "user", kind: "image", content: t.imageUrl, caption: t.content ?? undefined });
            } else if (t.kind === "text" && t.content) {
              built.push({ role: "user", kind: "text", content: t.content });
            }
            continue;
          }

          if (t.kind === "question" && t.content) {
            built.push({ role: "assistant", kind: "question", content: t.content });
          } else if (t.kind === "answer" && t.content) {
            built.push({ role: "assistant", kind: "answer", content: t.content });
          } else if (t.kind === "result") {
            const payload = t.result as
              | { sessionId?: string; tier?: Tier; response?: AssessmentResult["response"] }
              | null;
            if (payload?.response) {
              built.push({
                role: "assistant",
                kind: "result",
                content: {
                  sessionId: payload.sessionId ?? sessionId,
                  tier: (payload.tier ?? 1) as Tier,
                  triage: null,
                  response: payload.response,
                },
              });
            }
          }
        }

        setTurns(built);

        // Resume the conversation from the newest assessment in the chain.
        const resultTurns = built.filter(
          (t): t is Extract<Turn, { kind: "result" }> => t.kind === "result"
        );
        if (resultTurns.length > 0) {
          setLatestSessionId(resultTurns[resultTurns.length - 1].content.sessionId);
        }
      })
      .catch(() => setError("Could not load this session."))
      .finally(() => setLoading(false));
  }, [sessionId, getHistory]);

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
                if (turn.role === "user" && turn.kind === "image") {
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                      <div className="max-w-[80%] rounded-[14px] rounded-br-[4px] bg-[#0F172A] dark:bg-[#0EA5A4] text-white px-3 py-3 text-sm flex flex-col gap-2">
                        <img src={turn.content} alt="Submitted symptom" className="rounded-[8px] max-h-40 object-cover" />
                        {turn.caption && <span>{turn.caption}</span>}
                      </div>
                    </motion.div>
                  );
                }
                if (turn.role === "user") {
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                      <div className="max-w-[80%] rounded-[14px] rounded-br-[4px] bg-[#0F172A] dark:bg-[#0EA5A4] text-white px-4 py-2.5 text-sm">
                        {turn.content}
                      </div>
                    </motion.div>
                  );
                }
                if (turn.kind === "question") {
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                      <div className="max-w-[80%] rounded-[14px] rounded-bl-[4px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] text-[#0F172A] dark:text-white px-4 py-2.5 text-sm">
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
                An emergency was flagged in this session - it has ended. Please seek immediate care.
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