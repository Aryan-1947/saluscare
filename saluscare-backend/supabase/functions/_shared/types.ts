export type Tier = 1 | 2 | 3;

export type TriageResult = {
  tier: Tier;
  confidence: number;
  matchedDiscriminators: string[];
  presentingComplaint: string;
};

export type Tier1Response = {
  conditionSummary: string;
  likelyCauses: string;
  homeRemedies: string[];
  firstAid: FirstAidItem[];
  recoveryPlan: { step: number; instruction: string }[];
  foodsToEat: string[];
  foodsToAvoid: string[];
  thingsToAvoid: string[];
  expectedRecoveryTime: string;
  warningSigns: string[];
  followUpPrompt: string;
  usedCategoryFallback: boolean;
  needsWebSearchGrounding: boolean;
};

export type Tier2Response = {
  likelyCondition: string;
  whySpecialistNeeded: string;
  recommendedSpecialist: string;
  specialistReason: string;
  interimCareSteps: string[];
  safeHomeRemedies: string[];
  firstAid: FirstAidItem[];
  foodsToEat: string[];
  foodsToAvoid: string[];
  precautions: string[];
  emergencyWatchFor: string[];
  usedCategoryFallback: boolean;
  needsWebSearchGrounding: boolean;
};

export type Tier3Response = {
  message: string;
  matchedRedFlag: string;
};

export type Category =
  | "respiratory" | "digestive" | "skin" | "musculoskeletal" | "reproductive"
  | "neurological" | "sleep" | "injury" | "general_infection" | "mental_wellbeing"
  | "urinary" | "dental_oral" | "eye" | "ear" | "allergy" | "fatigue"
  | "hair_scalp" | "cardiovascular_lifestyle";

export type ExtractedSymptoms = {
  symptoms: string[];
  presentingComplaint: string;
  duration: string | null;
  severity: "mild" | "moderate" | "severe" | "unknown";
  category: Category;
  sufficient: boolean;
  clarifyingQuestion: string | null;
  isChild: boolean;
  isElderly: boolean;
  isPregnant: boolean;
  rawText: string;
};

export type FirstAidItem = {
  text: string;
  precaution: string | null;
};