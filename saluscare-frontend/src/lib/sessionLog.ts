type LoggedSession = {
  sessionId: string;
  startedAt: string;
};

function key(userId: string) {
  return `salus-sessions:${userId}`;
}

export function logRootSession(userId: string, sessionId: string) {
  const existing = getLoggedSessions(userId);
  if (existing.some((s) => s.sessionId === sessionId)) return;
  const updated: LoggedSession[] = [{ sessionId, startedAt: new Date().toISOString() }, ...existing];
  localStorage.setItem(key(userId), JSON.stringify(updated.slice(0, 50)));
}

export function getLoggedSessions(userId: string): LoggedSession[] {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}