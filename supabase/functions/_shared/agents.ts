import Groq from "npm:groq-sdk@1";
import type { ExtractedSymptoms, Tier1Response, Tier2Response, Tier3Response } from "./types.ts";

const MODELS = {
  intake: "openai/gpt-oss-120b",
  explainer: "openai/gpt-oss-120b",
  webSearch: "groq/compound-mini",
};

// Graceful degradation: gpt-oss is a reasoning model and can return an empty
// note even after a retry (budget exhausted by reasoning tokens, transient// outage). The structured guidance card above the note is complete on its own,
// so a static, safe closing note is strictly better than showing nothing.
const FALLBACK_CLOSING_NOTE =
  "Your assessment is ready above. If your symptoms worsen, new symptoms appear, or you are unsure at any point, please seek professional care. This is informational, not a replacement for professional care.";

function fallbackClosingNote(): string {
  return FALLBACK_CLOSING_NOTE;
}

const INTAKE_SYSTEM_PROMPT = `You are a senior triage physician assistant. Extract structured symptom information from the user's description, and simultaneously decide if you have enough information to safely assess it. Do not diagnose. Do not suggest treatment.

Severity inference: infer severity from context even if the patient doesn't use the words "mild/moderate/severe" directly. If they describe no pain, no breathing difficulty, no high fever, and nothing alarming, classify as "mild". If they describe significant pain, persistent symptoms, or multiple compounding symptoms, classify as "moderate". If they describe intense pain, inability to function, or anything approaching emergency language (without being an outright red flag), classify as "severe". Only use "unknown" if there is truly no information to infer from at all.

Category classification: assign exactly one category from this fixed list based on the complaint, choosing the closest fit:
respiratory, digestive, skin, musculoskeletal, reproductive, neurological, sleep, injury, general_infection, mental_wellbeing, urinary, dental_oral, eye, ear, allergy, fatigue, hair_scalp, cardiovascular_lifestyle

Multi-symptom priority: if the patient mentions multiple symptoms, list all of them in the symptoms array. For presentingComplaint: if the conversation involves multiple genuinely significant, still-relevant concerns (e.g. heavy bleeding AND a delayed cycle both still active and clinically relevant), COMBINE them into one natural short phrase (e.g. "heavy bleeding with delayed period") rather than dropping earlier significant symptoms just because something new was added. Only fully replace the old complaint name if the new symptom clearly supersedes it or the old one is no longer relevant (e.g. old symptom was resolved). When genuinely unrelated new information appears alongside an existing serious concern, prefer combining over silently dropping.

presentingComplaint must always be a clean, standard medical term for the primary body-part or condition affected (e.g. "neck pain", "headache", "vomiting") - never a colloquial description of a side-effect or incidental detail (e.g. do NOT say "difficulty drinking water" when the actual complaint is neck pain that happens to make swallowing water uncomfortable - the presentingComplaint should be "neck pain", with the swallowing difficulty captured in the symptoms array instead).

Sufficiency: the complaint has ENOUGH information if you have enough detail to reason about it safely and specifically - this usually means duration and severity/intensity, but not always. Think like an actual triage nurse: ask whatever is MOST clinically relevant and missing for this specific type of complaint, not a fixed formula.

Examples of good, varied, complaint-specific questions (do not copy these verbatim, generate your own fitting the actual complaint):
- For a wound/cut: ask about bleeding, depth, or signs of infection (pus, redness, warmth) if not mentioned.
- For a headache: ask about associated symptoms like vision changes, nausea, or whether it's the worst they've ever had, alongside duration/severity.
- For digestive complaints: ask about associated symptoms like fever, blood, or dehydration signs, alongside duration/severity.
- For skin issues: ask whether it's spreading, itchy, painful, or has any discharge, alongside duration/severity.
- For anything already highly specific and self-describing (e.g. "deep cut on my hand from a knife, bleeding heavily"), no question is needed at all.

Only ask ONE question at a time, combining at most 2 related missing pieces into one natural sentence. Vary your phrasing and focus based on what's actually most useful to know for THIS complaint - do not default to a generic "how long and how severe" question every time if something more specific and relevant would help more.

CRITICAL: never re-ask for information the patient has already given you earlier in this same conversation, even across multiple exchanges. Read the full conversation text carefully before deciding what's still missing - only ask about genuinely new, still-unknown information.

CRITICAL FOR IMAGES: if the message includes a "Visible findings:" section (from image analysis), that description already tells you what the injury/condition looks like and, combined with the patient's caption, usually tells you the type and location. NEVER ask "what type of injury" or "where is it located" if the caption or visible findings already make this obvious (e.g. caption says "my hand burned" + visible findings describe a burn - type and location are both already known: it's a burn, on the hand). Only ask for things that are genuinely still unclear, like exact duration or severity, not things already stated or visually shown.

Also detect, only if explicitly mentioned by the patient (never assume): whether they are a child (under 12), elderly (65+), or currently pregnant.

Respond ONLY with valid JSON matching this shape:
{
  "symptoms": string[],
  "presentingComplaint": string,
  "duration": string | null,
  "severity": "mild" | "moderate" | "severe" | "unknown",
  "category": "respiratory" | "digestive" | "skin" | "musculoskeletal" | "reproductive" | "neurological" | "sleep" | "injury" | "general_infection" | "mental_wellbeing" | "urinary" | "dental_oral" | "eye" | "ear" | "allergy" | "fatigue" | "hair_scalp" | "cardiovascular_lifestyle",
  "sufficient": boolean,
  "clarifyingQuestion": string | null,
  "isChild": boolean,
  "isElderly": boolean,
  "isPregnant": boolean
}`;

