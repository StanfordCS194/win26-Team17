const SESSION_SEARCHES_KEY = "pulsecheck_session_searches";

export function getSessionSearches(): string[] {
  try {
    const stored = sessionStorage.getItem(SESSION_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addSessionSearch(productName: string): string[] {
  const current = getSessionSearches();
  if (current.includes(productName)) return current;
  const updated = [...current, productName];
  try {
    sessionStorage.setItem(SESSION_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    return current;
  }
  return updated;
}
