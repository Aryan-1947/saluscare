import Groq from "groq-sdk";

const groqApiKey = process.env.GROQ_API_KEY!;

if (!groqApiKey) {
  throw new Error("Missing GROQ_API_KEY in environment");
}

export const groq = new Groq({ apiKey: groqApiKey });

export const MODELS = {
  intake: "openai/gpt-oss-120b",
  vision: "qwen/qwen3.6-27b",
  explainer: "openai/gpt-oss-120b",
  followup: "openai/gpt-oss-120b",
};