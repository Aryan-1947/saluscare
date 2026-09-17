import { supabase } from "../config/supabase.js";
import type { Tier2Response } from "../types/index.js";

export async function buildSpecialistResponse(
  presentingComplaint: string,
  likelyCondition: string,
  whySpecialistNeeded: string
): Promise<Tier2Response> {
  const [specialistRes, safeRemediesRes, foodRes, warningRes] = await Promise.all([
    supabase.from("specialists").select("specialist_type, notes").ilike("symptom_pattern", `%${presentingComplaint}%`).maybeSingle(),
    supabase.from("remedies").select("remedy_text").eq("complaint", presentingComplaint).eq("safe_while_awaiting_care", true),
    supabase.from("food_guidance").select("eat, avoid").eq("complaint", presentingComplaint).maybeSingle(),
    supabase.from("warning_signs").select("signs").eq("complaint", presentingComplaint).maybeSingle(),
  ]);

  if (specialistRes.error) throw new Error(specialistRes.error.message);
  if (safeRemediesRes.error) throw new Error(safeRemediesRes.error.message);
  if (foodRes.error) throw new Error(foodRes.error.message);
  if (warningRes.error) throw new Error(warningRes.error.message);

  return {
    likelyCondition,
    whySpecialistNeeded,
    recommendedSpecialist: specialistRes.data?.specialist_type ?? "General Physician",
    specialistReason: specialistRes.data?.notes ?? "For further evaluation of your symptoms",
    interimCareSteps: (safeRemediesRes.data ?? []).map((r) => r.remedy_text),
    safeHomeRemedies: (safeRemediesRes.data ?? []).map((r) => r.remedy_text),
    foodsToEat: (foodRes.data?.eat as string[]) ?? [],
    foodsToAvoid: (foodRes.data?.avoid as string[]) ?? [],
    precautions: ["This is informational only, not a substitute for professional care"],
    emergencyWatchFor: (warningRes.data?.signs as string[]) ?? [],
  };
}