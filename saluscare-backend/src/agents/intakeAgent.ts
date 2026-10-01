import { groq, MODELS } from "../config/groq.js";

export type ExtractedSymptoms = {
  symptoms: string[];
  presentingComplaint: string;
  duration: string | null;
  severity: "mild" | "moderate" | "severe" | "unknown";
  rawText: string;
};

const SYSTEM_PROMPT = `You are a senior triage physician assistant. Extract structured symptom information from the user's description. Do not diagnose. Do not suggest treatment. Respond ONLY with valid JSON matching this shape:
{
  "symptoms": string[],
  "presentingComplaint": string,
  "duration": string | null,
  "severity": "mild" | "moderate" | "severe" | "unknown"
}`;

export async function runIntakeAgent(text: string): Promise<ExtractedSymptoms> {
  const completion = await groq.chat.completions.create({
    model: MODELS.intake,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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
    rawText: text,
  };
}