const SESSION_STORAGE_KEY = "pulsecheck_session_id";
const USER_STORAGE_KEY = "pulsecheck_user_id";

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

/**
 * Long-lived user ID for return-usage tracking (same user across visits).
 * Persists in localStorage and does not change.
 */
export function getUserId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  let userId = localStorage.getItem(USER_STORAGE_KEY);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(USER_STORAGE_KEY, userId);
  }
  return userId;
}
