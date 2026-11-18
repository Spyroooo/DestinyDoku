import type { Release, Weapon, WeaponVersion } from '../../types/weapon'

export type Match = 'exact' | 'partial' | 'wrong'
export type HintId = 'first-letter' | 'source'
export type Round = { answerId: string; guessIds: string[]; revealedHints?: HintId[]; runId?: string; completedAt?: string }
export const weaponHints: { id: HintId; title: string; after: number }[] = [
  { id: 'first-letter', title: 'First letter', after: 3 },
  { id: 'source', title: 'Acquisition source', after: 5 },
]
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

const sourceGroupLabels: Record<string, string> = {
  blackarmory: 'Black Armory', brave: 'BRAVE Arsenal', crucible: 'Crucible',
  dreaming: 'Dreaming City', echoes: 'Episode: Echoes', edz: 'European Dead Zone',
  europa: 'Europa', events: 'Events', evidenceboard: 'Evidence Board',
  exoticquest: 'Exotic quest', gambit: 'Gambit', haunted: 'Season of the Haunted',
  heresy: 'Episode: Heresy', ironbanner: 'Iron Banner', legendaryengram: 'Legendary engrams',
  leviathan: 'Leviathan', mars: 'Mars', mercury: 'Mercury', moon: 'Moon',
  neomuna: 'Neomuna', nessus: 'Nessus', nightfall: 'Nightfall', pit: 'Pit of Heresy',
  plunder: 'Season of Plunder', prophecy: 'Prophecy', psiops: 'PsiOps Battlegrounds',
  raid: 'Raids', revenant: 'Episode: Revenant', rivenslair: 'Riven’s Lair',
  scourgeofthepast: 'Scourge of the Past', sonar: 'Season of the Deep',
  spireofthewatcher: 'Spire of the Watcher', strikes: 'Vanguard strikes',
  sundial: 'The Sundial', trials: 'Trials',
}

/** Presentation only: retain the original acquisition evidence in the catalogue. */
export function formatSourceName(name: string): string {
  const group = name.match(/^(.+?)\s*\(DIM curated source group\)$/i)
  if (!group) return name
  const key = group[1].trim()
  return sourceGroupLabels[key.toLowerCase()] ?? label(key.replace(/[_\s]+/g, '-'))
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

export function roundStatus(round: Pick<Round, 'answerId' | 'guessIds'>): Status {
  if (round.guessIds.includes(round.answerId)) return 'won'
  return 'playing'
}

export function createRound(pool: Weapon[], random = Math.random): Round {
  const answers = pool.filter(canBeAnswer)
  if (!answers.length) throw new Error('No playable weapons')
  return { answerId: answers[Math.min(answers.length - 1, Math.max(0, Math.floor(random() * answers.length)))].id, guessIds: [] }
}

export function identifyPracticeRound(round: Round): Round {
  // Legacy completed rounds have no known completion date; do not count them retroactively.
  return round.runId || roundStatus(round) === 'won' ? round : { ...round, runId: crypto.randomUUID() }
}

export function submitGuess(round: Round, weaponId: string, pool: Weapon[]): Round {
  if (roundStatus(round) !== 'playing' || round.guessIds.includes(weaponId) || !pool.some((weapon) => weapon.id === weaponId)) return round
  return { ...round, guessIds: [...round.guessIds, weaponId] }
}

export function incorrectGuesses(round: Pick<Round, 'answerId' | 'guessIds'>): number {
  return round.guessIds.filter((id) => id !== round.answerId).length
}

export function revealHint(round: Round, hintId: HintId): Round {
  const hint = weaponHints.find((entry) => entry.id === hintId)
  if (!hint || roundStatus(round) !== 'playing' || incorrectGuesses(round) < hint.after || round.revealedHints?.includes(hintId)) return round
  return { ...round, revealedHints: [...(round.revealedHints ?? []), hintId] }
}

export function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function weaponSearchNames(weapon: Weapon): string[] {
  return [weapon.name, ...weapon.aliases].flatMap((name) => [
    normalize(name), normalize(name.trim().replace(/^the\s+/i, '')),
  ])
}

export function searchWeapons(pool: Weapon[], query: string, guessedIds: string[]): Weapon[] {
  const search = normalize(query)
  const guessed = new Set(guessedIds)
  return pool.filter((weapon) => !guessed.has(weapon.id)).map((weapon) => {
    const [fullName, shortName, ...aliases] = weaponSearchNames(weapon)
    const names = [fullName, shortName]
    const rank = names.includes(search) ? 0
      : aliases.includes(search) ? 1
      : names.some((name) => name.startsWith(search)) ? 2
      : aliases.some((name) => name.startsWith(search)) ? 3
      : Infinity
    return { weapon, rank, sortName: shortName }
  }).filter((entry) => Number.isFinite(entry.rank))
    .sort((a, b) => a.rank - b.rank || a.sortName.localeCompare(b.sortName) || a.weapon.id.localeCompare(b.weapon.id))
    .map((entry) => entry.weapon)
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
    const restored: Round = { answerId: round.answerId, guessIds: [...round.guessIds] }
    if (typeof round.runId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(round.runId)) {
      restored.runId = round.runId
      if (winIndex !== -1 && typeof round.completedAt === 'string' && Number.isFinite(Date.parse(round.completedAt))) restored.completedAt = round.completedAt
    }
    if (Array.isArray(round.revealedHints)) {
      restored.revealedHints = weaponHints.filter((hint) => round.revealedHints.includes(hint.id) && incorrectGuesses(restored) >= hint.after).map((hint) => hint.id)
    }
    return restored
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
  const link = context.mode === 'daily' ? 'https://destinydoku.com/weapons/daily' : 'https://destinydoku.com/weapons'
  const hints = round.revealedHints?.length ? [`Hints used: ${round.revealedHints.length}/2`] : []
  return [`DestinyDoku Weapons · ${title} · ${round.guessIds.length} ${round.guessIds.length === 1 ? 'guess' : 'guesses'}`, ...hints, ...rows, link].join('\n')
}
