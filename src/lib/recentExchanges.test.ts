import { describe, expect, it } from "vitest";
import { buildRecentExchanges } from "./recentExchanges";

const user = (content: string) => ({ role: "user" as const, kind: "text" as const, content });
const image = (caption?: string) => ({ role: "user" as const, kind: "image" as const, content: "img", caption });
const answer = (content: string) => ({ role: "assistant" as const, kind: "answer" as const, content });
const question = (content: string) => ({ role: "assistant" as const, kind: "question" as const, content });
const result = () => ({ role: "assistant" as const, kind: "result" as const, content: { tier: 1 } });

describe("buildRecentExchanges", () => {
  it("returns [] for empty turns", () => {
    expect(buildRecentExchanges([])).toEqual([]);
  });

  it("pairs an answer with the user text turn immediately before it", () => {
    const turns = [user("can I eat fries?"), answer("Yes, in moderation.")];
    expect(buildRecentExchanges(turns)).toEqual([
      { question: "can I eat fries?", answer: "Yes, in moderation." },
    ]);
  });

  it("keeps chronological order, oldest exchange first", () => {
    const turns = [
      user("q1"),
      answer("a1"),
      user("q2"),
      answer("a2"),
    ];
    expect(buildRecentExchanges(turns)).toEqual([
      { question: "q1", answer: "a1" },
      { question: "q2", answer: "a2" },
    ]);
  });

  it("returns at most max exchanges, taking the newest ones", () => {
    const turns = [
      user("q1"), answer("a1"),
      user("q2"), answer("a2"),
      user("q3"), answer("a3"),
      user("q4"), answer("a4"),
    ];
    expect(buildRecentExchanges(turns)).toEqual([
      { question: "q2", answer: "a2" },
      { question: "q3", answer: "a3" },
      { question: "q4", answer: "a4" },
    ]);
  });

  it("honors a custom max", () => {
    const turns = [user("q1"), answer("a1"), user("q2"), answer("a2")];
    expect(buildRecentExchanges(turns, 1)).toEqual([{ question: "q2", answer: "a2" }]);
  });

  it("skips an answer not preceded by a user text turn", () => {
    const turns = [question("how long?"), answer("a1")];
    expect(buildRecentExchanges(turns)).toEqual([]);
  });

  it("never treats image turns as questions", () => {
    const turns = [image("my neck"), answer("a1")];
    expect(buildRecentExchanges(turns)).toEqual([]);
  });

  it("ignores result cards and questions when scanning", () => {
    const turns = [
      user("q1"),
      answer("a1"),
      result(),
      question("How is it now?"),
      user("q2"),
      answer("a2"),
    ];
    expect(buildRecentExchanges(turns)).toEqual([
      { question: "q1", answer: "a1" },
      { question: "q2", answer: "a2" },
    ]);
  });

  it("matches the live AskPage interleaving (question, result, exchanges)", () => {
    const turns = [
      user("hey i have itching on my neck"),
      question("How long have you been experiencing it?"),
      user("from last few hours"),
      result(),
      user("i cannot eat fries?"),
      answer("You can still eat fries in moderation."),
    ];
    expect(buildRecentExchanges(turns)).toEqual([
      { question: "i cannot eat fries?", answer: "You can still eat fries in moderation." },
    ]);
  });
});
