import { useState, useEffect, useRef, useCallback, type DragEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, ArrowLeft, Mic, MicOff, Stethoscope, ImagePlus, X, MessageSquarePlus } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { prepareImageForUpload } from "@/lib/api";
import { buildRecentExchanges } from "@/lib/recentExchanges";
import { ResultCard } from "@/components/ask/ResultCard";
import { TimeStamp } from "@/components/ask/TimeStamp";
import { DoctorSummaryModal } from "@/components/ask/DoctorSummaryModal";
import { EcgMonitor } from "@/components/ask/EcgMonitor";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { ListeningIndicator } from "@/components/ask/ListeningIndicator";
import type {
  AssessmentResult,
  GeneralAnswerResult,
  HistoryTurn,
  ImageClarificationResult,
  TextClarificationResult,
  Tier,
} from "@/types/api";

type Turn =
  | { role: "user"; kind: "text"; content: string; at?: Date }
  | { role: "user"; kind: "image"; content: string; caption?: string; at?: Date }
  | { role: "assistant"; kind: "question"; content: string }
  | { role: "assistant"; kind: "answer"; content: string }
  | { role: "assistant"; kind: "result"; content: AssessmentResult };

function isGeneralAnswer(
  result: AssessmentResult | GeneralAnswerResult
): result is GeneralAnswerResult {
  return "isGeneralAnswer" in result;
}

function isImageClarification(
  result: AssessmentResult | ImageClarificationResult
): result is ImageClarificationResult {
  return "needsClarification" in result && "imageUrl" in result;
}

