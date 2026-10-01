import { supabase } from "../config/supabase.js";
import type { Tier1Response } from "../types/index.js";

export async function buildSelfCareResponse(
  presentingComplaint: string,
  conditionSummary: string,
  likelyCauses: string
): Promise<Tier1Response> {
  const [remediesRes, recoveryRes, foodRes, warningRes] = await Promise.all([
    supabase.from("remedies").select("remedy_text").eq("complaint", presentingComplaint),
    supabase.from("recovery_plans").select("step_number, instruction").eq("complaint", presentingComplaint).order("step_number"),
    supabase.from("food_guidance").select("eat, avoid").eq("complaint", presentingComplaint).maybeSingle(),
    supabase.from("warning_signs").select("signs").eq("complaint", presentingComplaint).maybeSingle(),
  ]);

  if (remediesRes.error) throw new Error(remediesRes.error.message);
  if (recoveryRes.error) throw new Error(recoveryRes.error.message);
  if (foodRes.error) throw new Error(foodRes.error.message);
  if (warningRes.error) throw new Error(warningRes.error.message);

  return {
    conditionSummary,
    likelyCauses,
    homeRemedies: (remediesRes.data ?? []).map((r) => r.remedy_text),
    recoveryPlan: (recoveryRes.data ?? []).map((r) => ({
      step: r.step_number,
      instruction: r.instruction,
    })),
    foodsToEat: (foodRes.data?.eat as string[]) ?? [],
    foodsToAvoid: (foodRes.data?.avoid as string[]) ?? [],
    thingsToAvoid: [],
    expectedRecoveryTime: "2-3 days",
    warningSigns: (warningRes.data?.signs as string[]) ?? [],
    followUpPrompt:
      "If these remedies don't help, your symptoms worsen, or new symptoms appear, come back and tell me exactly how your condition has changed. I'll reassess based on your updated symptoms and guide you on the safest next step.",
  };
}