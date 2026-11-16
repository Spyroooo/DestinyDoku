const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function counterDate(now = Date.now()) {
  const parts = calendar.formatToParts(now)
  const part = (type) => parts.find((entry) => entry.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}

// Export the clock-injected handler for deterministic midnight/DST tests.
export async function handleRequest(request, env, now = Date.now()) {
  const url = new URL(request.url)
  const origin = request.headers.get('Origin')
  const allowed = (env.ALLOWED_ORIGINS ?? 'https://destinydoku.com,https://www.destinydoku.com').split(',').map((value) => value.trim())
  const headers = { 'Cache-Control': 'no-store', 'Vary': 'Origin' }
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  const json = (data, status = 200) => Response.json(data, { status, headers })
  if (origin && !allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403)
  const practice = url.pathname === '/weapons/practice'
  if (!practice && url.pathname !== '/weapons/daily') return json({ error: 'Not found' }, 404)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400',
    } })
  }
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405)
  const today = counterDate(now)
  try {
    if (request.method === 'POST') {
      if (!origin || !allowed.includes(origin)) return json({ error: 'Origin required' }, 403)
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'JSON required' }, 415)
      if (Number(request.headers.get('Content-Length')) > 1024) return json({ error: 'Request too large' }, 413)
      // Stream the small payload with an actual byte limit; do not trust Content-Length.
      const reader = request.body?.getReader()
      if (!reader) return json({ error: 'Body required' }, 400)
      let text = '', length = 0
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        length += value.byteLength
        if (length > 1024) { await reader.cancel(); return json({ error: 'Request too large' }, 413) }
        text += decoder.decode(value, { stream: true })
      }
      text += decoder.decode()
      let body
      try { body = JSON.parse(text) } catch { return json({ error: 'Invalid JSON' }, 400) }
      if (!practice && body?.dayKey !== today) return json({ error: 'Challenge expired', dayKey: today }, 409)
      const identifier = practice ? body?.runId : body?.clientId
      if (typeof identifier !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)) {
        return json({ error: 'Invalid completion ID' }, 400)
      }
      const completedAt = typeof body?.completedAt === 'string' ? Date.parse(body.completedAt) : NaN
      if (practice && (!Number.isFinite(completedAt) || completedAt < now - 7 * 86400000 || completedAt > now + 300000)) {
        return json({ error: 'Invalid or expired completion time' }, 400)
      }
      if (env.WRITE_LIMIT) {
        const result = await env.WRITE_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })
        if (!result.success) return json({ error: 'Too many requests' }, 429)
      }
      // Practice IDs are unique across dates; daily browser IDs are unique within a date.
      const input = practice ? `practice:${identifier.toLowerCase()}` : `weapons:${today}:${identifier.toLowerCase()}`
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
      const token = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
      if (practice) {
        await env.DB.prepare('INSERT INTO practice_completions (run_hash, day_key) VALUES (?, ?) ON CONFLICT DO NOTHING')
          .bind(token, counterDate(Math.min(completedAt, now))).run()
      } else {
        await env.DB.prepare('INSERT INTO daily_completions (game, day_key, browser_hash) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
          .bind('weapons', today, token).run()
      }
    } else if (url.searchParams.has('day') && url.searchParams.get('day') !== today) {
      return json({ error: 'Challenge expired', dayKey: today }, 409)
    }
    const row = practice
      ? await env.DB.prepare('SELECT completions FROM practice_totals WHERE day_key = ?').bind(today).first()
      : await env.DB.prepare('SELECT completions FROM daily_totals WHERE game = ? AND day_key = ?').bind('weapons', today).first()
    return json({ dayKey: today, count: row?.completions ?? 0, ...(practice && request.method === 'POST' ? { recorded: true } : {}) })
  } catch {
    return json({ error: 'Counter temporarily unavailable' }, 503)
  }
}

export default { fetch: (request, env) => handleRequest(request, env) }