function isTextClarification(
  result: AssessmentResult | TextClarificationResult
): result is TextClarificationResult {
  return "needsClarification" in result;
}

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { getHistory, sendFollowup, getDoctorSummary, sendImage, sendAnswerWithImage } = useApi();
  const navigate = useNavigate();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [latestSessionId, setLatestSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Dictation appends to the draft, same behavior as AskPage.
  const { supported: speechSupported, listening: speechListening, toggle: toggleSpeech } =
    useSpeechRecognition((dictated) => {
      setText((prev) => (prev ? `${prev.trimEnd()} ${dictated}` : dictated));
    });
  const [showSummary, setShowSummary] = useState(false);
  // Sessions open read-only: the full transcript is visible, but chatting
  // only starts after the user explicitly continues the session.
  const [chatMode, setChatMode] = useState(false);
  // WhatsApp-style timestamps for the live follow-up exchange. History turns
  // have no stored time, so their TimeStamp renders nothing.
  const [assistantTime, setAssistantTime] = useState<Date | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag & drop image attach, same as AskPage. Depth counter keeps the
  // overlay from flickering across child element boundaries.
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (hasEmergency || submitting || loading) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (hasEmergency || submitting || loading) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files (PNG, JPG, WebP) can be attached.");
      return;
    }
    // Dropping an image implies the user wants to pick the session back up.
    setChatMode(true);
    handleImageSelect(file);
  };
  const handleImageSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };
  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // The route param is the conversation group id - the same key the summary
  // edge function queries chat history with.
  const fetchSummary = useCallback(
    () => getDoctorSummary(sessionId!),
    [getDoctorSummary, sessionId]
  );

  // Auto-grow the textarea as the user types (capped at ~5 rows)
  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  useEffect(() => {
    if (!sessionId) return;
    // (Switching sessions remounts this page via the keyed route in App.tsx,
    // so local state like chat mode resets itself.)
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

  // Pending image-clarification state (mirrors AskPage's image flow).
  const [pendingImage, setPendingImage] = useState<{ context: string; quality: boolean | null } | null>(null);
  const now = () => new Date();

  const handleFollowup = async () => {
    if ((!text.trim() && !imageFile) || !latestSessionId) return;
    setSubmitting(true);
    setError(null);
    const submittedText = text.trim();
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      // Answering an image-clarification question: combine context + reply.
      if (pendingImage) {
        setTurns((prev) => [...prev, { role: "user", kind: "text", content: submittedText, at: now() }]);
        const combined = `${pendingImage.context}. ${submittedText}`;
        const res = await sendAnswerWithImage(combined, latestSessionId, true, pendingImage.quality === true, true);
        setPendingImage(null);
        if (!isTextClarification(res)) {
          setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
          setAssistantTime(now());
          setLatestSessionId(res.sessionId);
        } else {
          setTurns((prev) => [...prev, { role: "assistant", kind: "question", content: res.clarifyingQuestion }]);
          setAssistantTime(now());
        }
        return;
      }

      // New image attachment: same flow as AskPage's image branch.
      if (imageFile) {
        setTurns((prev) => [
          ...prev,
          { role: "user", kind: "image", content: imagePreview!, caption: submittedText || undefined, at: now() },
        ]);
        const { base64, mimeType } = await prepareImageForUpload(imageFile);
        const res = await sendImage(base64, mimeType, submittedText || undefined, latestSessionId);
        clearImage();
        if (isImageClarification(res)) {
          setTurns((prev) => [...prev, { role: "assistant", kind: "question", content: res.clarifyingQuestion }]);
          setAssistantTime(now());
          setPendingImage({ context: res.imageContext ?? "", quality: res.imageQualityGood ?? null });
        } else {
          setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
          setAssistantTime(now());
          setLatestSessionId(res.sessionId);
        }
        return;
      }

      // Plain text follow-up.
      setTurns((prev) => [...prev, { role: "user", kind: "text", content: submittedText, at: now() }]);
      const newSessionId = crypto.randomUUID();
      // Pass recent Q&A exchanges so resumed sessions keep the same
      // conversational memory as the live AskPage flow.
      const res = await sendFollowup(submittedText, latestSessionId, newSessionId, buildRecentExchanges(turns));
      if (isGeneralAnswer(res)) {
        setTurns((prev) => [...prev, { role: "assistant", kind: "answer", content: res.answer }]);
        setAssistantTime(now());
      } else {
        setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
        setAssistantTime(now());
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
    <div
      className="relative flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#FAF7F2] dark:bg-[#191614]"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Tier-colored ECG trace on the page background, same as AskPage. */}
      <EcgMonitor tier={currentTier} />

      {/* Drag & drop overlay hint (pointer-events-none so the drop reaches
          the page-level handler underneath) */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#1A1613]/45 dark:bg-black/55 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          >
            <div className="flex flex-col items-center gap-2 bg-white dark:bg-[#211D1A] border-2 border-dashed border-[#EA580C] rounded-[12px] px-10 py-8">
              <ImagePlus size={28} className="text-[#EA580C] mb-1" />
              <p className="text-sm font-semibold text-[#1A1613] dark:text-[#EDE8E2]">
                Drop your image to attach it
              </p>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">PNG, JPG or WebP</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col flex-1 max-w-4xl w-full mx-auto px-4 md:px-8 py-4 min-h-0">
        <div className="flex items-center justify-between gap-3 mb-3">
          <button
            onClick={() => navigate("/sessions")}
            className="flex items-center gap-1.5 text-sm text-[#57534E] dark:text-[#A8A29E] hover:text-[#1A1613] dark:hover:text-[#EDE8E2] transition-colors"
          >
            <ArrowLeft size={15} /> Back to sessions
          </button>
          {!loading && turns.length > 0 && (
            <button
              onClick={() => setShowSummary(true)}
              className="flex items-center gap-2 rounded-[8px] border border-[#E7E0D8] dark:border-[#322D28] bg-white dark:bg-[#26221E] px-3.5 py-2 text-xs font-semibold text-[#1A1613] dark:text-[#EDE8E2] hover:border-[#EA580C]/50 hover:text-[#EA580C] transition-colors"
            >
              <Stethoscope size={14} />
              Doctor summary
            </button>
          )}
        </div>

        <div className="flex flex-col flex-1 bg-white/80 dark:bg-[#211D1A]/80 backdrop-blur-sm rounded-[12px] border border-[#E7E0D8] dark:border-[#322D28] shadow-[0_1px_2px_rgba(26,22,19,0.05)] overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">                {loading && (
              <div className="flex flex-col gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-[12px] shimmer-skeleton dark:bg-white/[0.03]" />
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {turns.map((turn, i) => {
                if (turn.role === "user" && turn.kind === "image") {
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                      <div className="max-w-[75%] rounded-[10px] rounded-br-[4px] bg-[#1A1613] dark:bg-[#EDE8E2] text-white dark:text-[#1A1613] px-3 py-3 text-sm flex flex-col gap-2">
                        <img src={turn.content} alt="Submitted symptom" className="rounded-[8px] max-h-40 object-cover" />
                        {turn.caption && <span>{turn.caption}</span>}
                        <TimeStamp at={turn.at} tone="dark" />
                      </div>
                    </motion.div>
                  );
                }
                if (turn.role === "user") {
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                      <div className="max-w-[75%] rounded-[10px] rounded-br-[4px] bg-[#1A1613] dark:bg-[#EDE8E2] text-white dark:text-[#1A1613] px-4 py-2.5 text-sm">
                        <div className="flex items-end justify-between gap-4">
                          <span>{turn.content}</span>
                          <TimeStamp at={turn.at} tone="dark" />
                        </div>
                      </div>
                    </motion.div>
                  );
                }
                if (turn.kind === "question") {
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                      <div className="max-w-[75%] rounded-[10px] rounded-bl-[4px] bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] text-[#1A1613] dark:text-[#EDE8E2] px-4 py-2.5 text-sm">
                        <div className="flex items-end justify-between gap-4">
                          <span>{turn.content}</span>
                          <TimeStamp at={assistantTime} />
                        </div>
                      </div>
                    </motion.div>
                  );
                }
                if (turn.kind === "answer") {
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                      <div className="max-w-[75%] rounded-[10px] rounded-bl-[4px] bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] text-[#1A1613] dark:text-[#EDE8E2] px-4 py-2.5 text-sm leading-relaxed">
                        <div className="flex items-end justify-between gap-4">
                          <span>{turn.content}</span>
                          <TimeStamp at={assistantTime} />
                        </div>
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

          {/* Read-only view: transcript only, with an explicit continue gate */}
          {!loading && !hasEmergency && !chatMode && (
            <div className="p-3 md:p-4">
              <div className="flex flex-col items-center gap-2 rounded-[12px] border border-dashed border-[#E7E0D8] dark:border-[#322D28] bg-[#F5F0E8]/60 dark:bg-white/[0.03] px-4 py-5 text-center">
                <MessageSquarePlus size={20} className="text-[#EA580C]" />
                <p className="text-sm font-semibold text-[#1A1613] dark:text-[#EDE8E2]">
                  Want to continue this session?
                </p>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] max-w-sm leading-relaxed">
                  Report how you're doing now and we'll reassess against this
                  conversation - not start from scratch.
                </p>
                <button
                  onClick={() => setChatMode(true)}
                  className="mt-1 flex items-center gap-2 rounded-[8px] bg-[#EA580C] hover:bg-[#C2410C] text-white px-5 py-2 text-sm font-semibold transition-colors"
                >
                  <MessageSquarePlus size={15} />
                  Continue chat
                </button>
              </div>
            </div>
          )}

          {!loading && !hasEmergency && chatMode && (
            <div className="p-3 md:p-4">
              {speechListening && <ListeningIndicator />}
              {imagePreview && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative inline-block mb-2 px-1">
                  <img src={imagePreview} alt="Selected symptom" className="h-16 w-16 object-cover rounded-[8px]" />
                  <button
                    onClick={clearImage}
                    className="absolute -top-2 -right-1 w-5 h-5 rounded-full bg-[#1A1613] text-white flex items-center justify-center"
                    aria-label="Remove image"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              )}
              <div className="flex items-end gap-2">
                {/* Curved input bubble holding the textarea + inline actions */}
                <div className="flex-1 flex items-end gap-1 bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] rounded-[18px] px-2 py-1 shadow-[0_2px_10px_rgba(26,22,19,0.06)]">
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
                  placeholder={submitting ? "" : "Type a message"}
                  rows={1}
                  autoFocus
                  disabled={submitting}
                  className="flex-1 resize-none bg-transparent outline-none text-sm text-[#1A1613] dark:text-[#EDE8E2] placeholder:text-[#A8A29E] dark:placeholder:text-[#78716C] py-2 px-2 disabled:cursor-not-allowed"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                />
                <button
                  onClick={toggleSpeech}
                  disabled={submitting || !speechSupported}
                  aria-label={speechListening ? "Stop dictation" : "Start dictation"}
                  title={
                    speechListening
                      ? "Stop dictation"
                      : speechSupported
                        ? "Dictate your update"
                        : "Voice input needs Chrome, Edge or Safari"
                  }
                  className={cn(
                    "p-2 rounded-full transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed",
                    speechListening
                      ? "bg-[#EA580C]/10 text-[#EA580C] animate-pulse"
                      : "text-[#57534E] dark:text-[#A8A29E] hover:text-[#EA580C]"
                  )}
                >
                  {speechListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                  className="p-2 rounded-full text-[#57534E] dark:text-[#A8A29E] hover:text-[#EA580C] transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ImagePlus size={18} />
                </button>
                </div>
                <button
                  onClick={handleFollowup}
                  disabled={submitting || (!text.trim() && !imageFile)}
                  aria-label="Send message"
                  className="w-10 h-10 rounded-full bg-[#EA580C] hover:bg-[#C2410C] text-white flex items-center justify-center shadow-[0_2px_8px_rgba(234,88,12,0.30)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-colors shrink-0"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showSummary && sessionId && (
        <DoctorSummaryModal
          sessionId={sessionId}
          fetchSummary={fetchSummary}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}