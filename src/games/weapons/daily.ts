import type { Weapon } from '../../types/weapon'
import { canBeAnswer, createRound, restoreRound } from './logic'
import type { Round } from './logic'

export const DAILY_TIME_ZONE = 'Europe/Zurich'
export const PRACTICE_STORAGE_KEY = 'destinydoku:weapons:practice:v1'
export const DEVELOPMENT_DAILY_KEY = 'destinydoku:weapons:development:last-daily-answer'
const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: DAILY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
})

export function dailyDate(now = Date.now()): string {
  const parts = calendar.formatToParts(now)
  const part = (name: string) => parts.find((entry) => entry.type === name)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function checkDate(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) {
    throw new Error('Invalid daily date')
  }
}

/** Find the next Zurich midnight; calendar days can be 23, 24 or 25 hours. */
export function nextDailyReset(day: string): number {
  checkDate(day)
  const nextUtcDate = Date.parse(`${day}T00:00:00Z`) + 24 * 60 * 60 * 1000
  let before = nextUtcDate - 3 * 60 * 60 * 1000
  let after = nextUtcDate + 60 * 60 * 1000
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2)
    if (dailyDate(middle) === day) before = middle
    else after = middle
  }
  return after
}

/** Stable for a given date and set of eligible IDs, regardless of JSON order. */
export function createDailyRound(day: string, pool: Weapon[]): Round {
  checkDate(day)
  const answers = pool.filter(canBeAnswer).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  if (!answers.length) throw new Error('No daily weapons')
  const seed = `destinydoku:weapons:daily:v2:${day}`
  let hash = 2166136261
  for (let index = 0; index < seed.length; index++) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619)
  return { answerId: answers[(hash >>> 0) % answers.length].id, guessIds: [] }
}

/** Test resets choose another eligible weapon whenever an alternative exists. */
export function createDevelopmentDailyRound(pool: Weapon[], previousAnswerId?: string, random = Math.random): Round {
  const eligible = pool.filter(canBeAnswer)
  const alternatives = eligible.filter((weapon) => weapon.id !== previousAnswerId)
  return createRound(alternatives.length ? alternatives : eligible, random)
}

export function dailyStorageKey(day: string): string {
  checkDate(day)
  return `destinydoku:weapons:daily:v1:${day}`
}

export function restoreDailyRound(raw: string | null, pool: Weapon[], signature: string, day: string): Round | null {
  const round = restoreRound(raw, pool, signature)
  if (!round) return null
  try {
    if (JSON.parse(raw!).dayKey !== day || round.answerId !== createDailyRound(day, pool).answerId) return null
    return round
  } catch { return null }
}

export function resetCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, '0')).join(':')
}
