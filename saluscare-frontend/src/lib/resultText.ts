import type { AssessmentResult, Tier1Response, Tier2Response, Tier3Response } from "@/types/api";

/** Flattens an assessment result into readable plain text for copy-to-clipboard. */
export function resultToPlainText(result: AssessmentResult): string {
  const lines: string[] = [];
  const tierLabel =
    result.tier === 3 ? "Emergency Care" : result.tier === 2 ? "Specialist Referral" : "Self Care";
  lines.push(`[${tierLabel}]`);
  if (result.triage?.presentingComplaint) lines.push(`Complaint: ${result.triage.presentingComplaint}`);

  const r = result.response as Tier1Response | Tier2Response | Tier3Response;
  if (result.tier === 3) {
    lines.push((r as Tier3Response).message);
  } else if (result.tier === 2) {
    const t2 = r as Tier2Response;
    lines.push(`${t2.likelyCondition} - ${t2.whySpecialistNeeded}`);
    lines.push(`Specialist: ${t2.recommendedSpecialist} (${t2.specialistReason})`);
    if (t2.interimCareSteps?.length) lines.push(`Interim care: ${t2.interimCareSteps.join("; ")}`);
    if (t2.firstAid?.length) lines.push(`First aid: ${t2.firstAid.map((f) => f.text).join("; ")}`);
    if (t2.foodsToEat?.length) lines.push(`Foods to eat: ${t2.foodsToEat.join(", ")}`);
    if (t2.foodsToAvoid?.length) lines.push(`Foods to avoid: ${t2.foodsToAvoid.join(", ")}`);
    if (t2.emergencyWatchFor?.length) lines.push(`Watch for: ${t2.emergencyWatchFor.join("; ")}`);
  } else {
    const t1 = r as Tier1Response;
    lines.push(`${t1.conditionSummary} - ${t1.likelyCauses}`);
    if (t1.homeRemedies?.length) lines.push(`Home remedies: ${t1.homeRemedies.join("; ")}`);
    if (t1.firstAid?.length) lines.push(`First aid: ${t1.firstAid.map((f) => f.text).join("; ")}`);
    if (t1.recoveryPlan?.length)
      lines.push(`Recovery plan: ${t1.recoveryPlan.map((s) => `${s.step}. ${s.instruction}`).join(" ")}`);
    if (t1.foodsToEat?.length) lines.push(`Foods to eat: ${t1.foodsToEat.join(", ")}`);
    if (t1.foodsToAvoid?.length) lines.push(`Foods to avoid: ${t1.foodsToAvoid.join(", ")}`);
    if (t1.warningSigns?.length) lines.push(`Warning signs: ${t1.warningSigns.join("; ")}`);
    if (t1.expectedRecoveryTime) lines.push(`Expected recovery: ${t1.expectedRecoveryTime}`);
  }
  if (result.explanation) lines.push("", result.explanation);
  return lines.join("\n");
}
