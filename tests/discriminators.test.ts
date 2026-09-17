import { describe, it, expect } from "vitest";
import {
  chestPainDiscriminator,
  breathingDifficultyDiscriminator,
  feverDiscriminator,
  rashDiscriminator,
  woundDiscriminator,
  abdominalPainDiscriminator,
  coughDiscriminator,
  headacheDiscriminator,
  neckDiscriminator,
} from "../supabase/functions/_shared/discriminators.ts";

const NO_SYMPTOMS: string[] = [];

describe("chestPainDiscriminator", () => {
  it("escalates crushing chest pain to tier 3", () => {
    const r = chestPainDiscriminator("crushing chest pain", NO_SYMPTOMS);
    expect(r.matched).toBe(true);
    expect(r.suggestedTier).toBe(3);
  });

  it("escalates radiating pain with sweating to tier 3", () => {
    const r = chestPainDiscriminator("chest pain radiating to my arm with sweating", NO_SYMPTOMS);
    expect(r.suggestedTier).toBe(3);
  });

  it("gives tier 2 for plain chest pain", () => {
    const r = chestPainDiscriminator("mild chest pain since morning", NO_SYMPTOMS);
    expect(r.matched).toBe(true);
    expect(r.suggestedTier).toBe(2);
  });

  it("ignores negated chest pain", () => {
    const r = chestPainDiscriminator("no chest pain, just a cough", NO_SYMPTOMS);
    expect(r.matched).toBe(false);
  });

  it("matches structured symptoms even when free text is vague", () => {
    const r = chestPainDiscriminator("discomfort in my torso", ["chest_pain"]);
    expect(r.matched).toBe(true);
  });
});

describe("breathingDifficultyDiscriminator", () => {
  it("flags severe breathing trouble as tier 3", () => {
    expect(breathingDifficultyDiscriminator("I cannot breathe", NO_SYMPTOMS).suggestedTier).toBe(3);
    expect(breathingDifficultyDiscriminator("gasping for air", NO_SYMPTOMS).suggestedTier).toBe(3);
  });

  it("flags wheezing as tier 2", () => {
    expect(breathingDifficultyDiscriminator("wheezing at night", NO_SYMPTOMS).suggestedTier).toBe(2);
  });

  it("ignores negated breathing issues", () => {
    expect(breathingDifficultyDiscriminator("no shortness of breath", NO_SYMPTOMS).matched).toBe(false);
  });
});

describe("feverDiscriminator", () => {
  it("flags high fever with stiff neck as tier 3", () => {
    const r = feverDiscriminator("high fever and stiff neck", NO_SYMPTOMS);
    expect(r.suggestedTier).toBe(3);
  });

  it("flags high fever with rash as tier 3", () => {
    const r = feverDiscriminator("high fever with a rash", NO_SYMPTOMS);
    expect(r.suggestedTier).toBe(3);
  });

  it("gives tier 2 for high fever alone", () => {
    expect(feverDiscriminator("high fever of 104", NO_SYMPTOMS).suggestedTier).toBe(2);
  });

  it("gives tier 1 for mild fever", () => {
    expect(feverDiscriminator("mild fever since yesterday", NO_SYMPTOMS).suggestedTier).toBe(1);
  });

  it("respects negated fever", () => {
    expect(feverDiscriminator("no fever but very tired", NO_SYMPTOMS).matched).toBe(false);
  });
});

describe("rashDiscriminator", () => {
  it("flags spreading rash with fever as tier 3", () => {
    const r = rashDiscriminator("rash is spreading and I have fever", NO_SYMPTOMS);
    expect(r.suggestedTier).toBe(3);
  });

  it("gives tier 2 for painful or spreading rash", () => {
    expect(rashDiscriminator("painful rash on my leg", NO_SYMPTOMS).suggestedTier).toBe(2);
    expect(rashDiscriminator("spreading rash", NO_SYMPTOMS).suggestedTier).toBe(2);
  });

  it("gives tier 1 for a simple rash", () => {
    expect(rashDiscriminator("small itchy rash on my arm", NO_SYMPTOMS).suggestedTier).toBe(1);
  });
});

