import { supabase } from "../config/supabase.js";

export type RedFlagMatch = {
  matched: boolean;
  pattern?: string;
  complaintArea?: string;
};

export async function checkRedFlags(
  text: string | undefined,
  visualFindings: string | undefined
): Promise<RedFlagMatch> {
  const { data: redFlags, error } = await supabase
    .from("red_flags")
    .select("pattern, complaint_area, applies_to");

  if (error) {
    throw new Error(`Failed to load red flags: ${error.message}`);
  }

  const normalizedText = (text ?? "").toLowerCase();
  const normalizedVisual = (visualFindings ?? "").toLowerCase();

  for (const flag of redFlags ?? []) {
    const pattern = flag.pattern.toLowerCase();

    const checkText = flag.applies_to === "both" || flag.applies_to === "text";
    const checkVisual = flag.applies_to === "both" || flag.applies_to === "image";

    if (checkText && normalizedText.includes(pattern)) {
      return { matched: true, pattern: flag.pattern, complaintArea: flag.complaint_area };
    }

    if (checkVisual && normalizedVisual.includes(pattern)) {
      return { matched: true, pattern: flag.pattern, complaintArea: flag.complaint_area };
    }
  }

  return { matched: false };
}