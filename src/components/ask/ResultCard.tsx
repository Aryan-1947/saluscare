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
  PhoneCall,
  MapPin,
} from "lucide-react";
import type { AssessmentResult, Tier1Response, Tier2Response, Tier3Response } from "@/types/api";

/**
 * Emergency actions for Tier 3 cards. `tel:` opens the phone's dialer and the
 * maps link is a plain Google Maps search - both work with no API keys.
 * The number is the India national emergency line; adjust per region if the
 * product is deployed elsewhere.
 */
const EMERGENCY_NUMBER = "112";
const NEARBY_HOSPITALS_URL = "https://www.google.com/maps/search/hospital+emergency+near+me";

const tierConfig = {
  1: {
    label: "Self Care",
    icon: ShieldCheck,
    accent: "#15803D",
    bg: "bg-[#F0FDF4] dark:bg-[#15803D]/10",
    border: "border-[#BBF7D0] dark:border-[#15803D]/25",
    text: "text-[#15803D] dark:text-[#4ADE80]",
  },
  2: {
    label: "Specialist Referral",
    icon: Stethoscope,
    accent: "#B45309",
    bg: "bg-[#FFFBEB] dark:bg-[#B45309]/10",
    border: "border-[#FDE68A] dark:border-[#B45309]/25",
    text: "text-[#B45309] dark:text-[#FBBF24]",
  },
  3: {
    label: "Emergency Care",
    icon: Siren,
    accent: "#DC2626",
    bg: "bg-[#FEF2F2] dark:bg-[#DC2626]/10",
    border: "border-[#FECACA] dark:border-[#DC2626]/25",
    text: "text-[#DC2626] dark:text-[#F87171]",
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
        <Icon size={15} className="text-[#57534E] dark:text-[#A8A29E]" />
        <h4 className="text-sm font-semibold text-[#1A1613] dark:text-[#EDE8E2]">{title}</h4>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-[#57534E] dark:text-[#A8A29E] pl-4 relative">
            <span className="absolute left-0 top-2 w-1 h-1 rounded-full bg-[#A8A29E]" />
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
        <Plus size={15} className="text-[#B45309]" />
        <h4 className="text-sm font-semibold text-[#1A1613] dark:text-[#EDE8E2]">First Aid</h4>
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <div key={i} className="rounded-[8px] bg-[#F5F0E8] dark:bg-white/[0.04] border border-[#E7E0D8] dark:border-[#322D28] p-3">
            <p className="text-sm text-[#1A1613] dark:text-[#EDE8E2]">{item.text}</p>
            {item.precaution && (
              <div className="flex items-start gap-1.5 mt-1.5 pt-1.5 border-t border-[#E7E0D8] dark:border-[#322D28]">
                <Info size={12} className="text-[#B45309] mt-0.5 shrink-0" />
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">{item.precaution}</p>
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
    result.tier !== 3 &&
    "needsWebSearchGrounding" in result.response &&
    result.response.needsWebSearchGrounding === true;

  if (isUnseededFallback) {
    return (
      <div className="max-w-[80%] rounded-[10px] rounded-bl-[4px] bg-white dark:bg-[#211D1A] border border-[#E7E0D8] dark:border-[#322D28] text-[#1A1613] dark:text-[#EDE8E2] px-4 py-2.5 text-sm leading-relaxed">
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
      className="max-w-[85%] rounded-[10px] bg-white dark:bg-[#211D1A] border border-[#E7E0D8] dark:border-[#322D28] overflow-hidden shadow-[0_1px_2px_rgba(26,22,19,0.05)] hover:shadow-[0_4px_12px_rgba(26,22,19,0.09)] transition-shadow duration-300"
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
            <p className="text-sm text-[#1A1613] dark:text-[#EDE8E2] font-medium capitalize">
              {result.triage.presentingComplaint}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 flex flex-col gap-5">
        {result.tier === 3 && (
          <>
            <p className="text-[#1A1613] dark:text-[#EDE8E2] leading-relaxed font-medium">
              {(result.response as Tier3Response).message}
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <a
                href={`tel:${EMERGENCY_NUMBER}`}
                className="flex-1 flex items-center justify-center gap-2 rounded-[8px] bg-[#DC2626] hover:bg-[#B91C1C] text-white px-5 py-3 text-sm font-semibold transition-colors"
              >
                <PhoneCall size={16} />
                Call {EMERGENCY_NUMBER} now
              </a>
              <a
                href={NEARBY_HOSPITALS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 rounded-[8px] border border-[#DC2626]/40 text-[#DC2626] dark:text-[#F87171] px-5 py-3 text-sm font-semibold hover:bg-[#FEF2F2] dark:hover:bg-[#DC2626]/10 transition-colors"
              >
                <MapPin size={16} />
                Nearest hospital
              </a>
            </div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
              The call button opens your phone's dialer; the hospital button opens
              Google Maps with emergency departments near your location.
            </p>
          </>
        )}

        {result.tier === 2 && (
          <>
            <div>
              <h3 className="text-base font-bold text-[#1A1613] dark:text-[#EDE8E2] mb-1">
                {(result.response as Tier2Response).likelyCondition}
              </h3>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E]">
                {(result.response as Tier2Response).whySpecialistNeeded}
              </p>
            </div>
            <div className="rounded-[12px] bg-[#F5F0E8] dark:bg-white/[0.04] p-4 border border-[#E7E0D8]/70 dark:border-[#322D28]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#57534E] dark:text-[#A8A29E] mb-1">
                Recommended Specialist
              </p>
              <p className="text-sm font-medium text-[#1A1613] dark:text-[#EDE8E2]">
                {(result.response as Tier2Response).recommendedSpecialist}
              </p>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">
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
              <h3 className="text-base font-semibold text-[#1A1613] dark:text-[#EDE8E2] mb-1">
                {(result.response as Tier1Response).conditionSummary}
              </h3>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E]">
                {(result.response as Tier1Response).likelyCauses}
              </p>
            </div>
            <InfoList title="Home Remedies" items={(result.response as Tier1Response).homeRemedies} icon={ListChecks} />
            <FirstAidList items={(result.response as Tier1Response).firstAid} />
            {(result.response as Tier1Response).recoveryPlan?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={15} className="text-[#57534E] dark:text-[#A8A29E]" />
                  <h4 className="text-sm font-semibold text-[#1A1613] dark:text-[#EDE8E2]">Recovery Plan</h4>
                </div>
                <ul className="space-y-1.5 list-none">
                  {(result.response as Tier1Response).recoveryPlan.map((step) => (
                    <li key={step.step} className="text-sm text-[#57534E] dark:text-[#A8A29E] flex gap-2">
                      <span className="font-medium text-[#1A1613] dark:text-[#EDE8E2]">{step.step}.</span>
                      {step.instruction}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <InfoList title="Foods to Eat" items={(result.response as Tier1Response).foodsToEat} icon={Utensils} />
            <InfoList title="Foods to Avoid" items={(result.response as Tier1Response).foodsToAvoid} icon={XCircle} />
            <InfoList title="Warning Signs" items={(result.response as Tier1Response).warningSigns} icon={AlertTriangle} />
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] bg-[#F5F0E8] dark:bg-white/[0.04] rounded-[10px] p-3">
              {(result.response as Tier1Response).expectedRecoveryTime && (
                <>Expected recovery: {(result.response as Tier1Response).expectedRecoveryTime}. </>
              )}
              {(result.response as Tier1Response).followUpPrompt}
            </p>
          </>
        )}

        {/* Natural language explanation */}
        {result.explanation && (
          <div className="border-t border-[#E7E0D8] dark:border-[#322D28] pt-4">
            <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed whitespace-pre-line">
              {result.explanation}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}