describe("woundDiscriminator", () => {
  it("flags deep wounds as tier 3", () => {
    expect(woundDiscriminator("deep cut on my hand", NO_SYMPTOMS).suggestedTier).toBe(3);
    expect(woundDiscriminator("heavy bleeding from a wound", NO_SYMPTOMS).suggestedTier).toBe(3);
  });

  it("flags infected wounds as tier 2", () => {
    expect(woundDiscriminator("cut with pus coming out", NO_SYMPTOMS).suggestedTier).toBe(2);
  });

  it("gives tier 1 for a minor scrape", () => {
    const r = woundDiscriminator("small scrape on my knee", NO_SYMPTOMS);
    expect(r.suggestedTier).toBe(1);
  });

  it("treats burns via the wound discriminator's burn branch", () => {
    const r = woundDiscriminator("burned my hand on the stove", NO_SYMPTOMS);
    expect(r.matched).toBe(true);
  });
});

describe("abdominalPainDiscriminator", () => {
  it("flags severe abdominal pain as tier 3", () => {
    expect(abdominalPainDiscriminator("severe stomach pain", NO_SYMPTOMS).suggestedTier).toBe(3);
    expect(abdominalPainDiscriminator("vomiting blood with belly pain", NO_SYMPTOMS).suggestedTier).toBe(3);
  });

  it("gives tier 2 for persistent abdominal pain", () => {
    expect(abdominalPainDiscriminator("persistent stomach pain for days", NO_SYMPTOMS).suggestedTier).toBe(2);
  });

  it("gives tier 1 for mild discomfort", () => {
    expect(abdominalPainDiscriminator("mild stomach ache", NO_SYMPTOMS).suggestedTier).toBe(1);
  });
});

describe("coughDiscriminator", () => {
  it("flags coughing up blood as tier 3", () => {
    expect(coughDiscriminator("coughing up blood", NO_SYMPTOMS).suggestedTier).toBe(3);
  });

  it("gives tier 2 for persistent cough", () => {
    expect(coughDiscriminator("cough for 3 weeks", NO_SYMPTOMS).suggestedTier).toBe(2);
  });

  it("gives tier 1 for a mild cough", () => {
    expect(coughDiscriminator("mild cough since morning", NO_SYMPTOMS).suggestedTier).toBe(1);
  });
});

describe("headacheDiscriminator", () => {
  it("flags thunderclap headache as tier 3", () => {
    expect(headacheDiscriminator("worst headache of my life", NO_SYMPTOMS).suggestedTier).toBe(3);
  });

  it("flags headache with confusion as tier 3", () => {
    expect(headacheDiscriminator("headache with confusion", NO_SYMPTOMS).suggestedTier).toBe(3);
  });

  it("gives tier 2 for headache with vomiting", () => {
    expect(headacheDiscriminator("headache and throwing up", NO_SYMPTOMS).suggestedTier).toBe(2);
  });

  it("gives tier 1 for a plain headache", () => {
    expect(headacheDiscriminator("headache after work", NO_SYMPTOMS).suggestedTier).toBe(1);
  });
});

describe("neckDiscriminator", () => {
  it("flags neck pain with breathing trouble as tier 3", () => {
    expect(neckDiscriminator("neck pain and it's hard to breathe", NO_SYMPTOMS).suggestedTier).toBe(3);
  });

  it("gives tier 2 for neck swelling", () => {
    expect(neckDiscriminator("neck pain with swollen gland", NO_SYMPTOMS).suggestedTier).toBe(2);
  });

  it("gives tier 1 for plain neck pain", () => {
    expect(neckDiscriminator("neck pain after sleeping wrong", NO_SYMPTOMS).suggestedTier).toBe(1);
  });
});
