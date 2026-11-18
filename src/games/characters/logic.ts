import type { Character, CharacterRelease } from '../../types/character'
import { compareSets, incorrectGuesses, roundStatus } from '../weapons/logic'
import type { ShareContext, WeaponMode } from '../weapons/logic'

export { incorrectGuesses, roundStatus }
export type { ShareContext }
export type CharacterMode = WeaponMode
export type HintId = 'first-letter' | 'release'
export type Round = { answerId: string; guessIds: string[]; revealedHints?: HintId[]; runId?: string; completedAt?: string }
export type Match = 'exact' | 'partial' | 'wrong' | 'unknown'
export type Column = 'species' | 'gender' | 'guardianClass' | 'affiliations' | 'roles' | 'debutGame' | 'release'
export type Clue = { column: Column; value: string; match: Match; direction?: 'earlier' | 'later' }
export const columns: { id: Column; label: string }[] = [
  { id: 'species', label: 'Being type' }, { id: 'gender', label: 'Gender' },
  { id: 'guardianClass', label: 'Class' }, { id: 'affiliations', label: 'Affiliation' },
  { id: 'roles', label: 'Role' }, { id: 'debutGame', label: 'Debut game' },
  { id: 'release', label: 'D2 introduction' },
]
export const characterHints: { id: HintId; title: string; after: number }[] = [
  { id: 'first-letter', title: 'First letter', after: 3 },
  { id: 'release', title: 'D2 introduction', after: 5 },
]
export function normalize(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
export function characterSearchNames(character: Character): string[] {
  return [character.name, ...character.aliases].flatMap(name => [normalize(name), normalize(name.replace(/^the\s+/i, ''))])
}
export function searchCharacters(pool: Character[], query: string, guessedIds: string[]): Character[] {
  const search = normalize(query), guessed = new Set(guessedIds)
  if (!search) return []
  return pool.filter(character => !guessed.has(character.id)).map(character => {
    const [full, short, ...aliases] = characterSearchNames(character)
    const rank = [full, short].includes(search) ? 0 : aliases.includes(search) ? 1
      : [full, short].some(name => name.startsWith(search)) ? 2
      : aliases.some(name => name.startsWith(search)) ? 3
      : [character.name, ...character.aliases].some(name => name.split(/[\s/]+/).some(word => normalize(word).startsWith(search))) ? 4 : Infinity
    return { character, rank, sortName: short }
  }).filter(entry => Number.isFinite(entry.rank))
    .sort((a, b) => a.rank - b.rank || a.sortName.localeCompare(b.sortName) || a.character.id.localeCompare(b.character.id))
    .map(entry => entry.character)
}
export function formatRelease(release: CharacterRelease): string {
  return `S${release.seasonNumber} · ${release.name} (${release.year})`
}
export function evaluateGuess(guess: Character, answer: Character, releases: CharacterRelease[]): Clue[] {
  const scalar = (column: Column, value: string | null, target: string | null): Clue => ({
    column, value: value ?? 'Not recorded',
    match: guess.id === answer.id ? 'exact' : value === null || target === null ? 'unknown' : value === target ? 'exact' : 'wrong',
  })
  const sets = (column: Column, value: string[] | null, target: string[] | null): Clue => ({
    column, value: value?.join(' / ') ?? 'Not recorded',
    match: guess.id === answer.id ? 'exact' : value === null || target === null ? 'unknown' : compareSets(value, target),
  })
  const g = releases.find(release => release.id === guess.firstReleaseId)
  const a = releases.find(release => release.id === answer.firstReleaseId)
  if (!g || !a) throw new Error('Missing character release')
  return [scalar('species', guess.species, answer.species), scalar('gender', guess.gender, answer.gender),
    scalar('guardianClass', guess.guardianClass, answer.guardianClass), sets('affiliations', guess.affiliations, answer.affiliations),
    sets('roles', guess.roles, answer.roles), scalar('debutGame', guess.debutGame === 'destiny1' ? 'Destiny 1' : 'Destiny 2', answer.debutGame === 'destiny1' ? 'Destiny 1' : 'Destiny 2'),
    { column: 'release', value: formatRelease(g), match: g.id === a.id ? 'exact' : g.year === a.year ? 'partial' : 'wrong',
      ...(g.id === a.id ? {} : { direction: g.order < a.order ? 'later' : 'earlier' }) },
  ]
}
export function createRound(pool: Character[], random = Math.random): Round {
  if (!pool.length) throw new Error('No playable characters')
  return { answerId: pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))].id, guessIds: [] }
}
export function identifyPracticeRound(round: Round): Round {
  return round.runId || roundStatus(round) === 'won' ? round : { ...round, runId: crypto.randomUUID() }
}
export function submitGuess(round: Round, id: string, pool: Character[]): Round {
  if (roundStatus(round) !== 'playing' || round.guessIds.includes(id) || !pool.some(character => character.id === id)) return round
  return { ...round, guessIds: [...round.guessIds, id] }
}
export function revealHint(round: Round, hintId: HintId): Round {
  const hint = characterHints.find(entry => entry.id === hintId)
  if (!hint || roundStatus(round) !== 'playing' || incorrectGuesses(round) < hint.after || round.revealedHints?.includes(hintId)) return round
  return { ...round, revealedHints: [...round.revealedHints ?? [], hintId] }
}
export function catalogSignature(pool: Character[], releases: CharacterRelease[]): string {
  let hash = 2166136261
  const text = JSON.stringify([pool.map(character => ({ ...character, icon: undefined })), releases])
  for (const letter of text) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(16)
}
export function restoreRound(raw: string | null, pool: Character[], signature: string): Round | null {
  try {
    if (!raw) return null
    const saved = JSON.parse(raw), round = saved.round
    if (saved.version !== 1 || saved.signature !== signature || !round || !Array.isArray(round.guessIds)) return null
    const ids = new Set(pool.map(character => character.id))
    if (!ids.has(round.answerId) || round.guessIds.some((id: unknown) => typeof id !== 'string' || !ids.has(id)) || new Set(round.guessIds).size !== round.guessIds.length) return null
    const win = round.guessIds.indexOf(round.answerId)
    if (win !== -1 && win !== round.guessIds.length - 1) return null
    const restored: Round = { answerId: round.answerId, guessIds: [...round.guessIds] }
    if (typeof round.runId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(round.runId)) {
      restored.runId = round.runId
      if (win !== -1 && typeof round.completedAt === 'string' && Number.isFinite(Date.parse(round.completedAt))) restored.completedAt = round.completedAt
    }
    if (Array.isArray(round.revealedHints)) restored.revealedHints = characterHints.filter(hint => round.revealedHints.includes(hint.id) && incorrectGuesses(restored) >= hint.after).map(hint => hint.id)
    return restored
  } catch { return null }
}
export function buildGuessGrid(round: Round, pool: Character[], releases: CharacterRelease[]): Clue[][] {
  const answer = pool.find(character => character.id === round.answerId)
  if (!answer) throw new Error('Unknown character answer')
  return round.guessIds.map(id => {
    const guess = pool.find(character => character.id === id)
    if (!guess) throw new Error('Unknown character guess')
    return evaluateGuess(guess, answer, releases)
  })
}
export function buildShareText(round: Round, pool: Character[], releases: CharacterRelease[], context: ShareContext = { mode: 'practice' }): string {
  if (roundStatus(round) !== 'won') return ''
  const squares = { exact: '🟩', partial: '🟨', wrong: '🟥', unknown: '⬜' }
  const rows = buildGuessGrid(round, pool, releases).map(clues => clues.map(clue => squares[clue.match]).join(''))
  return [`DestinyDoku Characters · ${context.mode === 'daily' ? `Daily ${context.dayKey}` : 'Practice'} · ${round.guessIds.length} ${round.guessIds.length === 1 ? 'guess' : 'guesses'}`,
    ...(round.revealedHints?.length ? [`Hints used: ${round.revealedHints.length}/2`] : []), ...rows,
    `https://destinydoku.com/characters${context.mode === 'daily' ? '/daily' : ''}`].join('\n')
}
