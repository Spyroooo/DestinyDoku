import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { counterDate, handleRequest } from '../cloudflare/daily-counter/worker.mjs'

const origin = 'https://destinydoku.com'
const day = '2026-11-16', now = Date.parse(`${day}T12:00:00Z`)
const id = '7d805158-098a-4ebc-bdb2-0a5444351e8b'
const other = 'b6bd4486-9b92-4abd-8b77-bb11c058ab4e'
function database() {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../cloudflare/daily-counter/migrations/0001_daily_counter.sql', import.meta.url), 'utf8'))
  db.exec(readFileSync(new URL('../cloudflare/daily-counter/migrations/0002_practice_counter.sql', import.meta.url), 'utf8'))
  db.exec(readFileSync(new URL('../cloudflare/daily-counter/migrations/0003_character_practice_counter.sql', import.meta.url), 'utf8'))
  return {
    db,
    prepare(sql) {
      return { bind(...args) {
        return { async run() { return db.prepare(sql).run(...args) }, async first() { return db.prepare(sql).get(...args) } }
      } }
    },
  }
}
const request = (method = 'GET', body, requestOrigin = origin, path = '/weapons/daily') => new Request(`https://counter.example${path}?day=${day}`, {
  method, headers: { ...(requestOrigin ? { Origin: requestOrigin } : {}), ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
  ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
})

test('counter SQL counts each browser once, survives retries, and starts a new day independently', async () => {
  const DB = database(), env = { DB }
  try {
    assert.deepEqual(await (await handleRequest(request(), env, now)).json(), { dayKey: day, count: 0 })
    for (let i = 0; i < 4; i++) {
      const response = await handleRequest(request('POST', { dayKey: day, clientId: id }), env, now)
      assert.equal(response.status, 200)
      assert.equal((await response.json()).count, 1)
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin)
    }
    assert.equal((await (await handleRequest(request('POST', { dayKey: day, clientId: other }), env, now)).json()).count, 2)
    const stored = DB.db.prepare('SELECT browser_hash FROM daily_completions').all()
    assert.equal(stored.length, 2)
    assert(stored.every((row) => /^[a-f0-9]{64}$/.test(row.browser_hash) && row.browser_hash !== id))
    const next = '2026-11-17', tomorrow = Date.parse(`${next}T12:00:00Z`)
    const response = await handleRequest(request('POST', { dayKey: next, clientId: id }), env, tomorrow)
    assert.equal((await response.json()).count, 1)
    assert.equal(DB.db.prepare('SELECT completions FROM daily_totals WHERE day_key = ?').get(day).completions, 2)
  } finally { DB.db.close() }
})

test('counter date agrees with Zurich midnight and daylight saving', () => {
  assert.equal(counterDate(Date.parse('2026-11-16T22:59:59Z')), '2026-11-16')
  assert.equal(counterDate(Date.parse('2026-11-16T23:00:00Z')), '2026-11-17')
  assert.equal(counterDate(Date.parse('2026-07-15T21:59:59Z')), '2026-07-15')
  assert.equal(counterDate(Date.parse('2026-07-15T22:00:00Z')), '2026-07-16')
})

test('practice counts distinct completed runs and deduplicates retries even on later days', async () => {
  const DB = database(), env = { DB }
  const post = (runId, completedAt, time = now) => handleRequest(request('POST', { runId, completedAt }, origin, '/weapons/practice'), env, time)
  try {
    assert.equal((await (await handleRequest(request('GET', undefined, origin, '/weapons/practice'), env, now)).json()).count, 0)
    for (let retry = 0; retry < 3; retry++) {
      assert.equal((await (await post(id, `${day}T11:59:00Z`)).json()).count, 1)
    }
    assert.equal((await (await post(other, `${day}T11:59:00Z`)).json()).count, 2)
    const tomorrow = Date.parse('2026-11-17T12:00:00Z')
    const retry = await (await post(id, '2026-11-17T11:59:00Z', tomorrow)).json()
    assert.equal(retry.recorded, true)
    assert.equal(retry.count, 0, 'Changing the submission date cannot recount a run')
    const offline = '165cd478-27cd-4ae5-85f9-16ea13338ae3'
    assert.equal((await (await post(offline, `${day}T22:59:00Z`, tomorrow)).json()).count, 0)
    assert.equal(DB.db.prepare('SELECT completions FROM practice_totals WHERE day_key = ?').get(day).completions, 3)
    const newRun = '7cd96726-dc4c-4200-ab8c-eaf189037007'
    assert.equal((await (await post(newRun, `${day}T23:01:00Z`, tomorrow)).json()).count, 1, 'Finished after Zurich midnight counts toward the next day')
    assert.equal((await (await handleRequest(request(), env, now)).json()).count, 0, 'Daily challenge count is separate')
    assert.equal((await post('bad-id', `${day}T11:59:00Z`)).status, 400)
    assert.equal((await post(id, 'not-a-date')).status, 400)
    assert.equal((await post(id, '2026-10-01T12:00:00Z')).status, 400)
    assert.equal((await post(id, '2026-12-01T12:00:00Z')).status, 400)
  } finally { DB.db.close() }
})