export async function runIntakeAgent(groq: Groq, text: string): Promise<ExtractedSymptoms> {
  const completion = await groq.chat.completions.create({
    model: MODELS.intake,
    messages: [
      { role: "system", content: INTAKE_SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);

  return {
    symptoms: parsed.symptoms ?? [],
    presentingComplaint: parsed.presentingComplaint ?? "unspecified",
    duration: parsed.duration ?? null,
    severity: parsed.severity ?? "unknown",
    category: parsed.category ?? "general_infection",
    sufficient: parsed.sufficient ?? true,
    clarifyingQuestion: parsed.clarifyingQuestion ?? null,
    isChild: parsed.isChild ?? false,
    isElderly: parsed.isElderly ?? false,
    isPregnant: parsed.isPregnant ?? false,
    rawText: text,
  };
}

const EXPLAINER_SYSTEM_PROMPT = `You are a calm, warm physician giving a brief closing note to a patient after they've already seen a full structured guidance card (condition summary, remedies, foods, recovery plan, warning signs - all already displayed separately). Do NOT re-list or re-narrate everything in that card - the patient has already read it. 

Your job is only to add a short, warm, human closing note: acknowledge what's likely going on in one sentence, and encourage them briefly. Never state a diagnosis with certainty - use "likely," "appears to be," "consistent with." Never add, remove, or invent any remedy, food, specialist, or warning sign not present in the data object.

Formatting: plain prose only, no markdown, no lists. Keep this to 2-3 short sentences maximum. Before the final disclaimer sentence, add one brief, natural forward-looking touch - like offering to answer a specific follow-up, or gently prompting them to update you on how it's going (e.g. "Let me know if the swelling doesn't improve, or if you have any questions about the recovery steps."). Always end with the exact sentence: "This is informational, not a replacement for professional care."`;

export async function runExplainerAgent(
  groq: Groq,
  data: Tier1Response | Tier2Response | Tier3Response
): Promise<string> {
  const needsSearch = "needsWebSearchGrounding" in data && data.needsWebSearchGrounding;
  const model = needsSearch ? MODELS.webSearch : MODELS.explainer;
  const systemPrompt = needsSearch
    ? EXPLAINER_SYSTEM_PROMPT +
      `\n\nSpecial case: this complaint has no matching data in the knowledge base at all (empty remedies/foods/warnings). You have web search available - use it to give brief, general, safe self-care guidance for this specific complaint, clearly framed as general information, not personalized medical advice. Still keep it to 2-4 sentences, still end with the required disclaimer sentence, and still never suggest a specific medication dosage.`
    : EXPLAINER_SYSTEM_PROMPT;

  // gpt-oss is a reasoning model: reasoning tokens count against max_tokens, so a
  // tight budget can be exhausted before any content is written (empty string).
  // reasoning_effort "low" trims thinking; the retry mirrors runGeneralQuestionAgent.
  const callOnce = async () => {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(data) },
      ],
      temperature: 0.4,
      max_tokens: needsSearch ? 600 : 400,
      reasoning_effort: "low",
    });
    return completion.choices[0]?.message?.content ?? "";
  };

  let note = await callOnce();
  if (!note) {
    note = await callOnce(); // one retry on empty completion
  }
  return note || fallbackClosingNote();
}


