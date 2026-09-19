import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ImagePlus, X, Loader2, RotateCcw, MessageSquareText } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { logRootSession } from "@/lib/sessionLog";
import { useApi } from "@/hooks/useApi";
import { prepareImageForUpload } from "@/lib/api";
import { ResultCard } from "@/components/ask/ResultCard";
import { EcgMonitor } from "@/components/ask/EcgMonitor";
import type { AssessmentResult, ImageClarificationResult, TextClarificationResult, GeneralAnswerResult } from "@/types/api";

const suggestedSymptoms = [
  { text: "Fever", emoji: "\u{1F912}" },
  { text: "Rash", emoji: "\u{1F534}" },
  { text: "Headache", emoji: "\u{1F915}" },
  { text: "Stomach pain", emoji: "\u{1F922}" },
  { text: "Sore throat", emoji: "\u{1F637}" },
  { text: "Minor cut", emoji: "\u{1FA79}" },
];

type Turn =
  | { role: "user"; kind: "text"; content: string }
  | { role: "user"; kind: "image"; content: string; caption?: string }
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
  const { startSession, sendMessage, sendImage, sendFollowup } = useApi();
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
  const [clarificationRound, setClarificationRound] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    startSession()
      .then((res) => setSessionId(res.sessionId))
      .catch(() => setError("Could not start a session. Please refresh the page."));
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
          { role: "user", kind: "image", content: submittedImagePreview!, caption: submittedText || undefined },
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
        } else {
          setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
          if (user?.sub) logRootSession(user.sub, sessionId);
        }
      } else if (awaitingImageClarification && pendingImageContext) {
        setTurns((prev) => [...prev, { role: "user", kind: "text", content: submittedText }]);
        const combined = `${pendingImageContext}. ${submittedText}`;
        const res = await sendMessage(combined, sessionId, true);
        setAwaitingImageClarification(false);
        setPendingImageContext(null);
        if (!isTextClarification(res)) {
          setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
          if (user?.sub) logRootSession(user.sub, sessionId);
        }
      } else if (awaitingTextClarification && pendingOriginalText) {
        setTurns((prev) => [...prev, { role: "user", kind: "text", content: submittedText }]);
        const combined = `${pendingOriginalText}. ${submittedText}`;
        const nextRound = clarificationRound + 1;
        const forceSkip = nextRound >= 3;
        const res = await sendMessage(combined, sessionId, forceSkip);
        if (isTextClarification(res)) {
          setTurns((prev) => [...prev, { role: "assistant", kind: "question", content: res.clarifyingQuestion }]);
          setPendingOriginalText(combined);
          setClarificationRound(nextRound);
        } else {
          setAwaitingTextClarification(false);
          setPendingOriginalText(null);
          setClarificationRound(0);
          setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
          if (user?.sub) logRootSession(user.sub, sessionId);
        }
      } else if (lastResultTurn) {
        setTurns((prev) => [...prev, { role: "user", kind: "text", content: submittedText }]);

        // Build recent Q&A exchange history from the last few text+answer turn pairs
        const recentExchanges: { question: string; answer: string }[] = [];
        for (let i = turns.length - 1; i >= 0 && recentExchanges.length < 3; i--) {
          if (turns[i].role === "assistant" && turns[i].kind === "answer") {
            const answerContent = (turns[i] as Extract<Turn, { kind: "answer" }>).content;
            const prevUserTurn = turns[i - 1];
            if (prevUserTurn?.role === "user" && prevUserTurn.kind === "text") {
              recentExchanges.unshift({ question: prevUserTurn.content, answer: answerContent });
            }
          }
        }

        const newSessionId = crypto.randomUUID();
        const res = await sendFollowup(submittedText, lastResultTurn.content.sessionId, newSessionId, recentExchanges);
        if (isGeneralAnswer(res)) {
          setTurns((prev) => [...prev, { role: "assistant", kind: "answer", content: res.answer }]);
        } else {
          setTurns((prev) => [...prev, { role: "assistant", kind: "result", content: res }]);
        }
      } else {
        setTurns((prev) => [...prev, { role: "user", kind: "text", content: submittedText }]);
        const res = await sendMessage(submittedText, sessionId);
        if (isTextClarification(res)) {
          setTurns((prev) => [...prev, { role: "assistant", kind: "question", content: res.clarifyingQuestion }]);
          setAwaitingTextClarification(true);
          setPendingOriginalText(submittedText);
          setClarificationRound(1);
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
    setAwaitingTextClarification(false);
    setPendingOriginalText(null);
    setAwaitingImageClarification(false);
    setPendingImageContext(null);
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
    <div className="relative flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#EEF2F7] dark:bg-[#0B0F19]">
      <EcgMonitor tier={lastResultTurn?.content.tier ?? 1} />

      {/* Connected glass chat card */}
      <div className="relative z-10 flex flex-col flex-1 max-w-4xl w-full mx-auto px-4 md:px-8 py-4 min-h-0">
        <div className="flex flex-col flex-1 bg-white/60 dark:bg-[#151B2C]/40 backdrop-blur-xl rounded-[16px] border border-[#D8E0EA] dark:border-white/[0.08] shadow-[0_8px_32px_rgba(15,23,42,0.07)] overflow-hidden min-h-0">
          {/* Scrollable messages area */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {turns.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-10 text-center">
                <div className="w-16 h-16 rounded-[16px] bg-gradient-to-br from-[#0EA5A4]/20 to-[#06B6B4]/10 ring-1 ring-[#0EA5A4]/20 shadow-[0_8px_24px_rgba(14,165,164,0.18)] flex items-center justify-center mx-auto mb-5">
                  <MessageSquareText size={26} className="text-[#0EA5A4]" />
                </div>
                <h1 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-white mb-2">
                  Describe what you're experiencing.
                </h1>
                <p className="text-sm text-[#64748B] dark:text-neutral-400 max-w-md mx-auto">
                  Share your symptoms in your own words, or attach a photo of anything visible. I'll ask a few questions to understand your situation properly.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                  {suggestedSymptoms.map((s) => (
                    <button
                      key={s.text}
                      onClick={() => handleSymptomClick(s.text)}
                      className="flex items-center gap-1.5 rounded-full bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-[#64748B] dark:text-neutral-300 hover:border-[#0EA5A4]/50 hover:text-[#0EA5A4] transition-all"
                    >
                      <span>{s.emoji}</span>
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
                        <div className="max-w-[80%] rounded-[14px] rounded-br-[4px] bg-[#0F172A] dark:bg-[#0EA5A4] text-white px-4 py-2.5 text-sm">
                          {turn.content}
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
                        <div className="max-w-[80%] rounded-[14px] rounded-br-[4px] bg-[#0F172A] dark:bg-[#0EA5A4] text-white px-3 py-3 text-sm flex flex-col gap-2">
                          <img src={turn.content} alt="Submitted symptom" className="rounded-[8px] max-h-40 object-cover" />
                          {turn.caption && <span>{turn.caption}</span>}
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
                        <div className="max-w-[80%] rounded-[14px] rounded-bl-[4px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] text-[#0F172A] dark:text-white px-4 py-2.5 text-sm">
                          {turn.content}
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
              </AnimatePresence>
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="rounded-[14px] rounded-bl-[4px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-[#94A3B8] dark:bg-neutral-500"
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

          {/* Input bar - connected to the same card */}
          <div className="border-t border-white/40 dark:border-white/[0.08] p-3">
            {imagePreview && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative inline-block mb-2 px-1">
                <img src={imagePreview} alt="Selected symptom" className="h-16 w-16 object-cover rounded-[8px]" />
                <button
                  onClick={clearImage}
                  className="absolute -top-2 -right-1 w-5 h-5 rounded-full bg-[#0F172A] text-white flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              </motion.div>
            )}
            <div className="flex items-end gap-2">
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
                    : lastResultTurn
                    ? "How are things now? Better, worse, new symptoms..."
                    : "e.g. I've had a sore throat for 2 days and now a mild fever..."
                }
                rows={1}
                disabled={hasEmergency || loading}
                className="flex-1 resize-none bg-transparent outline-none text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-neutral-500 py-2 px-2 disabled:cursor-not-allowed"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={hasEmergency || loading}
                className="p-2 rounded-[8px] text-[#64748B] dark:text-neutral-400 hover:text-[#0EA5A4] transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ImagePlus size={18} />
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || (!text.trim() && !imageFile) || !sessionId || hasEmergency}
                className="p-2.5 rounded-[10px] bg-[#0F172A] dark:bg-[#0EA5A4] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            {turns.length > 0 && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs text-[#64748B] dark:text-neutral-500 hover:text-[#0F172A] dark:hover:text-white mt-2 px-2 transition-colors"
              >
                <RotateCcw size={12} /> Start a completely new assessment
              </button>
            )}
          </div>
        </div>

        {turns.length === 0 && (
          <p className="text-[10px] text-center text-[#94A3B8] dark:text-neutral-600 mt-2 px-4 leading-relaxed">
            Salus Care provides educational health information only and is not a substitute for professional medical advice, diagnosis, or treatment. Do not submit highly sensitive personal or medical information.
          </p>
        )}
      </div>
    </div>
  );
}