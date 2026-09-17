export type Tier = 1 | 2 | 3;

export type TriageResult = {
  tier: Tier;
  confidence: number;
  matchedDiscriminators: string[];
  presentingComplaint: string;
};

export type FirstAidItem = {
  text: string;
  precaution: string | null;
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

export type AssessmentResult = {
  sessionId: string;
  tier: Tier;
  triage: TriageResult | null;
  response: Tier1Response | Tier2Response | Tier3Response;
  explanation?: string;
  visualFindings?: string;
};

export type ImageClarificationResult = {
  sessionId: string;
  needsClarification: true;
  clarifyingQuestion: string;
  imageUrl: string;
  imageContext?: string;
};

export type TextClarificationResult = {
  sessionId: string;
  needsClarification: true;
  clarifyingQuestion: string;
};

export type GeneralAnswerResult = {
  sessionId: string;
  isGeneralAnswer: true;
  answer: string;
};

export type HistoryTurn = {
  role: "user" | "assistant";
  kind: "text" | "image" | "question" | "answer" | "result";
  content: string | null;
  imageUrl: string | null;
  result: unknown;
  createdAt?: string;
};

export type FollowupSummary = {
  sessionId: string;
  complaintText: string | null;
  tier: number;
  createdAt: string;
};

export type FollowupsResponse = {
  followups: FollowupSummary[];
};

export type HistoryResponse = {
  groupId: string;
  turns: HistoryTurn[];
};