import { isNegated } from "./negationUtils.ts";

export type DiscriminatorResult = {
  matched: boolean;
  presentingComplaint: string;
  suggestedTier: 1 | 2 | 3;
};

export function chestPainDiscriminator(text: string, symptoms: string[]): DiscriminatorResult {
  const t = text.toLowerCase();
  const hasCrushing = t.includes("crushing") || t.includes("pressure");
  const hasRadiating = t.includes("arm") || t.includes("jaw") || t.includes("shoulder");
  const hasSweating = t.includes("sweating") || t.includes("sweat");
  const mentions = (t.includes("chest pain") && !isNegated(t, "chest pain")) || symptoms.includes("chest_pain");
  if (!mentions) return { matched: false, presentingComplaint: "", suggestedTier: 1 };
  if (hasCrushing || (hasRadiating && hasSweating)) return { matched: true, presentingComplaint: "chest pain (severe)", suggestedTier: 3 };
  if (hasRadiating || hasSweating) return { matched: true, presentingComplaint: "chest pain", suggestedTier: 2 };
  return { matched: true, presentingComplaint: "mild chest discomfort", suggestedTier: 2 };
}

export function breathingDifficultyDiscriminator(text: string, symptoms: string[]): DiscriminatorResult {
  const t = text.toLowerCase();
  const severe = t.includes("cannot breathe") || t.includes("can't breathe") || t.includes("can not breathe") || t.includes("gasping");
  const wheezing = t.includes("wheez");
  const mentions =
    severe ||
    wheezing ||
    (t.includes("breath") && !isNegated(t, "breath")) ||
    symptoms.includes("breathing_difficulty");
  if (!mentions) return { matched: false, presentingComplaint: "", suggestedTier: 1 };
  if (severe) return { matched: true, presentingComplaint: "severe breathing difficulty", suggestedTier: 3 };
  if (wheezing) return { matched: true, presentingComplaint: "breathing difficulty with wheezing", suggestedTier: 2 };
  return { matched: true, presentingComplaint: "mild breathing difficulty", suggestedTier: 2 };
}

export function feverDiscriminator(text: string, symptoms: string[]): DiscriminatorResult {
  const t = text.toLowerCase();
  const mentions = (t.includes("fever") && !isNegated(t, "fever")) || symptoms.includes("fever");
  if (!mentions) return { matched: false, presentingComplaint: "", suggestedTier: 1 };
  const highFever = t.includes("high fever") || t.includes("104") || t.includes("40°");
  const stiffNeck = t.includes("stiff neck");
  const withRash = t.includes("rash") && !isNegated(t, "rash");
  if (highFever && (stiffNeck || withRash)) return { matched: true, presentingComplaint: "high fever with concerning signs", suggestedTier: 3 };
  if (highFever) return { matched: true, presentingComplaint: "high fever", suggestedTier: 2 };
  return { matched: true, presentingComplaint: "mild fever", suggestedTier: 1 };
}

export function rashDiscriminator(text: string, symptoms: string[]): DiscriminatorResult {
  const t = text.toLowerCase();
  const mentions = (t.includes("rash") && !isNegated(t, "rash")) || symptoms.includes("rash");
  if (!mentions) return { matched: false, presentingComplaint: "", suggestedTier: 1 };
  const spreading = t.includes("spreading");
  const withFever = t.includes("fever") && !isNegated(t, "fever");
  const painful = t.includes("painful") || t.includes("blistering");
  if (spreading && withFever) return { matched: true, presentingComplaint: "spreading rash with fever", suggestedTier: 3 };
  if (painful || spreading) return { matched: true, presentingComplaint: "concerning rash", suggestedTier: 2 };
  return { matched: true, presentingComplaint: "rash", suggestedTier: 1 };
}

export function woundDiscriminator(text: string, symptoms: string[]): DiscriminatorResult {
  const t = text.toLowerCase();
  const isBurn = t.includes("burn") || t.includes("burnt") || t.includes("scald");

  // Burns used to be EXCLUDED here (!isBurn gate) and never handled by their
  // own branch, so "burned my hand" only triaged via the LLM fallback. Burns
  // need surface-area/depth assessment, so they now triage explicitly.
  if (isBurn) {
    const burnSevere = t.includes("third degree") || t.includes("3rd degree") ||
      t.includes("charred") || t.includes("large") || t.includes("face") ||
      t.includes("chemical") || t.includes("electrical");
    if (burnSevere) return { matched: true, presentingComplaint: "severe burn", suggestedTier: 3 };
    const blisteringBurn = t.includes("blister") || t.includes("second degree") || t.includes("2nd degree");
    if (blisteringBurn) return { matched: true, presentingComplaint: "blistering burn", suggestedTier: 2 };
    return { matched: true, presentingComplaint: "minor burn", suggestedTier: 1 };
  }

  const mentionsWoundWord =
    (t.includes("cut") || t.includes("wound") || t.includes("laceration") || t.includes("scrape") || t.includes("abrasion") || t.includes("knee") || t.includes("skin")) &&
    !isNegated(t, "cut") &&
    !isNegated(t, "wound");
  const infectionSignsAlone = t.includes("pus") || t.includes("foul odor") || t.includes("red streak");

  const mentions = mentionsWoundWord || infectionSignsAlone;

  if (!mentions && !symptoms.includes("wound")) return { matched: false, presentingComplaint: "", suggestedTier: 1 };
  const deep = t.includes("deep") || t.includes("bone");
  const bleedingHeavy = t.includes("won't stop bleeding") || t.includes("heavy bleeding");
  if (deep || bleedingHeavy) return { matched: true, presentingComplaint: "deep wound", suggestedTier: 3 };
  const infected = t.includes("pus") || t.includes("infected") || t.includes("red streaks");
  if (infected) return { matched: true, presentingComplaint: "infected wound", suggestedTier: 2 };
  return { matched: true, presentingComplaint: "minor cut", suggestedTier: 1 };
}

