import { describe, expect, it } from "vitest";
import { parseInlineRuns } from "./doctorSummaryPdf";

describe("parseInlineRuns", () => {
  it("passes plain text through as a single run", () => {
    expect(parseInlineRuns("No markers here")).toEqual([{ text: "No markers here" }]);
  });

  it("splits bold markers into bold runs", () => {
    expect(parseInlineRuns("a **bold** b")).toEqual([
      { text: "a " },
      { text: "bold", bold: true },
      { text: " b" },
    ]);
  });

  it("extracts italic markers without the asterisks and keeps the style", () => {
    expect(parseInlineRuns("an *italic* word")).toEqual([
      { text: "an " },
      { text: "italic", italic: true },
      { text: " word" },
    ]);
  });

  it("handles backticked code as a plain run", () => {
    expect(parseInlineRuns("use `tier` value")).toEqual([
      { text: "use " },
      { text: "tier" },
      { text: " value" },
    ]);
  });

  it("keeps the style across words inside one marker pair", () => {
    expect(parseInlineRuns("**Self Care** tier")).toEqual([
      { text: "Self Care", bold: true },
      { text: " tier" },
    ]);
  });
});
