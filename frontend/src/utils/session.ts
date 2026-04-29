const SESSION_KEY = 'logai.sessionId'

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

export function setSessionId(id: string): void {
  localStorage.setItem(SESSION_KEY, id)
}

export function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY)
  if (existing) return existing

  const created = crypto.randomUUID()
  localStorage.setItem(SESSION_KEY, created)
  return created
}

export function resetSessionId(): string {
  const created = crypto.randomUUID()
  localStorage.setItem(SESSION_KEY, created)
  return created
}