test('practice migration preserves existing daily totals and can be safely reapplied', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec(readFileSync(new URL('../cloudflare/daily-counter/migrations/0001_daily_counter.sql', import.meta.url), 'utf8'))
    db.prepare('INSERT INTO daily_completions VALUES (?, ?, ?)').run('weapons', day, 'existing-daily-completion')
    const migration = readFileSync(new URL('../cloudflare/daily-counter/migrations/0002_practice_counter.sql', import.meta.url), 'utf8')
    db.exec(migration)
    db.exec(migration)
    assert.equal(db.prepare('SELECT completions FROM daily_totals WHERE day_key = ?').get(day).completions, 1)
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM practice_completions').get().count, 0)
  } finally { db.close() }
})

test('counter rejects stale dates, untrusted origins, malformed bodies and rate-limited writes', async () => {
  const DB = database(), env = { DB }
  try {
    for (const [req, status] of [
      [request('POST', { dayKey: '2026-11-15', clientId: id }), 409],
      [request('POST', { dayKey: day, clientId: 'invalid' }), 400],
      [request('POST', { dayKey: day, clientId: id }, 'http://localhost:5173'), 403],
      [request('POST', { dayKey: day, clientId: id }, ''), 403],
      [request('POST', '{'), 400],
      [request('POST', 'x'.repeat(1025)), 413],
    ]) assert.equal((await handleRequest(req, env, now)).status, status)
    const limited = await handleRequest(request('POST', { dayKey: day, clientId: id }), { DB, WRITE_LIMIT: { limit: async () => ({ success: false }) } }, now)
    assert.equal(limited.status, 429)
    assert.equal(DB.db.prepare('SELECT COUNT(*) AS count FROM daily_completions').get().count, 0)
    const preflight = await handleRequest(request('OPTIONS'), env, now)
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS')
    const failed = await handleRequest(request(), { DB: { prepare() { throw Error('offline') } } }, now)
    assert.equal(failed.status, 503)
    assert.equal(failed.headers.get('Cache-Control'), 'no-store')
  } finally { DB.db.close() }
})

function clientHarness() {
  const storage = new Map(), calls = [], responses = []
  const source = readFileSync(new URL('../src/games/weapons/community.ts', import.meta.url), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText
  const exports = {}
  runInNewContext(js, { exports, URL, crypto: { randomUUID: () => id }, localStorage: { get length(){return storage.size}, key: (index) => [...storage.keys()][index] ?? null, getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) }, fetch: async (...args) => { calls.push(args); const result = responses.shift(); if (result instanceof Error) throw result; return result } })
  return { client: exports, storage, calls, responses }
}

test('browser completion IDs survive retries; only successful reports are acknowledged', async () => {
  const h = clientHarness(), client = h.client
  assert.equal(client.completionClientId(day), id)
  assert.equal(client.completionClientId(day), id)
  h.responses.push(new Error('offline'))
  await assert.rejects(client.requestDailyCount('https://counter.example', day, id))
  assert.equal(client.completionClientId(day), id)
  h.responses.push(Response.json({ dayKey: day, count: 12 }))
  assert.equal(await client.requestDailyCount('https://counter.example', day, id), 12)
  const [url, options] = h.calls.at(-1)
  assert.equal(url.pathname, '/weapons/daily')
  assert.equal(options.method, 'POST')
  assert.equal(options.credentials, 'omit')
  client.markCompletionReported(day)
  assert.equal(client.completionClientId(day), undefined)
  assert.equal(client.completionClientId('2026-11-17'), id)
  h.responses.push(Response.json({ dayKey: day, count: 13 }))
  assert.equal(await client.requestDailyCount('https://counter.example', day), 13)
  assert.equal(h.calls.at(-1)[1].method, 'GET')
  h.responses.push(Response.json({ dayKey: '2026-11-15', count: 12 }))
  await assert.rejects(client.requestDailyCount('https://counter.example', day))
})

