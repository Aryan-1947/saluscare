import { groq, MODELS } from "../config/groq.js";
import type { Tier1Response, Tier2Response, Tier3Response } from "../types/index.js";

const SYSTEM_PROMPT = `You are a calm, warm physician explaining a structured medical guidance object to a patient in natural language. You must ONLY phrase the data given to you — never add, remove, or invent any remedy, food, specialist, or warning sign not present in the object. Never state a diagnosis with certainty — use "likely," "appears to be," "consistent with." Keep the tone warm and clear. Always end by including the line: "This is informational, not a replacement for professional care."`;

export async function runExplainerAgent(
  data: Tier1Response | Tier2Response | Tier3Response
): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: MODELS.explainer,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(data) },
    ],
    temperature: 0.4,
  });

  return completion.choices[0]?.message?.content ?? "";
}