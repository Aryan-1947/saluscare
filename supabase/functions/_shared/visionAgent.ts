import Groq from "npm:groq-sdk@1";

const VISION_MODEL = "qwen/qwen3.6-27b";

const VISION_SYSTEM_PROMPT = `You are a clinical visual-observation assistant. Describe only what is visibly present in the image (e.g. redness, swelling, discoloration, pus, bleeding, rash pattern). Do NOT state a diagnosis or severity conclusion. Respond ONLY with valid JSON matching this shape:
{
  "visualFindings": string,
  "imageQualityGood": boolean
}`;

export async function runVisionFusionAgent(
  groq: Groq,
  imageUrl: string,
  captionText: string | undefined
): Promise<{ visualFindings: string; imageQualityGood: boolean }> {
  const userContent: any[] = [
    {
      type: "text",
      text: captionText
        ? `Caption provided by user: "${captionText}". Describe the visible findings in this image.`
        : "Describe the visible findings in this image.",
    },
    { type: "image_url", image_url: { url: imageUrl } },
  ];

  const completion = await groq.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: "system", content: VISION_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);

  return {
    visualFindings: parsed.visualFindings ?? "",
    imageQualityGood: parsed.imageQualityGood ?? false,
  };
}