// Deterministic guard for follow-up routing.
//
// classifyFollowupMessage() asks an LLM to label a follow-up as
// "symptom_update" or "general_question", but clear guidance questions
// ("can I really not eat fried foods?") occasionally get misread as symptom
// reports, which forces an unnecessary full re-assessment. These patterns
// short-circuit the classifier: any hit routes to the conversational agent.
//
// Deliberately conservative: first-person question frames only, and the
// question-mark heuristic requires an advice topic (food/activity/medicine)
// while excluding messages that report deterioration. Red-flag checks still
// run BEFORE classification in session-followup, so safety is unaffected.
// Pure + unit-tested (kept SDK-free so vitest can import it directly).

const GUIDANCE_QUESTION_SIGNALS = [
  "can i",
  "can't i",
  "cant i",
  "i can really not",
  "i really can't",
  "i really cant",
  "should i",
  "shouldn't i",
  "shouldnt i",
  "is it ok",
  "is it okay",
  "is it safe",
  "is it fine",
  "is it true",
  "am i allowed",
  "do i have to",
  "do i need to",
  "can you tell me",
];

const ADVICE_TOPIC_WORDS = [
  "eat",
  "food",
  "foods",
  "fried",
  "fatty",
  "spicy",
  "drink",
  "tea",
  "coffee",
  "alcohol",
  "exercise",
  "gym",
  "workout",
  "walk",
  "run",
  "swim",
  "sleep",
  "bath",
  "shower",
  "medicine",
  "medication",
  "supplement",
];

const DETERIORATION_WORDS = [
  "worse",
  "worsening",
  "severe",
  "unbearable",
  "blood",
  "fever",
  "vomit",
  "spreading",
  "swelling",
  "dizzy",
  "faint",
];

export function looksLikeGuidanceQuestion(text: string): boolean {
  const t = text.toLowerCase();

  // Anything hinting at deterioration must go through the LLM classifier and
  // potentially the triage flow - the deterministic layer only asserts
  // clearly benign guidance questions.
  if (DETERIORATION_WORDS.some((w) => t.includes(w))) return false;

  if (GUIDANCE_QUESTION_SIGNALS.some((s) => t.includes(s))) return true;

  // A question mark plus an advice topic ("i can really not eat fried foods
  // now ?") is a question about the guidance.
  const asksQuestion = t.includes("?");
  const aboutAdvice = ADVICE_TOPIC_WORDS.some((w) => t.includes(w));
  return asksQuestion && aboutAdvice;
}