export function abdominalPainDiscriminator(text: string, symptoms: string[]): DiscriminatorResult {
  const t = text.toLowerCase();
  const mentions = (t.includes("stomach") || t.includes("abdominal") || t.includes("belly")) && !isNegated(t, "stomach") && !isNegated(t, "abdominal");
  if (!mentions && !symptoms.includes("abdominal_pain")) return { matched: false, presentingComplaint: "", suggestedTier: 1 };
  const severe = t.includes("severe") || t.includes("rigid") || t.includes("can't move");
  const vomitingBlood = t.includes("vomiting blood") || t.includes("blood in stool");
  if (severe || vomitingBlood) return { matched: true, presentingComplaint: "severe abdominal pain", suggestedTier: 3 };
  const moderate = t.includes("moderate") || t.includes("persistent");
  if (moderate) return { matched: true, presentingComplaint: "abdominal pain", suggestedTier: 2 };
  return { matched: true, presentingComplaint: "mild abdominal discomfort", suggestedTier: 1 };
}


export function coughDiscriminator(text: string, symptoms: string[]): DiscriminatorResult {
  const t = text.toLowerCase();
  const mentions = (t.includes("cough") && !isNegated(t, "cough")) || symptoms.includes("cough");
  if (!mentions) return { matched: false, presentingComplaint: "", suggestedTier: 1 };

  const severe = t.includes("coughing up blood") || t.includes("blood");
  const withBreathingIssue = (t.includes("breath") && !isNegated(t, "breath")) || t.includes("wheez");
  const persistent = t.includes("week") || t.includes("weeks") || t.includes("persistent") || t.includes("chronic");

  if (severe) return { matched: true, presentingComplaint: "cough with blood", suggestedTier: 3 };
  if (withBreathingIssue || persistent) return { matched: true, presentingComplaint: "persistent cough", suggestedTier: 2 };
  return { matched: true, presentingComplaint: "mild cough", suggestedTier: 1 };
}



export function headacheDiscriminator(text: string, symptoms: string[]): DiscriminatorResult {
  const t = text.toLowerCase();
  const mentions = (t.includes("headache") && !isNegated(t, "headache")) || symptoms.includes("headache");
  if (!mentions) return { matched: false, presentingComplaint: "", suggestedTier: 1 };

  const explicitlySevere =
    t.includes("worst headache") || t.includes("sudden severe headache") || t.includes("thunderclap");
  const withVomiting = t.includes("vomit") || t.includes("throwing up") || t.includes("nausea");
  const withStiffNeckFever = t.includes("stiff neck") && (t.includes("fever") && !isNegated(t, "fever"));
  const withNeuroSigns =
    t.includes("confusion") || t.includes("slurred") || t.includes("vision change") || t.includes("blurred vision");
  const afterInjury = t.includes("head injury") || t.includes("hit my head") || t.includes("head hit");

  if (explicitlySevere || withStiffNeckFever || withNeuroSigns || afterInjury) {
    return { matched: true, presentingComplaint: "severe headache with concerning signs", suggestedTier: 3 };
  }

  if (withVomiting) {
    return { matched: true, presentingComplaint: "headache with vomiting", suggestedTier: 2 };
  }

  return { matched: true, presentingComplaint: "headache", suggestedTier: 1 };
}

export function neckDiscriminator(text: string, symptoms: string[]): DiscriminatorResult {
  const t = text.toLowerCase();
  const mentions = (t.includes("neck") && !isNegated(t, "neck")) || symptoms.includes("neck_pain");
  if (!mentions) return { matched: false, presentingComplaint: "", suggestedTier: 1 };

  const swallowingIssue = t.includes("swallow") || t.includes("drink") || t.includes("water") && t.includes("heavy");
  const swelling = t.includes("swell") || t.includes("swollen");
  const breathingIssue = t.includes("breath") && !isNegated(t, "breath");

  if (breathingIssue || (swallowingIssue && swelling)) {
    return { matched: true, presentingComplaint: "neck pain with swelling and swallowing difficulty", suggestedTier: 3 };
  }
  if (swallowingIssue || swelling) {
    return { matched: true, presentingComplaint: "neck pain with swelling", suggestedTier: 2 };
  }
  return { matched: true, presentingComplaint: "neck pain", suggestedTier: 1 };
}