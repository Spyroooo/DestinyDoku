import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const compile = (name) => ts.transpileModule(readFileSync(new URL(`../src/games/weapons/${name}.ts`, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
}).outputText
const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const logicUrl = url(compile('logic'))
const logic = await import(logicUrl)
const daily = await import(url(compile('daily').replace(/from ['"]\.\/logic['"]/g, `from '${logicUrl}'`)))
const read = (name) => JSON.parse(readFileSync(new URL(`../src/data/destiny2/${name}.json`, import.meta.url), 'utf8'))
const pool = read('weapons'), releases = read('releases'), signature = logic.catalogSignature(pool, releases)

test('daily calendar changes at Zurich midnight in winter and summer, independent of system zone', () => {
  for (const [before, midnight, previousDay, nextDay] of [
    ['2026-01-15T22:59:59.999Z', '2026-01-15T23:00:00Z', '2026-01-15', '2026-01-16'],
    ['2026-07-15T21:59:59.999Z', '2026-07-15T22:00:00Z', '2026-07-15', '2026-07-16'],
  ]) {
    assert.equal(daily.dailyDate(Date.parse(before)), previousDay)
    assert.equal(daily.dailyDate(Date.parse(midnight)), nextDay)
    assert.equal(daily.nextDailyReset(previousDay), Date.parse(midnight))
  }
})

test('daily resets follow 23-hour and 25-hour daylight-saving days', () => {
  const springStart = Date.parse('2026-03-28T23:00:00Z')
  const autumnStart = Date.parse('2026-10-24T22:00:00Z')
  assert.equal(daily.dailyDate(springStart), '2026-03-29')
  assert.equal(daily.dailyDate(autumnStart), '2026-10-25')
  assert.equal(daily.nextDailyReset('2026-03-29') - springStart, 23 * 60 * 60 * 1000)
  assert.equal(daily.nextDailyReset('2026-10-25') - autumnStart, 25 * 60 * 60 * 1000)
})

test('daily answers are deterministic across catalogue order and exclude Unreleased entries', () => {
  const answers = new Set()
  for (let day = 1; day <= 30; day++) {
    const date = `2026-11-${String(day).padStart(2, '0')}`
    const round = daily.createDailyRound(date, pool)
    assert.deepEqual(round, daily.createDailyRound(date, [...pool].reverse()))
    assert(logic.canBeAnswer(pool.find((weapon) => weapon.id === round.answerId)))
    assert.deepEqual(round.guessIds, [])
    answers.add(round.answerId)
  }
  assert(answers.size > 1)
  assert.throws(() => daily.createDailyRound('2026-02-30', pool))
  assert.throws(() => daily.createDailyRound('2026-11-11', pool.filter((weapon) => !logic.canBeAnswer(weapon))))
})

test('development daily resets exclude the previous answer and Unreleased weapons', () => {
  const previous = pool.find(logic.canBeAnswer).id
  for (const random of [0, 0.5, 0.999999, 1]) {
    const round = daily.createDevelopmentDailyRound(pool, previous, () => random)
    assert.notEqual(round.answerId, previous)
    assert(logic.canBeAnswer(pool.find((weapon) => weapon.id === round.answerId)))
    assert.deepEqual(round.guessIds, [])
  }
})

test('daily progress and wins restore only for the correct date, answer and dataset', () => {
  const date = '2026-11-11', round = daily.createDailyRound(date, pool)
  const won = logic.submitGuess(round, round.answerId, pool)
  const save = (value, dayKey = date) => JSON.stringify({ version: 1, signature, round: value, dayKey })
  assert.deepEqual(daily.restoreDailyRound(save(round), pool, signature, date), round)
  assert.deepEqual(daily.restoreDailyRound(save(won), pool, signature, date), won)
  assert.equal(daily.restoreDailyRound(save(won), pool, signature, '2026-11-12'), null)
  assert.equal(daily.restoreDailyRound(save(round), pool, 'changed-catalogue', date), null)
  const other = pool.find((weapon) => logic.canBeAnswer(weapon) && weapon.id !== round.answerId)
  assert.equal(daily.restoreDailyRound(save({ answerId: other.id, guessIds: [] }), pool, signature, date), null)
  const practice = JSON.stringify({ version: 1, signature, round: won })
  assert.deepEqual(logic.restoreRound(practice, pool, signature), won)
  assert.equal(daily.restoreDailyRound(practice, pool, signature, date), null)
  assert.notEqual(daily.dailyStorageKey(date), daily.PRACTICE_STORAGE_KEY)
  assert.notEqual(daily.dailyStorageKey(date), daily.dailyStorageKey('2026-11-12'))
  assert.deepEqual(daily.createDailyRound('2026-11-12', pool).guessIds, [])
})

test('daily share results identify the date and mode while practice sharing stays separate', () => {
  const date = '2026-11-11', round = daily.createDailyRound(date, pool)
  const won = logic.submitGuess(round, round.answerId, pool)
  const text = logic.buildShareText(won, pool, releases, { mode: 'daily', dayKey: date })
  assert(text.includes(`Daily ${date}`))
  assert(text.endsWith('#/weapons/daily'))
  assert(!text.includes(pool.find((weapon) => weapon.id === won.answerId).name))
  assert(logic.buildShareText(won, pool, releases).includes('Practice'))
  assert.equal(logic.buildShareText(round, pool, releases, { mode: 'daily', dayKey: date }), '')
  assert.equal(daily.resetCountdown(25 * 60 * 60 * 1000), '25:00:00')
  assert.equal(daily.resetCountdown(-1), '00:00:00')
})
