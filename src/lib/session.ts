const SESSION_STORAGE_KEY = "pulsecheck_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}
