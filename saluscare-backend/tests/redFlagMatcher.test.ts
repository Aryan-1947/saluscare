import { describe, expect, it } from "vitest";
import { checkRedFlags, type RedFlagMatch } from "../supabase/functions/_shared/redFlagMatcher.ts";

// Minimal SupabaseClient stub: checkRedFlags only calls .from().select(), so an
// object returning our fixture rows is sufficient for the test's purposes.
// (Cast to any - the real SupabaseClient type is Deno-only npm: specifier.)
function makeSupabaseStub(rows: any[]) {
  const result = { data: rows, error: null };
  const client = {
    from: () => ({
      select: () => result,
    }),
  };
  return client as any;
}

const FLAGS = [
  { pattern: "chest pain", complaint_area: "cardiac", applies_to: "text" },
  { pattern: "difficulty breathing", complaint_area: "respiratory", applies_to: "text" },
  { pattern: "bleeding that won't stop", complaint_area: "trauma", applies_to: "text" },
  { pattern: "throat closing", complaint_area: "allergic", applies_to: "text" },
  { pattern: "seizure", complaint_area: "neurological", applies_to: "text" },
  { pattern: "face drooping", complaint_area: "neurological", applies_to: "both" },
  { pattern: "signs of severe infection", complaint_area: "infectious", applies_to: "image" },
];

function check(text?: string, visual?: string, groq?: any): Promise<RedFlagMatch> {
  return checkRedFlags(makeSupabaseStub(FLAGS), text, visual, groq ? { groq } : {});
}

describe("checkRedFlags - deterministic layer", () => {
  it("matches a stored pattern", async () => {
    const r = await check("I have severe chest pain right now");
    expect(r.matched).toBe(true);
    expect(r.pattern).toBe("chest pain");
    expect(r.viaLLM).toBeUndefined();
  });

  it("matches case-insensitively and with extra punctuation", async () => {
    const r = await check("Chest Pain!!!");
    expect(r.matched).toBe(true);
  });

  it("matches straight/curly/apostrophe-less variants of a stored pattern", async () => {
    const straight = await check("bleeding that won't stop");
    const curly = await check("bleeding that won’t stop");
    const bare = await check("bleeding that wont stop");
    expect(straight.matched).toBe(true);
    expect(curly.matched).toBe(true);
    expect(bare.matched).toBe(true);
  });

  it("matches hyphenated phrasing of a stored pattern", async () => {
    const r = await check("I noticed face-drooping this morning");
    expect(r.matched).toBe(true);
  });

  it("matches extra spacing and plural variants via regex layer", async () => {
    const spaced = await check("my difficulty  breathing got worse");
    const plural = await check("I keep having seizures");
    expect(spaced.matched).toBe(true);
    expect(plural.matched).toBe(true);
  });

  it("matches a stored pattern inside follow-up combined context", async () => {
    const r = await check("Sore throat for two days. Patient update: now I have difficulty breathing");
    expect(r.matched).toBe(true);
    expect(r.complaintArea).toBe("respiratory");
  });

  it("does not match unrelated text", async () => {
    const r = await check("mild sore throat for two days, worse when swallowing");
    expect(r.matched).toBe(false);
  });

  it("does not match when no text is provided", async () => {
    const r = await check(undefined, undefined);
    expect(r.matched).toBe(false);
  });

  it("negation before the phrase suppresses the match", async () => {
    const r = await check("thankfully no chest pain, just a mild cough");
    expect(r.matched).toBe(false);
  });

  it("suppressed mention: 'denies difficulty breathing' does not match", async () => {
    const r = await check("denies difficulty breathing, reports mild sore throat");
    expect(r.matched).toBe(false);
  });

  it("post-phrase negation is a genuine emergency and still matches", async () => {
    const r = await check("chest pain that is not improving");
    expect(r.matched).toBe(true);
  });

  it("negation on one occurrence does not hide a genuine second occurrence", async () => {
    const r = await check("no chest pain earlier, but I have severe chest pain now");
    expect(r.matched).toBe(true);
  });

  it("respects applies_to: image-only pattern not matched via text", async () => {
    const r = await check("I see signs of severe infection in the wound");
    expect(r.matched).toBe(false);
  });

  it("image-only pattern matched via visual findings", async () => {
    const r = await check(undefined, "wound edges show signs of severe infection");
    expect(r.matched).toBe(true);
    expect(r.complaintArea).toBe("infectious");
  });

  it("both-scope pattern matches via visual findings too", async () => {
    const r = await check(undefined, "the photo shows face drooping on the left side");
    expect(r.matched).toBe(true);
  });
});

describe("checkRedFlags - LLM paraphrase fallback", () => {
  const llmGroq = (response: object) => ({
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify(response) } }],
        }),
      },
    },
  });

  it("catches emergencies phrased without any stored keyword", async () => {
    const groq = llmGroq({ isEmergency: true, matchedConcept: "airway obstruction", reason: "airway blockage" });
    const r = await check("the swelling is blocking my airway", undefined, groq);
    expect(r.matched).toBe(true);
    expect(r.viaLLM).toBe(true);
    expect(r.pattern).toBe("airway obstruction");
  });

  it("returns matched:false when the LLM says not an emergency", async () => {
    const groq = llmGroq({ isEmergency: false, matchedConcept: null, reason: "mild complaint" });
    const r = await check("mild sore throat for two days", undefined, groq);
    expect(r.matched).toBe(false);
  });

  it("fails open when the LLM call throws", async () => {
    const groq = {
      chat: {
        completions: {
          create: async () => {
            throw new Error("groq down");
          },
        },
      },
    };
    const r = await check("mild sore throat for two days", undefined, groq);
    expect(r.matched).toBe(false);
  });

  it("fails open when the LLM returns malformed JSON", async () => {
    const groq = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "not json at all" } }],
          }),
        },
      },
    };
    const r = await check("some message", undefined, groq);
    expect(r.matched).toBe(false);
  });

  it("stored-pattern hit wins over LLM (LLM never runs)", async () => {
    let called = false;
    const groq = {
      chat: {
        completions: {
          create: async () => {
            called = true;
            throw new Error("should not be called");
          },
        },
      },
    };
    const r = await check("severe chest pain", undefined, groq);
    expect(r.matched).toBe(true);
    expect(r.viaLLM).toBeUndefined();
    expect(called).toBe(false);
  });

  it("without groq option, no LLM call is attempted", async () => {
    const r = await check("the swelling is blocking my airway");
    expect(r.matched).toBe(false);
  });
});
