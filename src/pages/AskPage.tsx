import { useState, useRef, useEffect, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ImagePlus, X, Loader2, RotateCcw, MessageSquareText, Mic, MicOff, Stethoscope } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { logRootSession } from "@/lib/sessionLog";
import { useApi } from "@/hooks/useApi";
import { prepareImageForUpload } from "@/lib/api";
import { buildRecentExchanges } from "@/lib/recentExchanges";
import { ResultCard } from "@/components/ask/ResultCard";
import { EcgMonitor } from "@/components/ask/EcgMonitor";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { DoctorSummaryModal } from "@/components/ask/DoctorSummaryModal";
import { ListeningIndicator } from "@/components/ask/ListeningIndicator";
import { TimeStamp } from "@/components/ask/TimeStamp";
import { cn } from "@/lib/utils";
import type { AssessmentResult, ImageClarificationResult, TextClarificationResult, GeneralAnswerResult } from "@/types/api";

const suggestedSymptoms = [
  { text: "Fever" },
  { text: "Rash" },
  { text: "Headache" },
  { text: "Stomach pain" },
  { text: "Sore throat" },
  { text: "Minor cut" },
];

type Turn =
  | { role: "user"; kind: "text"; content: string; at?: Date }
  | { role: "user"; kind: "image"; content: string; caption?: string; at?: Date }
  | { role: "assistant"; kind: "question"; content: string }
  | { role: "assistant"; kind: "answer"; content: string }
  | { role: "assistant"; kind: "result"; content: AssessmentResult };

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


function isGeneralAnswer(
  result: AssessmentResult | GeneralAnswerResult
): result is GeneralAnswerResult {
  return "isGeneralAnswer" in result;
}


