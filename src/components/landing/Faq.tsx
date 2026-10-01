import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

const faqs = [
  {
    q: "Is Salus Care a replacement for a doctor?",
    a: "No. Salus Care provides educational health information to help you decide the safest next step. It never diagnoses, and anything suggesting urgent or emergency care should be acted on immediately.",
  },
  {
    q: "What happens to my conversations?",
    a: "Sessions are visible only to you and exist so follow-up assessments work - we reassess against your earlier messages instead of starting from scratch. No sharing, no third-party analytics on your health data.",
  },
  {
    q: "How does the assessment actually work?",
    a: "You describe symptoms in your own words (or share a photo). Red-flag phrases are checked first, then your case is reasoned through structured clinical criteria and routed to self-care, a specialist, or emergency guidance.",
  },
  {
    q: "Can I come back about the same problem later?",
    a: "Yes - that's what sessions are for. Report how you're doing and the system compares against your last assessment, escalating safely if things have worsened.",
  },
  {
    q: "Does it cost anything?",
    a: "No. Salus Care is free to use.",
  },
];

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-[#E7E0D8] dark:border-[#322D28]">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-4 text-left group"
      >
        <span
          className={`text-sm font-medium transition-colors ${
            open
              ? "text-[#EA580C]"
              : "text-[#1A1613] dark:text-[#EDE8E2] group-hover:text-[#EA580C]"
          }`}
        >
          {q}
        </span>
        <Plus
          size={16}
          className={`shrink-0 transition-transform duration-200 ${
            open ? "rotate-45 text-[#EA580C]" : "text-[#A8A29E]"
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed pb-4 pr-8">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Landing-page FAQ - restrained accordion, one item open at a time. */
export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="relative z-10 max-w-2xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-8"
      >
        <div className="eyebrow mb-4">FAQ</div>
        <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-[#1A1613] dark:text-[#EDE8E2] mb-3">
          Common questions
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-white dark:bg-[#211D1A] border border-[#E7E0D8] dark:border-[#322D28] rounded-[10px] px-5 md:px-6"
      >
        {faqs.map((f, i) => (
          <FaqItem
            key={f.q}
            q={f.q}
            a={f.a}
            open={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          />
        ))}
      </motion.div>
    </section>
  );
}
