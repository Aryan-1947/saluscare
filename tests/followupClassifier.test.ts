import { describe, expect, it } from "vitest";
import { looksLikeGuidanceQuestion } from "../supabase/functions/_shared/followupClassifier.ts";

describe("looksLikeGuidanceQuestion", () => {
  it("routes the production misclassification to general_question", () => {
    expect(looksLikeGuidanceQuestion("ok ill follow these steps but i can really not eat fried foods now ?")).toBe(
      true
    );
  });

  it("routes common food/activity/medicine questions to general_question", () => {
    const questions = [
      "can I eat ice cream with this?",
      "can't i have coffee at all?",
      "should i avoid milk too?",
      "shouldn't i take the antacid before meals?",
      "is it ok to hit the gym while this heals?",
      "is it safe to take a hot shower?",
      "is it true i cant eat spicy food?",
      "am i allowed to walk outside?",
      "do i have to finish the whole course?",
      "can you tell me what to eat for breakfast?",
    ];
    for (const q of questions) {
      expect(looksLikeGuidanceQuestion(q), q).toBe(true);
    }
  });

  it("catches the question+advice-topic pattern without a listed signal phrase", () => {
    expect(looksLikeGuidanceQuestion("so fried foods are completely off the table ?")).toBe(true);
    expect(looksLikeGuidanceQuestion("what about tea before bed ?")).toBe(true);
  });

  it("never swallows real symptom updates", () => {
    const updates = [
      "no nothing else only stomach ache and ill scale it 7",
      "pain is worse now and spreading to my back",
      "the burning is unbearable",
      "i threw up twice this morning",
      "no vomiting or fever, still a 7",
      "there is some blood in my stool",
      "fever of 101 started last night",
      "on left side of stomach",
    ];
    for (const u of updates) {
      expect(looksLikeGuidanceQuestion(u), u).toBe(false);
    }
  });

  it("sends mixed messages mentioning deterioration to the LLM classifier (not auto-question)", () => {
    // These mention an advice topic but also deterioration - the deterministic
    // layer must abstain so the LLM can decide reassessment vs conversation.
    expect(looksLikeGuidanceQuestion("can i take a painkiller, the pain is unbearable now")).toBe(false);
    expect(looksLikeGuidanceQuestion("should i eat something before the medicine? i feel dizzy")).toBe(false);
  });

  it("returns false for plain acknowledgements without question framing", () => {
    expect(looksLikeGuidanceQuestion("ok got it")).toBe(false);
    expect(looksLikeGuidanceQuestion("thanks")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(looksLikeGuidanceQuestion("")).toBe(false);
  });
});