test('practice reporting queue keeps multiple runs until acknowledged, with safe retries', async () => {
  const h = clientHarness(), client = h.client
  const completion = { runId: id, completedAt: new Date().toISOString() }
  const second = { ...completion, runId: other }
  client.queuePracticeCompletion(completion)
  client.queuePracticeCompletion(second)
  client.queuePracticeCompletion(completion)
  assert.equal(client.pendingPracticeCompletions().length, 2)
  h.responses.push(new Error('offline'))
  await assert.rejects(client.submitPracticeCompletion('https://counter.example', completion))
  assert.equal(client.pendingPracticeCompletions().length, 2)
  h.responses.push(Response.json({ recorded: true }))
  await client.submitPracticeCompletion('https://counter.example', completion)
  assert.equal(client.pendingPracticeCompletions().length, 1)
  assert.equal(client.pendingPracticeCompletions()[0].runId, other)
  assert.equal(h.calls.at(-1)[0].pathname, '/weapons/practice')
  h.responses.push(Response.json({ recorded: false }))
  await assert.rejects(client.submitPracticeCompletion('https://counter.example', second))
  assert.equal(client.pendingPracticeCompletions().length, 1)
  client.queuePracticeCompletion({ runId: 'invalid', completedAt: completion.completedAt })
  client.queuePracticeCompletion({ runId: id, completedAt: '2000-01-01T00:00:00Z' })
  assert.equal(client.pendingPracticeCompletions().length, 1)
  h.responses.push(Response.json({ dayKey: day, count: 12 }))
  assert.equal(await client.requestPracticeCount('https://counter.example', day), 12)
})

function counterView({ development = false, hostname = 'destinydoku.com', endpoint = 'https://counter.example' } = {}) {
  const slots = [], calls = [], marks = [], intervals = [], listeners = new Map(), replies = []
  let cursor = 0, nextTimer = 0
  const react = {
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: initial }
      return [slots[index].value, (value) => { slots[index].value = value }]
    },
    useEffect(setup, deps) {
      const index = cursor++, old = slots[index]
      if (!old || deps.some((value, i) => value !== old.deps[i])) {
        old?.cleanup?.()
        slots[index] = { deps, cleanup: setup() }
      }
    },
  }
  const practiceQueue = new Map(), practiceReports = [], practiceReads = []
  const modules = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '../../config/community': { communityApiUrl: endpoint },
    './community': {
      queuePracticeCompletion: (entry) => practiceQueue.set(entry.runId, entry),
      pendingPracticeCompletions: () => [...practiceQueue.values()],
      submitPracticeCompletion: async (_endpoint, entry) => { practiceReports.push(entry); practiceQueue.delete(entry.runId) },
      requestPracticeCount: async (...args) => { practiceReads.push(args); return 7 },
      completionClientId: (date) => marks.includes(date) ? undefined : id,
      markCompletionReported: (date) => marks.push(date),
      requestDailyCount: async (...args) => { calls.push(args); const reply = replies.shift() ?? 7; if (reply instanceof Error) throw reply; return reply },
    },
  }
  const source = readFileSync(new URL('../src/games/weapons/DailyCounter.tsx', import.meta.url), 'utf8').replaceAll('import.meta.env.DEV', '__development')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}
  runInNewContext(js, {
    exports, __development: development, AbortController,
    document: { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) },
    window: { location: { hostname }, setTimeout: () => ++nextTimer, clearTimeout() {}, setInterval: (fn) => { intervals.push(fn); return ++nextTimer }, clearInterval() {} },
    require: (name) => { if (!(name in modules)) throw Error(`Unexpected import ${name}`); return modules[name] },
  })
  return { calls, marks, intervals, replies, practiceReports, practiceReads, render(completed = false, date = day, props = {}) { cursor = 0; return exports.default({ dayKey: date, completed, ...props }) } }
}
const flush = () => new Promise((resolve) => setImmediate(resolve))

