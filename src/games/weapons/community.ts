const ID_KEY = 'destinydoku:community:browser-id:v1'
const REPORTED_KEY = 'destinydoku:community:weapons:last-reported:v1'
const PRACTICE_PREFIX = 'destinydoku:community:practice:pending:v1:'
export type PracticeCompletion = { runId: string; completedAt: string }

function validPracticeCompletion(entry: PracticeCompletion): boolean {
  const time = typeof entry?.completedAt === 'string' ? Date.parse(entry.completedAt) : NaN
  return typeof entry?.runId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.runId) &&
    Number.isFinite(time) && time >= Date.now() - 7 * 86400000 && time <= Date.now() + 300000
}

export function queuePracticeCompletion(completion: PracticeCompletion) {
  if (!validPracticeCompletion(completion)) return
  try { localStorage.setItem(`${PRACTICE_PREFIX}${completion.runId}`, JSON.stringify(completion)) } catch { /* Optional community reporting. */ }
}

export function pendingPracticeCompletions(): PracticeCompletion[] {
  try {
    const pending: PracticeCompletion[] = []
    const expired: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(PRACTICE_PREFIX)) continue
      try {
        const entry = JSON.parse(localStorage.getItem(key)!)
        if (validPracticeCompletion(entry) && key === `${PRACTICE_PREFIX}${entry.runId}`) pending.push(entry)
        else expired.push(key)
      } catch { expired.push(key) }
    }
    for (const key of expired) localStorage.removeItem(key)
    return pending.sort((a, b) => a.completedAt.localeCompare(b.completedAt))
  } catch { return [] }
}

export async function submitPracticeCompletion(endpoint: string, completion: PracticeCompletion, signal?: AbortSignal): Promise<void> {
  const response = await fetch(new URL('/weapons/practice', endpoint), {
    method: 'POST', credentials: 'omit', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(completion),
  })
  if (!response.ok || (await response.json()).recorded !== true) throw new Error('Completion not recorded')
  try { localStorage.removeItem(`${PRACTICE_PREFIX}${completion.runId}`) } catch { /* A retry is safe. */ }
}

export async function requestPracticeCount(endpoint: string, dayKey: string, signal?: AbortSignal): Promise<number> {
  const url = new URL('/weapons/practice', endpoint)
  url.searchParams.set('day', dayKey)
  const response = await fetch(url, { credentials: 'omit', cache: 'no-store', signal })
  if (!response.ok) throw new Error('Counter unavailable')
  const data = await response.json()
  if (data.dayKey !== dayKey || !Number.isSafeInteger(data.count) || data.count < 0) throw new Error('Invalid counter response')
  return data.count
}

export function completionClientId(dayKey: string): string | undefined {
  try {
    if (localStorage.getItem(REPORTED_KEY) === dayKey) return undefined
    const stored = localStorage.getItem(ID_KEY)
    if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)) return stored
    const id = crypto.randomUUID()
    localStorage.setItem(ID_KEY, id)
    return id
  } catch { return undefined } // Reading the counter still works without storage.
}

export function markCompletionReported(dayKey: string) {
  try { localStorage.setItem(REPORTED_KEY, dayKey) } catch { /* Server deduplication still applies. */ }
}

export async function requestDailyCount(endpoint: string, dayKey: string, clientId?: string, signal?: AbortSignal): Promise<number> {
  const url = new URL('/weapons/daily', endpoint)
  url.searchParams.set('day', dayKey)
  const response = await fetch(url, {
    method: clientId ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', signal,
    ...(clientId ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dayKey, clientId }) } : {}),
  })
  if (!response.ok) throw new Error('Counter unavailable')
  const data = await response.json()
  if (data.dayKey !== dayKey || !Number.isSafeInteger(data.count) || data.count < 0) throw new Error('Invalid counter response')
  return data.count
}
