export type CommunityGame = 'weapons' | 'characters'
const ID_KEY = 'destinydoku:community:browser-id:v1'
const REPORTED_KEY = 'destinydoku:community:weapons:last-reported:v1'
const PRACTICE_PREFIX = 'destinydoku:community:practice:pending:v1:'
const practicePrefix = (game: CommunityGame) => game === 'weapons' ? PRACTICE_PREFIX : 'destinydoku:community:characters:practice:pending:v1:'
const reportedKey = (game: CommunityGame) => game === 'weapons' ? REPORTED_KEY : 'destinydoku:community:characters:last-reported:v1'
export type PracticeCompletion = { runId: string; completedAt: string }

function validPracticeCompletion(entry: PracticeCompletion): boolean {
  const time = typeof entry?.completedAt === 'string' ? Date.parse(entry.completedAt) : NaN
  return typeof entry?.runId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.runId) &&
    Number.isFinite(time) && time >= Date.now() - 7 * 86400000 && time <= Date.now() + 300000
}

export function queuePracticeCompletion(completion: PracticeCompletion, game: CommunityGame = 'weapons') {
  if (!validPracticeCompletion(completion)) return
  try { localStorage.setItem(`${practicePrefix(game)}${completion.runId}`, JSON.stringify(completion)) } catch { /* Optional community reporting. */ }
}

export function pendingPracticeCompletions(game: CommunityGame = 'weapons'): PracticeCompletion[] {
  try {
    const pending: PracticeCompletion[] = []
    const expired: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(practicePrefix(game))) continue
      try {
        const entry = JSON.parse(localStorage.getItem(key)!)
        if (validPracticeCompletion(entry) && key === `${practicePrefix(game)}${entry.runId}`) pending.push(entry)
        else expired.push(key)
      } catch { expired.push(key) }
    }
    for (const key of expired) localStorage.removeItem(key)
    return pending.sort((a, b) => a.completedAt.localeCompare(b.completedAt))
  } catch { return [] }
}

export async function submitPracticeCompletion(endpoint: string, completion: PracticeCompletion, signal?: AbortSignal, game: CommunityGame = 'weapons'): Promise<void> {
  const response = await fetch(new URL(`/${game}/practice`, endpoint), {
    method: 'POST', credentials: 'omit', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(completion),
  })
  if (!response.ok || (await response.json()).recorded !== true) throw new Error('Completion not recorded')
  try { localStorage.removeItem(`${practicePrefix(game)}${completion.runId}`) } catch { /* A retry is safe. */ }
}

export async function requestPracticeCount(endpoint: string, dayKey: string, signal?: AbortSignal, game: CommunityGame = 'weapons'): Promise<number> {
  const url = new URL(`/${game}/practice`, endpoint)
  url.searchParams.set('day', dayKey)
  const response = await fetch(url, { credentials: 'omit', cache: 'no-store', signal })
  if (!response.ok) throw new Error('Counter unavailable')
  const data = await response.json()
  if (data.dayKey !== dayKey || !Number.isSafeInteger(data.count) || data.count < 0) throw new Error('Invalid counter response')
  return data.count
}

export function completionClientId(dayKey: string, game: CommunityGame = 'weapons'): string | undefined {
  try {
    if (localStorage.getItem(reportedKey(game)) === dayKey) return undefined
    const stored = localStorage.getItem(ID_KEY)
    if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)) return stored
    const id = crypto.randomUUID()
    localStorage.setItem(ID_KEY, id)
    return id
  } catch { return undefined } // Reading the counter still works without storage.
}

export function markCompletionReported(dayKey: string, game: CommunityGame = 'weapons') {
  try { localStorage.setItem(reportedKey(game), dayKey) } catch { /* Server deduplication still applies. */ }
}

export async function requestDailyCount(endpoint: string, dayKey: string, clientId?: string, signal?: AbortSignal, game: CommunityGame = 'weapons'): Promise<number> {
  const url = new URL(`/${game}/daily`, endpoint)
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
