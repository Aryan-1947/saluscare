import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";

/** Copies text via the async Clipboard API, falling back to a hidden
 * textarea + execCommand on non-secure contexts (plain http dev hosts). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false; // e.g. clipboard permission denied - button just won't flip
  }
}

/**
 * Small icon button that copies `text` on click and shows a check mark for
 * ~1.6s after a successful copy. Place it next to any message bubble; hover
 * its parent to reveal it (use `alwaysVisible` to keep it shown).
 */
export function CopyButton({
  text,
  className = "",
  alwaysVisible = false,
}: {
  text: string;
  className?: string;
  alwaysVisible?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const onCopy = useCallback(async () => {
    if (await copyText(text)) {
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1600);
    }
  }, [text]);

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : "Copy message"}
      title="Copy"
      onClick={(e) => {
        e.stopPropagation();
        void onCopy();
      }}
      className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-[#A8A29E] transition-colors hover:bg-[#F5F0E8] hover:text-[#EA580C] dark:text-[#78716C] dark:hover:bg-white/[0.06] dark:hover:text-[#EA580C] ${
        alwaysVisible ? "" : "opacity-0 group-hover/msg:opacity-100 transition-opacity"
      } ${className}`}
    >
      <AnimatePresence initial={false} mode="wait">
        {copied ? (
          <motion.span
            key="check"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
          >
            <Check size={13} className="text-[#EA580C]" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
          >
            <Copy size={13} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
