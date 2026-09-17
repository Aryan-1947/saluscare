import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ShieldCheck,
  Stethoscope,
  Siren,
  Utensils,
  XCircle,
  AlertTriangle,
  ListChecks,
  Clock,
  Plus,
  Info,
} from "lucide-react";
import type { AssessmentResult, Tier1Response, Tier2Response, Tier3Response } from "@/types/api";

const tierConfig = {
  1: {
    label: "Self Care",
    icon: ShieldCheck,
    accent: "#059669",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  2: {
    label: "Specialist Referral",
    icon: Stethoscope,
    accent: "#D97706",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/20",
    text: "text-amber-700 dark:text-amber-400",
  },
  3: {
    label: "Emergency Care",
    icon: Siren,
    accent: "#DC2626",
    bg: "bg-rose-50 dark:bg-rose-500/10",
    border: "border-rose-200 dark:border-rose-500/20",
    text: "text-rose-700 dark:text-rose-400",
  },
} as const;

function InfoList({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[];
  icon: LucideIcon;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} className="text-[#64748B] dark:text-neutral-400" />
        <h4 className="text-sm font-semibold text-[#0F172A] dark:text-white">{title}</h4>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-[#64748B] dark:text-neutral-400 pl-4 relative">
            <span className="absolute left-0 top-2 w-1 h-1 rounded-full bg-[#94A3B8]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}



function FirstAidList({ items }: { items: { text: string; precaution: string | null }[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Plus size={15} className="text-[#D97706]" />
        <h4 className="text-sm font-semibold text-[#0F172A] dark:text-white">First Aid</h4>
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <div key={i} className="rounded-[8px] bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3">
            <p className="text-sm text-[#0F172A] dark:text-white">{item.text}</p>
            {item.precaution && (
              <div className="flex items-start gap-1.5 mt-1.5 pt-1.5 border-t border-amber-200 dark:border-amber-500/20">
                <Info size={12} className="text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">{item.precaution}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}



export function ResultCard({ result }: { result: AssessmentResult }) {
  const isUnseededFallback =
    result.tier !== 3 && (result.response as any).needsWebSearchGrounding === true;

  if (isUnseededFallback) {
    return (
      <div className="max-w-[80%] rounded-[14px] rounded-bl-[4px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] text-[#0F172A] dark:text-white px-4 py-2.5 text-sm leading-relaxed">
        {result.explanation}
      </div>
    );
  }

  const config = tierConfig[result.tier];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-[14px] bg-white dark:bg-[#151B2C] border border-[#E2E8F0] dark:border-white/[0.06] overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.06)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.08),0_12px_32px_rgba(15,23,42,0.06)] transition-shadow duration-300"
    >
      {/* Header band */}
      <div className={`${config.bg} ${config.border} border-b px-6 py-4 flex items-center gap-3`}>
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${config.accent}1A` }}
        >
          <Icon size={18} style={{ color: config.accent }} />
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${config.text}`}>
            {config.label}
          </p>
          {result.triage && (
            <p className="text-sm text-[#0F172A] dark:text-white font-medium capitalize">
              {result.triage.presentingComplaint}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 flex flex-col gap-5">
        {result.tier === 3 && (
          <p className="text-[#0F172A] dark:text-white leading-relaxed font-medium">
            {(result.response as Tier3Response).message}
          </p>
        )}

        {result.tier === 2 && (
          <>
            <div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white mb-1">
                {(result.response as Tier2Response).likelyCondition}
              </h3>
              <p className="text-sm text-[#64748B] dark:text-neutral-400">
                {(result.response as Tier2Response).whySpecialistNeeded}
              </p>
            </div>
            <div className="rounded-[12px] bg-[#F8FAFC] dark:bg-white/[0.03] p-4 border border-[#E2E8F0]/50 dark:border-white/[0.04]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-neutral-500 mb-1">
                Recommended Specialist
              </p>
              <p className="text-sm font-medium text-[#0F172A] dark:text-white">
                {(result.response as Tier2Response).recommendedSpecialist}
              </p>
              <p className="text-sm text-[#64748B] dark:text-neutral-400 mt-1">
                {(result.response as Tier2Response).specialistReason}
              </p>
            </div>
            <InfoList title="Interim Care Steps" items={(result.response as Tier2Response).interimCareSteps} icon={ListChecks} />
            <FirstAidList items={(result.response as Tier2Response).firstAid} />
            <InfoList title="Foods to Eat" items={(result.response as Tier2Response).foodsToEat} icon={Utensils} />
            <InfoList title="Foods to Avoid" items={(result.response as Tier2Response).foodsToAvoid} icon={XCircle} />
            <InfoList title="Watch For" items={(result.response as Tier2Response).emergencyWatchFor} icon={AlertTriangle} />
          </>
        )}

        {result.tier === 1 && (
          <>
            <div>
              <h3 className="text-base font-semibold text-[#0F172A] dark:text-white mb-1">
                {(result.response as Tier1Response).conditionSummary}
              </h3>
              <p className="text-sm text-[#64748B] dark:text-neutral-400">
                {(result.response as Tier1Response).likelyCauses}
              </p>
            </div>
            <InfoList title="Home Remedies" items={(result.response as Tier1Response).homeRemedies} icon={ListChecks} />
            <FirstAidList items={(result.response as Tier1Response).firstAid} />
            {(result.response as Tier1Response).recoveryPlan?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={15} className="text-[#64748B] dark:text-neutral-400" />
                  <h4 className="text-sm font-semibold text-[#0F172A] dark:text-white">Recovery Plan</h4>
                </div>
                <ul className="space-y-1.5 list-none">
                  {(result.response as Tier1Response).recoveryPlan.map((step) => (
                    <li key={step.step} className="text-sm text-[#64748B] dark:text-neutral-400 flex gap-2">
                      <span className="font-medium text-[#0F172A] dark:text-white">{step.step}.</span>
                      {step.instruction}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <InfoList title="Foods to Eat" items={(result.response as Tier1Response).foodsToEat} icon={Utensils} />
            <InfoList title="Foods to Avoid" items={(result.response as Tier1Response).foodsToAvoid} icon={XCircle} />
            <InfoList title="Warning Signs" items={(result.response as Tier1Response).warningSigns} icon={AlertTriangle} />
            <p className="text-xs text-[#64748B] dark:text-neutral-500 bg-[#F8FAFC] dark:bg-white/[0.03] rounded-[10px] p-3">
              {(result.response as Tier1Response).expectedRecoveryTime && (
                <>Expected recovery: {(result.response as Tier1Response).expectedRecoveryTime}. </>
              )}
              {(result.response as Tier1Response).followUpPrompt}
            </p>
          </>
        )}

        {/* Natural language explanation */}
        {result.explanation && (
          <div className="border-t border-[#E2E8F0] dark:border-white/[0.06] pt-4">
            <p className="text-sm text-[#64748B] dark:text-neutral-400 leading-relaxed whitespace-pre-line">
              {result.explanation}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}