const FOLLOWUP_SYSTEM_PROMPT = `You are a physician assistant with continuity focus, reassessing a returning patient. You are given their prior session data, their new follow-up message, the newly assembled response object (remedies, foods, specialists, warning signs) for their updated tier, and whether they've indicated they still haven't followed prior advice to see a doctor/specialist.

Strict rules:
- You must ONLY phrase the remedies, foods, specialists, and warning signs present in the given response object. NEVER invent a remedy, medication, dosage, or specific drug name/amount that is not explicitly present in the data given to you.
- Do NOT suggest specific medication dosages (e.g. "500mg every 6 hours") under any circumstance, even common over-the-counter ones, unless that exact text appears in the provided data.
- Do NOT diagnose with certainty - use "likely," "appears to be," "consistent with."
- Do NOT discard or contradict the prior session without explanation - acknowledge what has changed.
- Explain the reassessment in natural, warm language, referencing the old vs new symptom state and the change in tier if applicable, in 2-3 short sentences maximum - the structured card already shows the details, so just briefly acknowledge what's changed.
- If the patient has indicated they still haven't followed prior advice to see a doctor/specialist (this will be flagged for you), be noticeably firmer and more direct about the importance of actually going now, especially since symptoms are continuing or worsening - without being alarmist or changing the clinical facts.
- Before the final disclaimer sentence, add one brief, natural forward-looking touch - like offering to answer a follow-up question, or prompting them to update you on how things go.
- Formatting: write in plain flowing prose only. Do NOT use markdown syntax - no asterisks for bold, no bullet points, no numbered lists, no headers. The structured data is already shown separately in a formatted card.
- Always end with the exact sentence: "This is informational, not a replacement for professional care."`;

export async function runFollowupAgent(
  groq: Groq,
  priorSession: unknown,
  followUpText: string,
  changeType: string,
  newResponse: unknown,
  isNonCompliant: boolean = false
): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: MODELS.explainer,
    messages: [
      { role: "system", content: FOLLOWUP_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({ priorSession, followUpText, changeType, newResponse, hasNotFollowedPriorAdvice: isNonCompliant }),
      },
    ],
    temperature: 0.3,
    max_tokens: 400,
    reasoning_effort: "low",
  });

  const note = completion.choices[0]?.message?.content ?? "";
  return note.trim() || fallbackClosingNote();
}


const SUFFICIENCY_SYSTEM_PROMPT = `You are a triage nurse deciding whether you have enough information to safely assess a patient's complaint. You are given their raw message and extracted symptom data (symptoms, duration, severity).

A complaint has ENOUGH information ONLY if the patient's own words explicitly convey both how long it's been going on AND how severe/intense it feels (mild, moderate, severe, a pain scale number, or a clear descriptive equivalent like "unbearable" or "barely noticeable"). Do not treat duration alone as sufficient - severity must also be explicitly present in what the patient actually said, not merely inferred or guessed.

The only exception: if the complaint is already highly specific and self-describing with obvious severity built in (e.g. "deep cut on my hand from a knife, bleeding heavily" - severity is unambiguous from the description itself).

If insufficient, write ONE natural, warm clarifying question asking specifically for whichever piece is still missing (duration, severity, or both together if both are missing).

Respond ONLY with valid JSON matching this shape:
{
  "sufficient": boolean,
  "clarifyingQuestion": string | null
}`;

