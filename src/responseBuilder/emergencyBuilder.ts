import type { Tier3Response } from "../types/index.js";

export function buildEmergencyResponse(matchedPattern: string): Tier3Response {
  return {
    message:
      "This looks like it may be a medical emergency. Please seek emergency care immediately — call your local emergency number or go to the nearest emergency room now. Do not wait to see if it improves.",
    matchedRedFlag: matchedPattern,
  };
}