test('counter component never contacts production during development, preview, or before configuration', async () => {
  for (const options of [{ development: true }, { hostname: 'localhost' }, { hostname: 'preview.example' }, { endpoint: '' }]) {
    const view = counterView(options)
    assert.equal(view.render(true), null)
    await flush()
    assert.equal(view.calls.length, 0)
    assert.equal(view.intervals.length, 0)
  }
})

test('live counter retries failures, reports wins, then refreshes by reading; new dates hide old totals', async () => {
  const view = counterView()
  view.replies.push(new Error('offline'))
  assert.equal(view.render(true), null)
  await flush()
  assert.equal(view.marks.length, 0)
  assert.equal(view.render(true), null)
  view.intervals[0]()
  await flush()
  assert.equal(view.calls.at(-1)[2], id)
  assert.equal(view.marks[0], day)
  assert.equal(view.render(true).props.className, 'daily-community-count')
  view.intervals[0]()
  await flush()
  assert.equal(view.calls.at(-1)[2], undefined)
  assert.equal(view.render(false, '2026-11-17'), null)
  await flush()
  assert.equal(view.calls.at(-1)[2], undefined)
})

test('Unlimited counter reports only completed rounds and reads on fresh runs', async () => {
  const view = counterView(), props = { mode: 'practice', runId: id }
  assert.equal(view.render(false, day, props), null)
  await flush()
  assert.equal(view.practiceReports.length, 0)
  assert.equal(view.practiceReads.length, 1)
  const completedAt = new Date().toISOString()
  view.render(true, day, { ...props, completedAt })
  await flush()
  assert.equal(view.practiceReports.length, 1)
  assert.equal(view.practiceReports[0].runId, id)
  assert.equal(view.practiceReports[0].completedAt, completedAt)
  const rendered = view.render(true, day, { ...props, completedAt })
  assert(rendered.props.children[2].includes('Unlimited runs completed today'))
  view.render(false, day, { mode: 'practice', runId: other })
  await flush()
  assert.equal(view.practiceReports.length, 1, 'Starting the next round does not count a completion')
  assert.equal(view.calls.length, 0, 'Practice does not call the daily challenge endpoint')
})

test('character daily and unlimited completions are isolated from Weapons and deduplicate independently',async()=>{
 const DB=database(),env={DB}
 try {
  for(const game of ['weapons','characters']){
   for(let retry=0;retry<2;retry++){
    const daily=await handleRequest(request('POST',{dayKey:day,clientId:id},origin,`/${game}/daily`),env,now)
    assert.equal(daily.status,200)
    assert.equal((await daily.json()).count,1)
    const practice=await handleRequest(request('POST',{runId:id,completedAt:`${day}T11:59:00Z`},origin,`/${game}/practice`),env,now)
    assert.equal(practice.status,200)
    assert.equal((await practice.json()).count,1)
   }
  }
  await handleRequest(request('POST',{dayKey:day,clientId:other},origin,'/characters/daily'),env,now)
  await handleRequest(request('POST',{runId:other,completedAt:`${day}T11:59:00Z`},origin,'/characters/practice'),env,now)
  for(const mode of ['daily','practice']){
   assert.equal((await (await handleRequest(request('GET',undefined,origin,`/weapons/${mode}`),env,now)).json()).count,1)
   assert.equal((await (await handleRequest(request('GET',undefined,origin,`/characters/${mode}`),env,now)).json()).count,2)
  }
 } finally { DB.db.close() }
})

test('browser completion acknowledgements and retry queues are isolated by game',async()=>{
 const h=clientHarness(),client=h.client
 const completion={runId:id,completedAt:new Date().toISOString()}
 client.queuePracticeCompletion(completion)
 client.queuePracticeCompletion(completion,'characters')
 assert.equal(client.pendingPracticeCompletions().length,1)
 assert.equal(client.pendingPracticeCompletions('characters').length,1)
 client.markCompletionReported(day)
 assert.equal(client.completionClientId(day),undefined)
 assert(client.completionClientId(day,'characters'))
 h.responses.push(Response.json({recorded:true}))
 await client.submitPracticeCompletion('https://counter.example',completion,undefined,'characters')
 assert.equal(h.calls.at(-1)[0].pathname,'/characters/practice')
 assert.equal(client.pendingPracticeCompletions('characters').length,0)
 assert.equal(client.pendingPracticeCompletions().length,1)
 client.markCompletionReported(day,'characters')
 assert.equal(client.completionClientId(day,'characters'),undefined)
})