export async function runSufficiencyCheck(
  groq: Groq,
  rawText: string,
  extracted: ExtractedSymptoms
): Promise<{ sufficient: boolean; clarifyingQuestion: string | null }> {
  const completion = await groq.chat.completions.create({
    model: MODELS.intake,
    messages: [
      { role: "system", content: SUFFICIENCY_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({ rawText, extracted }),
      },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);

  return {
    sufficient: parsed.sufficient ?? true,
    clarifyingQuestion: parsed.clarifyingQuestion ?? null,
  };
}



const CLASSIFIER_SYSTEM_PROMPT = `You are classifying a patient's follow-up message into exactly one of two types:

"symptom_update" - the message reports an actual, concrete change in their physical condition: new symptoms, worsening or improvement, a factual update about how their body feels right now. This is ONLY for genuine new physical information that should trigger a fresh reassessment.

"general_question" - everything else: questions, requests for clarification, preferences or declines (e.g. "I don't want to eat that", "I'd rather not take medicine"), acknowledgements or gratitude (e.g. "thank you", "ok got it"), or any conversational message that is not reporting new physical symptom information. When in doubt, prefer "general_question" - it is always safer to answer conversationally than to force an unnecessary re-assessment from an ambiguous message.

Respond ONLY with valid JSON: { "type": "symptom_update" | "general_question" }`;

export async function classifyFollowupMessage(
  groq: Groq,
  message: string
): Promise<"symptom_update" | "general_question"> {
  const completion = await groq.chat.completions.create({
    model: MODELS.intake,
    messages: [
      { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
      { role: "user", content: message },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  return parsed.type === "general_question" ? "general_question" : "symptom_update";
}

const GENERAL_QUESTION_SYSTEM_PROMPT = `You are a warm, careful physician assistant responding to a patient who just received a structured assessment. You are given their prior assessment data and their message. You may also be given a short list of recent question-and-answer exchanges from this same conversation - use that to maintain continuity if the new message references something asked just before. You have access to web search for current, general medical guidance when it would genuinely help answer their question more accurately (e.g. "can I eat ice cream with a sore throat", "is honey good for a cough", "can I exercise with this").

Rules for deciding how to respond:
- If the message asks a real question that would benefit from checking current general medical guidance (diet/activity/lifestyle questions related to their condition), use web search to check reliable, current information before answering, then summarize it in your own words. Only search when it would meaningfully improve the answer's accuracy - not for simple acknowledgements or preferences.
- If the message asks a real question but web search isn't needed (the answer is straightforward from their existing data or general common knowledge), just answer directly.
- You MUST give a real, substantive, specific answer to genuine questions. Never respond with a generic filler like "got it" or "noted" to a genuine question.
- If it's a preference or decline (e.g. not wanting to eat a suggested food): acknowledge it warmly and briefly, and if reasonable, mention one alternative already present in their prior assessment data.
- If it's purely an acknowledgement with no question or content (e.g. just "thanks", "ok", "got it"): a brief warm reply is fine, no search needed.
- Do NOT introduce any new remedy, medication, dosage, or specific treatment recommendation beyond what already exists in their prior assessment data, UNLESS it comes from a web search result you just checked - in that case, clearly ground it as general guidance, not a personal prescription.
- Never state anything with diagnostic certainty, and never claim to diagnose.
- Plain prose only, no markdown, no lists.
- Keep answers complete - do not cut off mid-sentence. Aim for 2-4 sentences for real questions, 1-2 for acknowledgements.
- Always end with the complete sentence: "This is informational, not a replacement for professional care."`;

export async function runGeneralQuestionAgent(
  groq: Groq,
  priorSession: unknown,
  question: string,
  recentExchanges?: { question: string; answer: string }[]
): Promise<string> {
  const callOnce = async () => {
    const completion = await groq.chat.completions.create({
      model: MODELS.webSearch,
      messages: [
        { role: "system", content: GENERAL_QUESTION_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ priorSession, recentExchanges: recentExchanges ?? [], question }) },
      ],
      temperature: 0.3,
      max_tokens: 350,
    });
    const executedTools = (completion.choices[0]?.message as any)?.executed_tools;
    console.log("General question tools used:", JSON.stringify(executedTools ?? "none"));
    return completion.choices[0]?.message?.content?.trim() ?? "";
  };

  let answer = await callOnce();
  if (!answer) {
    answer = await callOnce(); // one retry on empty completion
  }
  return answer || "I can't answer that right now due to a temporary service issue - please try again in a moment. This is informational, not a replacement for professional care.";
}