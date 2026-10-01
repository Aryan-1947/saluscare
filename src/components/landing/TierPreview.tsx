import { motion } from "framer-motion";
import { ShieldCheck, Stethoscope, Siren } from "lucide-react";

const tiers = [
  {
    tier: "Tier 1",
    icon: ShieldCheck,
    name: "Self Care",
    desc: "Minor issues handled safely at home - clear remedies, foods to favor and avoid, and a recovery plan.",
    tile: "bg-[#F0FDF4] dark:bg-[#15803D]/10 text-[#15803D] dark:text-[#4ADE80]",
    hoverBorder: "hover:border-[#15803D]/40",
    label: "text-[#15803D] dark:text-[#4ADE80]",
  },
  {
    tier: "Tier 2",
    icon: Stethoscope,
    name: "Specialist Referral",
    desc: "Symptoms that need a professional - we name the right specialist, explain why, and cover interim care.",
    tile: "bg-[#FFFBEB] dark:bg-[#B45309]/10 text-[#B45309] dark:text-[#FBBF24]",
    hoverBorder: "hover:border-[#B45309]/40",
    label: "text-[#B45309] dark:text-[#FBBF24]",
  },
  {
    tier: "Tier 3",
    icon: Siren,
    name: "Emergency Care",
    desc: "Red-flag symptoms are detected first and routed to emergency guidance immediately, with no delay.",
    tile: "bg-[#FEF2F2] dark:bg-[#DC2626]/10 text-[#DC2626] dark:text-[#F87171]",
    hoverBorder: "hover:border-[#DC2626]/40",
    label: "text-[#DC2626] dark:text-[#F87171]",
  },
];

/** Landing-page preview of the three care paths an assessment can end in. */
export function TierPreview() {
  return (
    <section className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-10"
      >
        <div className="eyebrow mb-4">Care routing</div>
        <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-[#1A1613] dark:text-[#EDE8E2] mb-3">
          Every assessment ends in a clear direction
        </h2>
        <p className="text-[#57534E] dark:text-[#A8A29E] text-sm max-w-md mx-auto">
          Safety checks run before anything else. Your symptoms land in one of
          three tiers - never a vague "maybe see someone".
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {tiers.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className={`rounded-[10px] bg-white dark:bg-[#211D1A] border border-[#E7E0D8] dark:border-[#322D28] p-6 ${t.hoverBorder} transition-colors duration-200`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-[8px] flex items-center justify-center ${t.tile}`}>
                <t.icon size={17} />
              </div>
              <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${t.label}`}>
                {t.tier}
              </span>
            </div>
            <h3 className="font-display font-semibold text-base text-[#1A1613] dark:text-[#EDE8E2] mb-2">
              {t.name}
            </h3>
            <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">{t.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
