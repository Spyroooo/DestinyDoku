import type { Character } from '../../types/character'
import { createRound, restoreRound } from './logic'
import type { Round } from './logic'
export { dailyDate, nextDailyReset, resetCountdown } from '../weapons/daily'

export const PRACTICE_STORAGE_KEY = 'destinydoku:characters:practice:v1'
export const DEVELOPMENT_DAILY_KEY = 'destinydoku:characters:development:last-daily-answer'
export function createDailyRound(day: string, pool: Character[]): Round {
  const key = dailyStorageKey(day)
  const answers = [...pool].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  if (!answers.length) throw new Error('No daily characters')
  let hash = 2166136261
  for (const letter of key) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619)
  return { answerId: answers[(hash >>> 0) % answers.length].id, guessIds: [] }
}
export function createDevelopmentDailyRound(pool: Character[], previous?: string, random = Math.random): Round {
  const alternatives = pool.filter(character => character.id !== previous)
  return createRound(alternatives.length ? alternatives : pool, random)
}
export function dailyStorageKey(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error('Invalid daily date')
  return `destinydoku:characters:daily:v1:${day}`
}
export function restoreDailyRound(raw: string | null, pool: Character[], signature: string, day: string): Round | null {
  const round = restoreRound(raw, pool, signature)
  if (!round) return null
  return JSON.parse(raw!).dayKey === day && round.answerId === createDailyRound(day, pool).answerId ? round : null
}
