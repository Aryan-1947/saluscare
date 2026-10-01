export type UserInput = {
  text?: string;
  imageUrl?: string;
  sessionId: string;
};

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
  recoveryPlan: { step: number; instruction: string }[];
  foodsToEat: string[];
  foodsToAvoid: string[];
  thingsToAvoid: string[];
  expectedRecoveryTime: string;
  warningSigns: string[];
  followUpPrompt: string;
};

export type Tier2Response = {
  likelyCondition: string;
  whySpecialistNeeded: string;
  recommendedSpecialist: string;
  specialistReason: string;
  interimCareSteps: string[];
  safeHomeRemedies: string[];
  foodsToEat: string[];
  foodsToAvoid: string[];
  precautions: string[];
  emergencyWatchFor: string[];
};

export type Tier3Response = {
  message: string;
  matchedRedFlag: string;
};

export type ChangeType = "improved" | "unchanged" | "worsened" | "new_red_flag";