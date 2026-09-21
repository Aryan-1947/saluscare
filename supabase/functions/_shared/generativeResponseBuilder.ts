import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import Groq from "npm:groq-sdk@1";
import type { Tier1Response, Tier2Response, ExtractedSymptoms } from "./types.ts";
import { withJsonRetry } from "./jsonRetry.ts";

async function fetchGroundingData(supabase: SupabaseClient, extracted: ExtractedSymptoms) {
  const [specialistRes, principlesRes, medicationRes, precautionRes] = await Promise.all([
    supabase.from("specialist_mapping").select("*").eq("category", extracted.category).maybeSingle(),
    supabase.from("category_principles").select("*").eq("category", extracted.category).maybeSingle(),
    supabase.from("medication_policy").select("*"),
    supabase.from("precaution_rules").select("*"),
  ]);

  const relevantMeds = (medicationRes.data ?? []).filter(
    (m: any) => !m.allowed_for_categories || m.allowed_for_categories.length === 0 || m.allowed_for_categories.includes(extracted.category)
  );

  const applicablePrecautions = (precautionRes.data ?? []).filter((p: any) => {
    if (p.rule_type === "general") return true;
    if (p.rule_type === "age_child" && extracted.isChild) return true;
    if (p.rule_type === "age_elderly" && extracted.isElderly) return true;
    if (p.rule_type === "pregnancy" && extracted.isPregnant) return true;
    return false;
  });

  return {
    specialist: specialistRes.data,
    principles: principlesRes.data,
    medications: relevantMeds,
    precautions: applicablePrecautions.map((p: any) => p.precaution_text),
  };
}

const GENERATIVE_SYSTEM_PROMPT = `You are a senior triage physician assistant generating a structured self-care or specialist-referral response for a patient. You reason from your medical knowledge, but you are STRICTLY GROUNDED and CONSTRAINED by the reusable rules given to you.

HARD SAFETY RULES - NEVER VIOLATE THESE:
- NEVER name or suggest a prescription-only medication, antibiotic, or controlled substance, under any circumstance.
- You may ONLY name medications that appear in the provided "allowedMedications" list, AND only if it is genuinely relevant to the patient's actual specific symptoms described - not merely because it's tagged as allowed for their general category. For example, an antihistamine is only relevant if there's an actual allergic reaction, itching, or hives - not for a burn, a cut, or general skin irritation. If nothing in the list is truly relevant to what the patient described, return an empty firstAid array rather than including something loosely related.
- NEVER suggest a dosage beyond "taken as directed on the package" - never give a specific mg amount or frequency.
- NEVER state a diagnosis with certainty. Always use "likely," "appears to be," "consistent with."
- You MUST apply every precaution in the "applicablePrecautions" list if it is relevant to your response (e.g. if a pregnancy precaution is present, do not name any medication at all and advise consulting a doctor instead).
- Base your reasoning on the "categoryPrinciples" grounding (general approach, common safe measures, escalation triggers) - do not contradict it.
- If tier is 2 (specialist referral), use the "specialistMapping" grounding for which specialist type to recommend and why.
- Everything you generate must be genuinely safe, general, non-prescriptive self-care or first-aid guidance appropriate to a layperson, not clinical treatment.

Respond ONLY with valid JSON. For Tier 1 (self-care), use this shape:
{
  "conditionSummary": string (e.g. "This looks like a likely muscle strain"),
  "likelyCauses": string (1 sentence, general, hedged),
  "homeRemedies": string[] (3-5 specific, safe, non-pharmacological self-care actions tailored to the actual symptoms described),
  "firstAid": [{ "text": string, "precaution": string | null }] (0-2 items, ONLY from allowedMedications list, or empty array if none apply),
  "recoveryPlan": [{ "step": number, "instruction": string }] (3-4 sequential steps - write each instruction in natural language; never reference internal field names like "firstAid" or "homeRemedies" in the instruction text itself, describe the actual action instead),
  "foodsToEat": string[] (2-4 items),
  "foodsToAvoid": string[] (2-4 items),
  "expectedRecoveryTime": string,
  "warningSigns": string[] (3-5 items, specific to this situation, drawing from the category's escalation triggers),
  "followUpPrompt": string (always: "If these remedies don't help, your symptoms worsen, or new symptoms appear, come back and tell me exactly how your condition has changed. I'll reassess based on your updated symptoms and guide you on the safest next step.")
}

For Tier 2 (specialist referral), use this shape:
{
  "likelyCondition": string,
  "whySpecialistNeeded": string (1-2 sentences, specific to this case),
  "recommendedSpecialist": string (from specialistMapping),
  "specialistReason": string (from specialistMapping's reason, adapted to this case),
  "interimCareSteps": string[] (3-4 safe things to do while awaiting the appointment),
  "safeHomeRemedies": string[] (same as interimCareSteps or a subset),
  "firstAid": [{ "text": string, "precaution": string | null }] (0-2 items, ONLY from allowedMedications list),
  "foodsToEat": string[],
  "foodsToAvoid": string[],
  "emergencyWatchFor": string[] (3-5 items, specific escalation signs for this case)
}`;