export function AskPage() {
  const { startSession, sendMessage, sendImage, sendAnswerWithImage, sendFollowup, getDoctorSummary } = useApi();
  const { user } = useAuth0();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingOriginalText, setPendingOriginalText] = useState<string | null>(null);
  const [awaitingTextClarification, setAwaitingTextClarification] = useState(false);
  const [awaitingImageClarification, setAwaitingImageClarification] = useState(false);
  const [pendingImageContext, setPendingImageContext] = useState<string | null>(null);
  const [pendingImageQuality, setPendingImageQuality] = useState<boolean | null>(null);
  const [clarificationRound, setClarificationRound] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  // Timestamps for the current conversation (WhatsApp-style). Cleared with
  // the reset handler; history turns keep time undefined so TimeStamp
  // renders nothing instead of lying about when a message was sent.
  const now = () => new Date();
  const [assistantTime, setAssistantTime] = useState<Date | null>(null);
  // Dictation appends to the draft rather than replacing it, so a user can
  // mix typing and speaking.
  const { supported: speechSupported, listening: speechListening, toggle: toggleSpeech } =
    useSpeechRecognition((dictated) => {
      setText((prev) => (prev ? `${prev.trimEnd()} ${dictated}` : dictated));
    });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Drag & drop image attach: a depth counter tracks nested dragenter/
  // dragleave pairs so the overlay doesn't flicker when the pointer crosses
  // child element boundaries mid-drag.
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (hasEmergency || loading) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // required for the drop event to fire
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
    if (hasEmergency || loading) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files (PNG, JPG, WebP) can be attached.");
      return;
    }
    setError(null);
    handleImageSelect(file);
  };

  // Auto-grow the textarea as the user types (capped at ~5 rows)
  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };
  const resetTextareaHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const lastResultTurn = [...turns].reverse().find((t) => t.role === "assistant" && t.kind === "result") as
    | Extract<Turn, { kind: "result" }>
    | undefined;
  const hasEmergency = turns.some((t) => t.kind === "result" && t.content.tier === 3);

  useEffect(() => {
    let cancelled = false;
    const start = async (attempt: number): Promise<void> => {
      try {
        const res = await startSession();
        if (!cancelled) setSessionId(res.sessionId);
      } catch (err) {
        // Token refresh and cold edge-function starts fail transiently on
        // first load - retry with backoff before showing an error.
        if (!cancelled && attempt < 2) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          return start(attempt + 1);
        }
        if (!cancelled) {
          const detail = err instanceof Error ? err.message : "";
          setError(
            "Could not start a session. Please refresh the page." +
              (detail ? ` (${detail})` : "")
          );
        }
      }
    };
    start(0);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!sessionId) return;
    if (!text.trim() && !imageFile) return;

    setLoading(true);
    setError(null);
    const submittedText = text.trim();
    const submittedImagePreview = imagePreview;
    setText("");
    resetTextareaHeight();

    try {
      if (imageFile) {
        setTurns((prev) => [
          ...prev,
          { role: "user", kind: "image", content: submittedImagePreview!, caption: submittedText || undefined, at: now() },
        ]);
        // Downscale + re-encode client-side so a 12 MB phone photo doesn't
        // blow past the edge function request body limit.
        const { base64, mimeType } = await prepareImageForUpload(imageFile);
        const res = await sendImage(base64, mimeType, submittedText || undefined, sessionId);
        clearImage();
        if (isImageClarification(res)) {
          setTurns((prev) => [...prev, { role: "assistant", kind: "question", content: res.clarifyingQuestion }]);
          setAwaitingImageClarification(true);
          setPendingImageContext(res.imageContext ?? null);
          setPendingImageQuality(res.imageQualityGood ?? null);
        } else {
          setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
          // The image produced a result, so any pending text-clarification from
          // an earlier unanswered question is stale. Leaving it set would route
          // the next message back into session-message with the old combined
          // text instead of the follow-up endpoint.
          setAwaitingTextClarification(false);
          setPendingOriginalText(null);
          setClarificationRound(0);
          if (user?.sub) logRootSession(user.sub, sessionId);
        }
      } else if (awaitingImageClarification && pendingImageContext) {
        setTurns((prev) => [...prev, { role: "user", kind: "text", content: submittedText }]);
        const combined = `${pendingImageContext}. ${submittedText}`;
        // hasImage/imageQualityGood ride along so the confidence scorer keeps
        // the image-quality signal from the original vision pass.
        const res = await sendAnswerWithImage(
          combined,
          sessionId,
          true,
          pendingImageQuality === true,
          true
        );
        setAwaitingImageClarification(false);
        setPendingImageContext(null);
        setPendingImageQuality(null);
        setAssistantTime(now());
        if (!isTextClarification(res)) {
          setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
          // Same stale-state cleanup as the image branch: the assessment is
          // complete, so leftover text-clarification flags must not survive it.
          setAwaitingTextClarification(false);
          setPendingOriginalText(null);
          setClarificationRound(0);
          if (user?.sub) logRootSession(user.sub, sessionId);
        }
      // A result turn means this clarification was already answered (or was
      // superseded by an image assessment) - the pending state is stale and
      // the message must fall through to the follow-up branch below.
      } else if (awaitingTextClarification && pendingOriginalText && !lastResultTurn) {
        setTurns((prev) => [...prev, { role: "user", kind: "text", content: submittedText }]);
        const combined = `${pendingOriginalText}. ${submittedText}`;
        const nextRound = clarificationRound + 1;
        const forceSkip = nextRound >= 3;
        const res = await sendMessage(combined, sessionId, forceSkip);
        if (isTextClarification(res)) {
          setTurns((prev) => [...prev, { role: "assistant", kind: "question", content: res.clarifyingQuestion }]);
          setPendingOriginalText(combined);
          setClarificationRound(nextRound);
          setAssistantTime(now());
        } else {
          setAwaitingTextClarification(false);
          setPendingOriginalText(null);
          setClarificationRound(0);
          setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
          setAssistantTime(now());
          if (user?.sub) logRootSession(user.sub, sessionId);
        }
      } else if (lastResultTurn) {
        // A result already exists, so any lingering clarification state is
        // stale by definition - clear it before routing this message as a
        // follow-up so later messages keep taking this same branch.
        if (awaitingTextClarification || pendingOriginalText) {
          setAwaitingTextClarification(false);
          setPendingOriginalText(null);
          setClarificationRound(0);
        }
        setTurns((prev) => [...prev, { role: "user", kind: "text", content: submittedText, at: now() }]);

        // Recent Q&A exchanges give the general-question agent conversational
        // continuity (shared helper with SessionDetailPage).
        const recentExchanges = buildRecentExchanges(turns);

        const newSessionId = crypto.randomUUID();
        const res = await sendFollowup(submittedText, lastResultTurn.content.sessionId, newSessionId, recentExchanges);
        if (isGeneralAnswer(res)) {
          setTurns((prev) => [...prev, { role: "assistant", kind: "answer", content: res.answer }]);
          setAssistantTime(now());
        } else {
          setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
          setAssistantTime(now());
        }
      } else {
        setTurns((prev) => [...prev, { role: "user", kind: "text", content: submittedText, at: now() }]);
        const res = await sendMessage(submittedText, sessionId);
        if (isTextClarification(res)) {
          setTurns((prev) => [...prev, { role: "assistant", kind: "question", content: res.clarifyingQuestion }]);
          setAwaitingTextClarification(true);
          setPendingOriginalText(submittedText);
          setClarificationRound(1);
          setAssistantTime(now());
        } else {
          setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
          if (user?.sub) logRootSession(user.sub, sessionId);
        }
      }
      } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSymptomClick = (symptom: string) => {
    setText(`I'm experiencing ${symptom.toLowerCase()}...`);
    textareaRef.current?.focus();
  };

  const handleReset = async () => {
    setTurns([]);
    setAssistantTime(null);
    setAwaitingTextClarification(false);
    setPendingOriginalText(null);
    setAwaitingImageClarification(false);
    setPendingImageContext(null);
    setPendingImageQuality(null);
    setClarificationRound(0);
    setText("");
    resetTextareaHeight();
    clearImage();
    setError(null);
    try {
      const res = await startSession();
      setSessionId(res.sessionId);
    } catch {
      setError("Could not start a new session.");
    }
  };

  return (
    <div
      className="relative flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#FAF7F2] dark:bg-[#191614]"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Tier-colored ECG trace on the page background - green/amber/red
          follows the current triage state; glows through the chat card. */}
      <EcgMonitor tier={lastResultTurn?.content.tier ?? 1} />

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

      {/* Chat card - slightly translucent so the trace shows through */}
      <div className="relative z-10 flex flex-col flex-1 max-w-4xl w-full mx-auto px-4 md:px-8 py-4 min-h-0">
        <div className="flex flex-col flex-1 bg-white/80 dark:bg-[#211D1A]/80 backdrop-blur-sm rounded-[12px] border border-[#E7E0D8] dark:border-[#322D28] shadow-[0_1px_2px_rgba(26,22,19,0.05)] overflow-hidden min-h-0">
          {/* Scrollable messages area */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {turns.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-10 text-center">
                <div className="w-14 h-14 rounded-[12px] bg-[#FFF3EA] dark:bg-[#EA580C]/10 border border-[#EA580C]/20 flex items-center justify-center mx-auto mb-5">
                  <MessageSquareText size={24} className="text-[#EA580C]" />
                </div>
                <h1 className="font-display text-2xl font-semibold text-[#1A1613] dark:text-[#EDE8E2] mb-2">
                  Describe what you're experiencing.
                </h1>
                <p className="text-sm text-[#57534E] dark:text-[#A8A29E] max-w-md mx-auto">
                  Share your symptoms in your own words, or attach a photo of anything visible. I'll ask a few questions to understand your situation properly.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                  {suggestedSymptoms.map((s) => (
                    <button
                      key={s.text}
                      onClick={() => handleSymptomClick(s.text)}
                      className="rounded-[8px] bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] px-3.5 py-1.5 text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:border-[#EA580C]/50 hover:text-[#EA580C] transition-colors"
                    >
                      {s.text}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {turns.map((turn, i) => {
                  if (turn.role === "user" && turn.kind === "text") {
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-end"
                      >
                        <div className="max-w-[75%] rounded-[10px] rounded-br-[4px] bg-[#1A1613] dark:bg-[#EDE8E2] text-white dark:text-[#1A1613] px-4 py-2.5 text-sm">
                          <div className="flex items-end justify-between gap-4">
                            <span>{turn.content}</span>
                            <TimeStamp at={turn.at} tone="dark" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  }
                  if (turn.role === "user" && turn.kind === "image") {
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-end"
                      >
                        <div className="max-w-[75%] rounded-[10px] rounded-br-[4px] bg-[#1A1613] dark:bg-[#EDE8E2] text-white dark:text-[#1A1613] px-3 py-3 text-sm flex flex-col gap-2">
                          <img src={turn.content} alt="Submitted symptom" className="rounded-[8px] max-h-40 object-cover" />
                          {turn.caption && <span>{turn.caption}</span>}
                          <TimeStamp at={turn.at} tone="dark" />
                        </div>
                      </motion.div>
                    );
                  }
                  if (turn.role === "assistant" && turn.kind === "question") {
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                      >
                        <div className="max-w-[75%] rounded-[10px] rounded-bl-[4px] bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] text-[#1A1613] dark:text-[#EDE8E2] px-4 py-2.5 text-sm">
                          <div className="flex items-end justify-between gap-4">
                            <span>{turn.content}</span>
                            <TimeStamp at={assistantTime} />
                          </div>
                        </div>
                      </motion.div>
                    );
                  }
                  if (turn.role === "assistant" && turn.kind === "answer") {
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                      >
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
              </AnimatePresence>
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="rounded-[10px] rounded-bl-[4px] bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-[#A8A29E] dark:bg-[#78716C]"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {hasEmergency && (
              <p className="text-xs text-center text-[#DC2626] font-medium mt-4">
                An emergency was flagged above - this assessment has ended. Please seek immediate care.
              </p>
            )}

            <div ref={bottomRef} />

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-[#DC2626] text-center">
                {error}
              </motion.p>
            )}
          </div>

          {/* Composer - floating curved input bubble (WhatsApp-style) */}
          <div className="p-3 md:p-4">
            {speechListening && <ListeningIndicator />}
            {imagePreview && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative inline-block mb-2 px-1">
                <img src={imagePreview} alt="Selected symptom" className="h-16 w-16 object-cover rounded-[8px]" />
                <button
                  onClick={clearImage}
                  className="absolute -top-2 -right-1 w-5 h-5 rounded-full bg-[#1A1613] text-white flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              </motion.div>
            )}
            <div className="flex items-end gap-2">
              {/* Curved input bubble holding the textarea + inline actions */}
              <div className="flex-1 flex items-end gap-1 bg-white dark:bg-[#26221E] border border-[#E7E0D8] dark:border-[#322D28] rounded-[18px] px-2 py-1 shadow-[0_2px_10px_rgba(26,22,19,0.06)]">
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  autoGrow(e.target);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={
                  loading
                    ? ""
                    : hasEmergency
                    ? "This assessment has ended. Please seek immediate care"
                    : turns.length === 0
                    ? "e.g. I've had a sore throat for 2 days and now a mild fever..."
                    : "Type a message"
                }
                rows={1}
                disabled={hasEmergency || loading}
                className="flex-1 resize-none bg-transparent outline-none text-sm text-[#1A1613] dark:text-[#EDE8E2] placeholder:text-[#A8A29E] dark:placeholder:text-[#78716C] py-2 px-2 disabled:cursor-not-allowed"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
              />
              {speechSupported && (
                <button
                  onClick={toggleSpeech}
                  disabled={hasEmergency || loading}
                  aria-label={speechListening ? "Stop dictation" : "Start dictation"}
                  title={speechListening ? "Stop dictation" : "Dictate your symptoms"}
                  className={cn(
                    "p-2 rounded-full transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed",
                    speechListening
                      ? "bg-[#EA580C]/10 text-[#EA580C] animate-pulse"
                      : "text-[#57534E] dark:text-[#A8A29E] hover:text-[#EA580C]"
                  )}
                >
                  {speechListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={hasEmergency || loading}
                className="p-2 rounded-full text-[#57534E] dark:text-[#A8A29E] hover:text-[#EA580C] transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ImagePlus size={18} />
              </button>
              </div>
              <button
                onClick={handleSubmit}
                disabled={loading || (!text.trim() && !imageFile) || !sessionId || hasEmergency}
                aria-label="Send message"
                className="w-10 h-10 rounded-full bg-[#EA580C] hover:bg-[#C2410C] text-white flex items-center justify-center shadow-[0_2px_8px_rgba(234,88,12,0.30)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-colors shrink-0"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            {turns.length > 0 && (
              <div className="flex items-center gap-4 mt-2 px-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 text-xs text-[#57534E] dark:text-[#78716C] hover:text-[#1A1613] dark:hover:text-[#EDE8E2] transition-colors"
                >
                  <RotateCcw size={12} /> Start a completely new assessment
                </button>
                {lastResultTurn && (
                  <button
                    onClick={() => setShowSummary(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#EA580C] hover:text-[#C2410C] transition-colors"
                  >
                    <Stethoscope size={12} /> Doctor summary
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {turns.length === 0 && (
          <p className="text-[10px] text-center text-[#A8A29E] dark:text-[#78716C] mt-2 px-4 leading-relaxed">
            Salus Care provides educational health information only and is not a substitute for professional medical advice, diagnosis, or treatment. Do not submit highly sensitive personal or medical information.
          </p>
        )}
      </div>

      {showSummary && sessionId && (
        <DoctorSummaryModal
          sessionId={sessionId}
          fetchSummary={() => getDoctorSummary(sessionId)}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}