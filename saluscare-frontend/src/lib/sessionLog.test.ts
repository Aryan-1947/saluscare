import { beforeEach, describe, expect, it } from "vitest";
import { getLoggedSessions, logRootSession } from "./sessionLog";

const USER = "auth0|test-user";

beforeEach(() => {
  localStorage.clear();
});

describe("sessionLog", () => {
  it("starts empty for a fresh user", () => {
    expect(getLoggedSessions(USER)).toEqual([]);
  });

  it("logs a session with a startedAt timestamp", () => {
    const before = Date.now();
    logRootSession(USER, "session-1");
    const sessions = getLoggedSessions(USER);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe("session-1");
    expect(Date.parse(sessions[0].startedAt)).toBeGreaterThanOrEqual(before);
  });

  it("is idempotent per session id", () => {
    logRootSession(USER, "session-1");
    logRootSession(USER, "session-1");
    logRootSession(USER, "session-1");
    expect(getLoggedSessions(USER)).toHaveLength(1);
  });

  it("keeps sessions per user isolated", () => {
    logRootSession("user-a", "session-a");
    logRootSession("user-b", "session-b");
    expect(getLoggedSessions("user-a").map((s) => s.sessionId)).toEqual(["session-a"]);
    expect(getLoggedSessions("user-b").map((s) => s.sessionId)).toEqual(["session-b"]);
  });

  it("prepends new sessions (newest first) and caps the list at 50", () => {
    for (let i = 0; i < 55; i++) {
      logRootSession(USER, `session-${i}`);
    }
    const sessions = getLoggedSessions(USER);
    expect(sessions).toHaveLength(50);
    expect(sessions[0].sessionId).toBe("session-54");
    expect(sessions[49].sessionId).toBe("session-5");
  });

  it("survives corrupted localStorage content", () => {
    localStorage.setItem(`salus-sessions:${USER}`, "{not valid json");
    expect(getLoggedSessions(USER)).toEqual([]);
  });

  it("keeps working after corrupted entries are read", () => {
    localStorage.setItem(`salus-sessions:${USER}`, "garbage");
    expect(getLoggedSessions(USER)).toEqual([]);
    logRootSession(USER, "session-after-corruption");
    expect(getLoggedSessions(USER).map((s) => s.sessionId)).toEqual(["session-after-corruption"]);
  });
});