export async function generateTierResponse(
  supabase: SupabaseClient,
  groq: Groq,
  extracted: ExtractedSymptoms,
  tier: 1 | 2
): Promise<Tier1Response | Tier2Response> {
  const grounding = await fetchGroundingData(supabase, extracted);

  const userPayload = {
    patientSituation: {
      rawText: extracted.rawText,
      presentingComplaint: extracted.presentingComplaint,
      symptoms: extracted.symptoms,
      duration: extracted.duration,
      severity: extracted.severity,
    },
    tier,
    categoryPrinciples: grounding.principles,
    specialistMapping: grounding.specialist,
    allowedMedications: grounding.medications.map((m: any) => ({
      name: m.drug_name,
      type: m.drug_type,
      guidance: m.standard_guidance,
      contraindications: m.contraindications,
    })),
    applicablePrecautions: grounding.precautions,
  };

  // Transient Groq "json_validate_failed" failures retry once instead of
  // surfacing as a raw 500 after the user's message was already logged.
  const parsed = await withJsonRetry(
    () =>
      groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: GENERATIVE_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        temperature: 0.3,
        max_tokens: 1400,
        response_format: { type: "json_object" },
      }),
    (raw) => JSON.parse(raw),
    () => ({})
  );

  // Safety net: strip any first-aid item that wasn't actually in our allowed medication list,
  // and always overwrite the precaution with our verified database text (never trust the model's own wording).
  const sanitizedFirstAid = (parsed.firstAid ?? [])
    .map((item: any) => {
      const matched = grounding.medications.find((m: any) =>
        item.text?.toLowerCase().includes(m.drug_name.toLowerCase().split(" ")[0].toLowerCase())
      );
      if (!matched) return null;
      return {
        text: item.text,
        precaution: matched.contraindications,
      };
    })
    .filter((item: any) => item !== null);

  if (tier === 1) {
    return {
      conditionSummary: parsed.conditionSummary ?? `This looks like a ${extracted.presentingComplaint}`,
      likelyCauses: parsed.likelyCauses ?? "The exact cause isn't clear from the description alone.",
      homeRemedies: parsed.homeRemedies ?? [],
      firstAid: sanitizedFirstAid,
      recoveryPlan: parsed.recoveryPlan ?? [],
      foodsToEat: parsed.foodsToEat ?? [],
      foodsToAvoid: parsed.foodsToAvoid ?? [],
      thingsToAvoid: [],
      expectedRecoveryTime: parsed.expectedRecoveryTime ?? "Varies - monitor and consult a doctor if not improving",
      warningSigns: parsed.warningSigns ?? [],
      followUpPrompt:
        parsed.followUpPrompt ??
        "If these remedies don't help, your symptoms worsen, or new symptoms appear, come back and tell me exactly how your condition has changed. I'll reassess based on your updated symptoms and guide you on the safest next step.",
      usedCategoryFallback: false,
      needsWebSearchGrounding: false,
    };
  }

  return {
    likelyCondition: parsed.likelyCondition ?? extracted.presentingComplaint,
    whySpecialistNeeded: parsed.whySpecialistNeeded ?? "Your symptoms suggest professional evaluation would be safer than self-care alone",
    recommendedSpecialist: parsed.recommendedSpecialist ?? grounding.specialist?.specialist_type ?? "General Physician",
    specialistReason: parsed.specialistReason ?? grounding.specialist?.reason_template ?? "For further evaluation of your symptoms",
    interimCareSteps: parsed.interimCareSteps ?? [],
    safeHomeRemedies: parsed.safeHomeRemedies ?? parsed.interimCareSteps ?? [],
    firstAid: sanitizedFirstAid,
    foodsToEat: parsed.foodsToEat ?? [],
    foodsToAvoid: parsed.foodsToAvoid ?? [],
    precautions: ["This is informational only, not a substitute for professional care"],
    emergencyWatchFor: parsed.emergencyWatchFor ?? [],
    usedCategoryFallback: false,
    needsWebSearchGrounding: false,
  };
}