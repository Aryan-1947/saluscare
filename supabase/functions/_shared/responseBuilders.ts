import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Tier1Response, Tier2Response, Tier3Response, Category, FirstAidItem } from "./types.ts";


async function logUnmatchedQuery(supabase: SupabaseClient, complaintText: string, category: Category) {
  const { data: existing } = await supabase
    .from("unmatched_queries")
    .select("id, occurrence_count")
    .eq("raw_text", complaintText)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("unmatched_queries")
      .update({ occurrence_count: existing.occurrence_count + 1, last_seen: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("unmatched_queries").insert({
      raw_text: complaintText,
      guessed_category: category,
    });
  }
}

export function buildEmergencyResponse(matchedPattern: string): Tier3Response {
  return {
    message:
      "This looks like it may be a medical emergency. Please seek emergency care immediately - call your local emergency number or go to the nearest emergency room now. Do not wait to see if it improves.",
    matchedRedFlag: matchedPattern,
  };
}

async function fetchComplaintData(supabase: SupabaseClient, complaint: string) {
  const [remediesRes, recoveryRes, foodRaw, warningRaw, metaRaw] = await Promise.all([
    supabase.from("remedies").select("remedy_text, remedy_type, precaution, safe_while_awaiting_care").eq("complaint", complaint),
    supabase.from("recovery_plans").select("step_number, instruction").eq("complaint", complaint).order("step_number"),
    supabase.from("food_guidance").select("eat, avoid").eq("complaint", complaint).limit(1),
    supabase.from("warning_signs").select("signs").eq("complaint", complaint).limit(1),
    supabase.from("complaint_meta").select("likely_causes, expected_recovery_time, why_specialist_needed").eq("complaint", complaint).limit(1),
  ]);
  const foodRes = { data: foodRaw.data?.[0] ?? null, error: foodRaw.error };
  const warningRes = { data: warningRaw.data?.[0] ?? null, error: warningRaw.error };
  const metaRes = { data: metaRaw.data?.[0] ?? null, error: metaRaw.error };
  return { remediesRes, recoveryRes, foodRes, warningRes, metaRes };
}

async function fetchCategoryData(supabase: SupabaseClient, category: Category) {
  // Category fallback rows are deliberately seeded with complaint === category slug (the generic bucket),
  // so we query by complaint here, not category, to avoid pulling in unrelated specific-complaint rows
  // that merely share the same category tag (e.g. "neck pain" also tagged musculoskeletal).
  const [remediesRes, recoveryRes, foodRaw, warningRaw, metaRaw] = await Promise.all([
    supabase.from("remedies").select("remedy_text, remedy_type, precaution, safe_while_awaiting_care").eq("complaint", category),
    supabase.from("recovery_plans").select("step_number, instruction").eq("complaint", category).order("step_number"),
    supabase.from("food_guidance").select("eat, avoid").eq("complaint", category).limit(1),
    supabase.from("warning_signs").select("signs").eq("complaint", category).limit(1),
    supabase.from("complaint_meta").select("likely_causes, expected_recovery_time, why_specialist_needed").eq("complaint", category).limit(1),
  ]);
  const foodRes = { data: foodRaw.data?.[0] ?? null, error: foodRaw.error };
  const warningRes = { data: warningRaw.data?.[0] ?? null, error: warningRaw.error };
  const metaRes = { data: metaRaw.data?.[0] ?? null, error: metaRaw.error };
  return { remediesRes, recoveryRes, foodRes, warningRes, metaRes };
}

function splitRemedies(rows: { remedy_text: string; remedy_type: string; precaution: string | null }[] | null) {
  const homeRemedies = (rows ?? []).filter((r) => r.remedy_type !== "first_aid").map((r) => r.remedy_text);
  const firstAid: FirstAidItem[] = (rows ?? [])
    .filter((r) => r.remedy_type === "first_aid")
    .map((r) => ({ text: r.remedy_text, precaution: r.precaution ?? null }));
  return { homeRemedies, firstAid };
}

export async function buildSelfCareResponse(
  supabase: SupabaseClient,
  presentingComplaint: string,
  category: Category
): Promise<Tier1Response> {
  let data = await fetchComplaintData(supabase, presentingComplaint);
  let usedCategoryFallback = false;

  const hasExactData = (data.remediesRes.data?.length ?? 0) > 0 || data.metaRes.data !== null;
  if (!hasExactData) {
    data = await fetchCategoryData(supabase, category);
    usedCategoryFallback = true;
    await logUnmatchedQuery(supabase, presentingComplaint, category);
  }



  const { remediesRes, recoveryRes, foodRes, warningRes, metaRes } = data;
  if (remediesRes.error) throw new Error(remediesRes.error.message);
  if (recoveryRes.error) throw new Error(recoveryRes.error.message);
  if (foodRes.error) throw new Error(foodRes.error.message);
  if (warningRes.error) throw new Error(warningRes.error.message);
  if (metaRes.error) throw new Error(metaRes.error.message);

  const { homeRemedies, firstAid } = splitRemedies(remediesRes.data);

  const stillNoData = (remediesRes.data?.length ?? 0) === 0 && metaRes.data === null;

  return {
    conditionSummary: `This looks like a ${presentingComplaint}`,
    likelyCauses: metaRes.data?.likely_causes ?? "Cause not yet documented for this complaint - consult a doctor if concerned",
    homeRemedies,
    firstAid,
    recoveryPlan: (recoveryRes.data ?? []).map((r: any) => ({ step: r.step_number, instruction: r.instruction })),
    foodsToEat: (foodRes.data?.eat as string[]) ?? [],
    foodsToAvoid: (foodRes.data?.avoid as string[]) ?? [],
    thingsToAvoid: [],
    expectedRecoveryTime: metaRes.data?.expected_recovery_time ?? "Varies - monitor and consult a doctor if not improving",
    warningSigns: (warningRes.data?.signs as string[]) ?? [],
    followUpPrompt:
      "If these remedies don't help, your symptoms worsen, or new symptoms appear, come back and tell me exactly how your condition has changed. I'll reassess based on your updated symptoms and guide you on the safest next step.",
    usedCategoryFallback,
    needsWebSearchGrounding: stillNoData,
  };
}

export async function buildSpecialistResponse(
  supabase: SupabaseClient,
  presentingComplaint: string,
  category: Category
): Promise<Tier2Response> {
  let data = await fetchComplaintData(supabase, presentingComplaint);
  let usedCategoryFallback = false;

  const hasExactData = (data.remediesRes.data?.length ?? 0) > 0 || data.metaRes.data !== null;
  if (!hasExactData) {
    data = await fetchCategoryData(supabase, category);
    usedCategoryFallback = true;
    await logUnmatchedQuery(supabase, presentingComplaint, category);
  }



  const { remediesRes, foodRes, warningRes, metaRes } = data;
  if (remediesRes.error) throw new Error(remediesRes.error.message);
  if (foodRes.error) throw new Error(foodRes.error.message);
  if (warningRes.error) throw new Error(warningRes.error.message);
  if (metaRes.error) throw new Error(metaRes.error.message);

  // Per architecture safety rule: Tier 2 remedies must be filtered to safe_while_awaiting_care = true only,
  // a distinct, stricter subset from Tier 1's full remedy list.
  const safeRows = (remediesRes.data ?? []).filter(
    (r: any) => r.remedy_type !== "first_aid" && r.safe_while_awaiting_care === true
  );
  const firstAidRows = (remediesRes.data ?? []).filter(
    (r: any) => r.remedy_type === "first_aid" && r.safe_while_awaiting_care === true
  );
  const firstAid: FirstAidItem[] = firstAidRows.map((r: any) => ({
    text: r.remedy_text,
    precaution: r.precaution ?? null,
  }));

  const specialistRes = await supabase
    .from("specialists")
    .select("specialist_type, notes")
    .ilike("symptom_pattern", `%${presentingComplaint}%`)
    .limit(1);

  if (specialistRes.error) throw new Error(specialistRes.error.message);
  const specialistRow = specialistRes.data?.[0] ?? null;

  if (!specialistRow) {
    await logUnmatchedQuery(supabase, presentingComplaint, category);
  }

  const stillNoData = (remediesRes.data?.length ?? 0) === 0 && metaRes.data === null;

  return {
    likelyCondition: presentingComplaint,
    whySpecialistNeeded: metaRes.data?.why_specialist_needed ?? "Your symptoms suggest professional evaluation would be safer than self-care alone",
    recommendedSpecialist: specialistRow?.specialist_type ?? "General Physician",
    specialistReason: specialistRow?.notes ?? "For further evaluation of your symptoms",
    interimCareSteps: safeRows.map((r: any) => r.remedy_text),
    safeHomeRemedies: safeRows.map((r: any) => r.remedy_text),
    firstAid,
    foodsToEat: (foodRes.data?.eat as string[]) ?? [],
    foodsToAvoid: (foodRes.data?.avoid as string[]) ?? [],
    precautions: ["This is informational only, not a substitute for professional care"],
    emergencyWatchFor: (warningRes.data?.signs as string[]) ?? [],
    usedCategoryFallback,
    needsWebSearchGrounding: stillNoData,
  };
}