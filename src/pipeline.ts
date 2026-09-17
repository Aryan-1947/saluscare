import { checkRedFlags } from "./prefilter/redFlagMatcher.js";
import { runIntakeAgent } from "./agents/intakeAgent.js";
import { runTriageEngine } from "./triage/triageEngine.js";
import { buildSelfCareResponse } from "./responseBuilder/selfCareBuilder.js";
import { buildSpecialistResponse } from "./responseBuilder/specialistBuilder.js";
import { buildEmergencyResponse } from "./responseBuilder/emergencyBuilder.js";
import { runExplainerAgent } from "./agents/explainerAgent.js";

export async function runPipeline(text: string) {
  const redFlag = await checkRedFlags(text, undefined);
  if (redFlag.matched) {
    const response = buildEmergencyResponse(redFlag.pattern!);
    const explanation = await runExplainerAgent(response);
    return { tier: 3, response, explanation };
  }

  const extracted = await runIntakeAgent(text);
  const triage = runTriageEngine(extracted, false, false);

  if (triage.tier === 3) {
    const response = buildEmergencyResponse(triage.presentingComplaint);
    const explanation = await runExplainerAgent(response);
    return { tier: 3, triage, response, explanation };
  }

  if (triage.tier === 2) {
    const response = await buildSpecialistResponse(
      triage.presentingComplaint,
      extracted.presentingComplaint,
      "Your symptoms suggest professional evaluation would be safer than self-care alone"
    );
    const explanation = await runExplainerAgent(response);
    return { tier: 2, triage, response, explanation };
  }

  const response = await buildSelfCareResponse(
    triage.presentingComplaint,
    `This looks like a ${triage.presentingComplaint}`,
    "Common causes include viral or bacterial infection, irritation, or allergies"
  );
  const explanation = await runExplainerAgent(response);
  return { tier: 1, triage, response, explanation };
}