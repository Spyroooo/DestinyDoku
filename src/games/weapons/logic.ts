import type { Release, Weapon, WeaponVersion } from '../../types/weapon'

export type Match = 'exact' | 'partial' | 'wrong'
export type Round = { answerId: string; guessIds: string[] }
export type Status = 'playing' | 'won'
export type WeaponMode = 'practice' | 'daily'
export type ShareContext = { mode: 'practice' } | { mode: 'daily'; dayKey: string }
export type Column = 'type' | 'ammo' | 'slot' | 'damage' | 'rarity' | 'source' | 'champion' | 'release'
export type Clue = { column: Column; value: string; match: Match; direction?: 'earlier' | 'later' }
export const columns: { id: Column; label: string }[] = [
  { id: 'type', label: 'Weapon type' }, { id: 'ammo', label: 'Ammo' },
  { id: 'slot', label: 'Slot' }, { id: 'damage', label: 'Damage' },
  { id: 'rarity', label: 'Rarity' }, { id: 'source', label: 'Source category' },
  { id: 'champion', label: 'Champion' }, { id: 'release', label: 'First introduced' },
]

export function currentVersion(weapon: Weapon): WeaponVersion {
  const version = weapon.versions.find((entry) => entry.id === weapon.currentVersionId)
  if (!version) throw new Error(`Missing version: ${weapon.id}`)
  return version
}

/** Unreleased discoveries are valid guesses, but never hidden answers. */
export function canBeAnswer(weapon: Weapon): boolean {
  return currentVersion(weapon).source.category !== 'unreleased'
}

export function label(value: string): string {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

export function compareSets(guess: string[], answer: string[]): Match {
  const a = new Set(guess)
  const b = new Set(answer)
  if (a.size === b.size && [...a].every((value) => b.has(value))) return 'exact'
  return [...a].some((value) => b.has(value)) ? 'partial' : 'wrong'
}

export function formatRelease(release: Release): string {
  return `${release.seasonNumber ? `S${release.seasonNumber} · ` : ''}${release.name} (${release.year})`
}

export function evaluateGuess(guess: Weapon, answer: Weapon, releases: Release[]): Clue[] {
  const g = currentVersion(guess)
  const a = currentVersion(answer)
  const scalar = (column: Column, value: string, target: string): Clue =>
    ({ column, value: label(value), match: value === target ? 'exact' : 'wrong' })
  const sets = (column: Column, values: string[], targets: string[], partial: boolean): Clue => {
    const result = compareSets(values, targets)
    return { column, value: values.map(label).join(' / '), match: !partial && result === 'partial' ? 'wrong' : result }
  }
  const guessRelease = releases.find((release) => release.id === guess.firstReleaseId)
  const answerRelease = releases.find((release) => release.id === answer.firstReleaseId)
  if (!guessRelease || !answerRelease) throw new Error('Missing release')
  return [
    scalar('type', g.weaponType, a.weaponType), scalar('ammo', g.ammoType, a.ammoType),
    scalar('slot', g.slot, a.slot), sets('damage', g.damageTypes, a.damageTypes, true),
    scalar('rarity', guess.rarity, answer.rarity), scalar('source', g.source.category, a.source.category),
    sets('champion', g.champion.counters ?? [], a.champion.counters ?? [], false),
    ...(!canBeAnswer(guess) ? [{ column: 'release' as const, value: 'Unreleased', match: 'wrong' as const }] : [{ column: 'release' as const, value: formatRelease(guessRelease), match: guessRelease.id === answerRelease.id ? 'exact' as const : guessRelease.year === answerRelease.year ? 'partial' as const : 'wrong' as const,
      ...(guessRelease.id !== answerRelease.id ? { direction: guessRelease.order < answerRelease.order ? 'later' as const : 'earlier' as const } : {}) },
    ]),
  ]
}

export function roundStatus(round: Round): Status {
  if (round.guessIds.includes(round.answerId)) return 'won'
  return 'playing'
}

export function createRound(pool: Weapon[], random = Math.random): Round {
  const answers = pool.filter(canBeAnswer)
  if (!answers.length) throw new Error('No playable weapons')
  return { answerId: answers[Math.min(answers.length - 1, Math.max(0, Math.floor(random() * answers.length)))].id, guessIds: [] }
}

export function submitGuess(round: Round, weaponId: string, pool: Weapon[]): Round {
  if (roundStatus(round) !== 'playing' || round.guessIds.includes(weaponId) || !pool.some((weapon) => weapon.id === weaponId)) return round
  return { ...round, guessIds: [...round.guessIds, weaponId] }
}

export function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function searchWeapons(pool: Weapon[], query: string, guessedIds: string[]): Weapon[] {
  const search = normalize(query)
  return pool.filter((weapon) => !guessedIds.includes(weapon.id) &&
    [weapon.name, ...weapon.aliases].some((name) => normalize(name).includes(search)))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Reject saves made against a different clue dataset.
export function catalogSignature(pool: Weapon[], releases: Release[]): string {
  const cluePool = pool.map((weapon) => { const value = { ...weapon }; delete value.icon; return value })
  const clueReleases = releases.map((release) => { const value = { ...release }; delete value.seasonNumber; return value })
  const text = JSON.stringify([cluePool, clueReleases])
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return (hash >>> 0).toString(16)
}

export function restoreRound(raw: string | null, pool: Weapon[], signature: string): Round | null {
  try {
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data.version !== 1 || data.signature !== signature) return null
    const round = data.round
    if (!round || typeof round.answerId !== 'string' || !Array.isArray(round.guessIds)) return null
    const ids = new Set(pool.map((weapon) => weapon.id))
    const answer = pool.find((weapon) => weapon.id === round.answerId)
    if (!answer || !canBeAnswer(answer)) return null
    if (!ids.has(round.answerId) || round.guessIds.length > pool.length ||
      round.guessIds.some((id: unknown) => typeof id !== 'string' || !ids.has(id)) ||
      new Set(round.guessIds).size !== round.guessIds.length) return null
    const winIndex = round.guessIds.indexOf(round.answerId)
    if (winIndex !== -1 && winIndex !== round.guessIds.length - 1) return null
    return { answerId: round.answerId, guessIds: [...round.guessIds] }
  } catch { return null }
}


/** Share results oldest first, without exposing weapon names or the answer. */
export function buildGuessGrid(round: Round, pool: Weapon[], releases: Release[]): Clue[][] {
  const answer = pool.find((weapon) => weapon.id === round.answerId)
  if (!answer) throw new Error('Unknown answer in summary')
  return round.guessIds.map((id) => {
    const guess = pool.find((weapon) => weapon.id === id)
    if (!guess) throw new Error('Unknown guess in summary')
    return evaluateGuess(guess, answer, releases)
  })
}

export function buildShareText(round: Round, pool: Weapon[], releases: Release[], context: ShareContext = { mode: 'practice' }): string {
  if (roundStatus(round) !== 'won') return ''
  const squares = { exact: '🟩', partial: '🟨', wrong: '🟥' }
  const rows = buildGuessGrid(round, pool, releases).map((clues) => clues.map((clue) => squares[clue.match]).join(''))
  const title = context.mode === 'daily' ? `Daily ${context.dayKey}` : 'Practice'
  const link = context.mode === 'daily' ? 'https://Spyroooo.github.io/DestinyDoku/#/weapons/daily' : 'https://Spyroooo.github.io/DestinyDoku/#/weapons'
  return [`DestinyDoku Weapons · ${title} · ${round.guessIds.length} ${round.guessIds.length === 1 ? 'guess' : 'guesses'}`, ...rows, link].join('\n')
}
