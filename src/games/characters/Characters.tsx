import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { characters, releases } from './data'
import {
  catalogSignature, columns, createRound, evaluateGuess,
  formatRelease, identifyPracticeRound, incorrectGuesses, revealHint, characterHints,
  normalize, restoreRound, roundStatus, searchCharacters, submitGuess, characterSearchNames,
} from './logic'
import '../weapons/weapons.css'
import './characters.css'
import ClueIcons from './ClueIcons'
import { assetUrl } from '../weapons/assets'
import CategoryHelp from './CategoryHelp'
import WinSummary from './WinSummary'
import DailyCounter from '../weapons/DailyCounter'
import type { HelpCategory } from './CategoryHelp'
import type { Round, ShareContext, CharacterMode } from './logic'
import { createDailyRound, createDevelopmentDailyRound, dailyDate, dailyStorageKey, DEVELOPMENT_DAILY_KEY, nextDailyReset, PRACTICE_STORAGE_KEY, resetCountdown, restoreDailyRound } from './daily'

const signature = catalogSignature(characters, releases)
const matchLabels = { exact: 'Match', partial: 'Partial match', wrong: 'No match', unknown: 'Not recorded; comparison unavailable' }

function loadRound(mode: CharacterMode, dayKey: string, developmentAnswerId?: string) {
  const fresh = () => mode === 'daily' ? createDailyRound(dayKey, characters) : identifyPracticeRound(createRound(characters))
  if (import.meta.env.DEV) return mode === 'daily' && developmentAnswerId ? { answerId: developmentAnswerId, guessIds: [] } : fresh()
  try {
    if (mode === 'daily') return restoreDailyRound(localStorage.getItem(dailyStorageKey(dayKey)), characters, signature, dayKey) ?? fresh()
    return identifyPracticeRound(restoreRound(localStorage.getItem(PRACTICE_STORAGE_KEY), characters, signature) ?? createRound(characters))
  } catch { return fresh() }
}

export default function Characters({ mode = 'practice' }: { mode?: CharacterMode }) {
  const [now, setNow] = useState(() => Date.now())
  const [developmentRevision, setDevelopmentRevision] = useState(0)
  const [developmentDaily, setDevelopmentDaily] = useState<Round | null>(() => {
    if (!import.meta.env.DEV) return null
    let previous: string | undefined
    try { previous = sessionStorage.getItem(DEVELOPMENT_DAILY_KEY) ?? undefined } catch { /* Optional test-session memory. */ }
    return createDevelopmentDailyRound(characters, previous)
  })
  const refreshClock = useCallback(() => setNow(Date.now()), [])
  const dayKey = dailyDate(now)
  const resetAt = useMemo(() => nextDailyReset(dayKey), [dayKey])
  useEffect(() => {
    const hot = import.meta.hot
    if (!hot) return
    const reset = () => {
      setDevelopmentDaily((previous) => createDevelopmentDailyRound(characters, previous?.answerId))
      setDevelopmentRevision((revision) => revision + 1)
    }
    hot.on('destinydoku:reset-characters', reset)
    return () => hot.off('destinydoku:reset-characters', reset)
  }, [])
  useEffect(() => {
    if (!import.meta.env.DEV || !developmentDaily) return
    try { sessionStorage.setItem(DEVELOPMENT_DAILY_KEY, developmentDaily.answerId) } catch { /* Resets still work within this page. */ }
  }, [developmentDaily])
  useEffect(() => {
    const timer = window.setInterval(refreshClock, 1000)
    window.addEventListener('focus', refreshClock)
    document.addEventListener('visibilitychange', refreshClock)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshClock)
      document.removeEventListener('visibilitychange', refreshClock)
    }
  }, [refreshClock])
  return (
    <section className="weapons-page characters-page" aria-labelledby="characters-title">
      <p className="eyebrow">Destiny 2 · {mode === 'daily' ? 'Daily challenge' : 'Unlimited practice'}</p>
      <h1 id="characters-title">Characters</h1>
      <nav className="weapon-mode-tabs" aria-label="Characters game modes">
        <a href="/characters/practice" aria-current={mode === 'practice' ? 'page' : undefined}>Unlimited practice</a>
        <a href="/characters/daily" aria-current={mode === 'daily' ? 'page' : undefined}>Daily challenge</a>
      </nav>
      <p className="weapons-description">{mode === 'daily' ? 'One character for everyone today. Guess until you get it right.' : 'One hidden character. Guess until you get it right. Use each comparison to narrow down the cast.'}</p>
      {mode === 'daily' && <p className="daily-schedule">Next daily in <span className="reset-countdown">{resetCountdown(resetAt - now)}</span></p>}
      <CharacterRound key={`${mode === 'daily' ? `daily:${dayKey}` : 'practice'}:${developmentRevision}`} mode={mode} dayKey={dayKey} onDateChange={refreshClock} developmentAnswerId={developmentDaily?.answerId} />
    </section>
  )
}

const CharacterRound = memo(function CharacterRound({ mode, dayKey, onDateChange, developmentAnswerId }: { mode: CharacterMode; dayKey: string; onDateChange: () => void; developmentAnswerId?: string }) {
  const [round, setRound] = useState(() => loadRound(mode, dayKey, developmentAnswerId))
  const [query, setQuery] = useState('')
  const [helpCategory, setHelpCategory] = useState<HelpCategory | null>(null)
  const [error, setError] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [revealingGuessId, setRevealingGuessId] = useState<string | null>(null)
  const picker = useRef<HTMLFormElement>(null)
  const [storageUnavailable, setStorageUnavailable] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const status = roundStatus(round)
  const answer = characters.find((character) => character.id === round.answerId)!
  const matches = searchCharacters(characters, query, round.guessIds)
  const candidates = matches.slice(0, 20)
  const hasSearch = normalize(query).length > 0
  
  const shareContext: ShareContext = mode === 'daily' ? { mode, dayKey } : { mode: 'practice' }

  useEffect(() => {
    if (import.meta.env.DEV) return
    let active = true
    try {
      const storageKey = mode === 'daily' ? dailyStorageKey(dayKey) : PRACTICE_STORAGE_KEY
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, signature, round, ...(mode === 'daily' ? { dayKey } : {}) }))
    } catch {
      // The game remains playable when browser storage is blocked or full.
      queueMicrotask(() => { if (active) setStorageUnavailable(true) })
    }
    return () => { active = false }
  }, [round, mode, dayKey])

  useEffect(() => {
    function dismissSuggestions(event: PointerEvent) {
      if (event.target instanceof Node && !picker.current?.contains(event.target)) {
        setSuggestionsOpen(false)
      }
    }
    document.addEventListener('pointerdown', dismissSuggestions)
    return () => document.removeEventListener('pointerdown', dismissSuggestions)
  }, [])

  function guess(characterId: string) {
    if (mode === 'daily' && dailyDate() !== dayKey) {
      onDateChange()
      return
    }
    let next = submitGuess(round, characterId, characters)
    if (next === round) {
      setError('Choose a character you haven’t guessed yet.')
      return
    }
    if (mode === 'practice' && roundStatus(next) === 'won' && next.runId) next = { ...next, completedAt: new Date().toISOString() }
    setRevealingGuessId(characterId)
    setRound(next)
    setQuery('')
    setSuggestionsOpen(false)
    setError('')
    input.current?.focus()
  }

  function playAgain() {
    if (mode !== 'practice') return
    setRound(identifyPracticeRound(createRound(characters)))
    setRevealingGuessId(null)
    setQuery('')
    setError('')
  }

  function openCategory(event: MouseEvent<HTMLButtonElement>, category: HelpCategory) {
    // Safari needs an explicit focus target to restore after the dialog closes.
    event.currentTarget.focus({ preventScroll: true })
    setHelpCategory(category)
  }

  return (
    <>
      <div className="round-summary" role="status">
        <strong>{status === 'playing' ? `${round.guessIds.length} guesses · No guess limit` : 'Character identified'}</strong>
      </div>
      {storageUnavailable && <p className="storage-note">Browser storage is unavailable. This round will not be saved on refresh.</p>}
      <DailyCounter game="characters" mode={mode} dayKey={dayKey} completed={status === 'won'} runId={round.runId} completedAt={round.completedAt} />

      {status === 'playing' ? (
        <form ref={picker} className="weapon-picker"
          onKeyDown={(event) => { if (event.key === 'Escape') setSuggestionsOpen(false) }}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSuggestionsOpen(false) }}
          onSubmit={(event) => {
          event.preventDefault()
          if (!hasSearch) {
            setError('Start typing a character name to see matching options.')
            return
          }
          const exact = matches.find((character) => characterSearchNames(character).includes(normalize(query)))
          const choice = exact ?? matches[0]
          if (choice) guess(choice.id)
          else setError('No unguessed characters match your search.')
        }}>
          <label className="sr-only" htmlFor="character-search">Search characters</label>
          <div className="guess-controls">
            <input ref={input} id="character-search" type="search" autoComplete="off" value={query}
              placeholder="Character name or alias…"
              aria-expanded={hasSearch && suggestionsOpen} aria-controls={hasSearch && suggestionsOpen ? 'character-suggestions' : undefined}
              onFocus={() => setSuggestionsOpen(true)}
              onChange={(event) => { setQuery(event.target.value); setError(''); setSuggestionsOpen(true) }} />
            <button type="submit">Submit guess</button>
          </div>
          {hasSearch && suggestionsOpen && <ul id="character-suggestions" className="weapon-suggestions" aria-label="Matching characters">
            {candidates.map((character) => (
              <li key={character.id}>
                <button type="button" className="weapon-suggestion" aria-label={`Guess ${character.name}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => guess(character.id)}>
                <img src={assetUrl(character.icon!)} alt="" width="64" height="64" loading="lazy" />
                <span className="suggestion-name">{character.name}</span>
                <span className="suggestion-select" aria-hidden="true">Select</span>
                </button>
              </li>
            ))}
            {matches.length > candidates.length && <li className="no-suggestions">Showing the first 20 of {matches.length} matches. Keep typing to narrow your search.</li>}
            {!candidates.length && <li className="no-suggestions">No unguessed characters match your search.</li>}
          </ul>}
          {error && <p className="guess-error" role="alert">{error}</p>}
        </form>
      ) : (
        <div className={`round-result ${status}`} role="status">
          <p className="eyebrow">Character identified</p>
          <h2>Identified in {round.guessIds.length}</h2>
          <p>The answer was {answer.name}.</p>
          {mode === 'practice' ? <button type="button" onClick={playAgain}>Play again</button> : <>
            <p>Daily complete. A new character arrives when the countdown reaches zero.</p>
            <a className="daily-practice-link" href="/characters/practice">Keep playing in practice →</a>
          </>}
        </div>
      )}

      {round.guessIds.length > 0 && <section className="weapon-hints" aria-label="Optional character hints">
        {characterHints.map((hint) => {
          const revealed = round.revealedHints?.includes(hint.id)
          const remaining = Math.max(0, hint.after - incorrectGuesses(round))
          return <div className={`weapon-hint${revealed ? ' is-revealed' : ''}`} key={hint.id}>
            <h2>{hint.title}</h2>
            {revealed ? <p className="hint-value">{hint.id === 'first-letter'
              ? answer.name.match(/[\p{L}\p{N}]/u)?.[0].toLocaleUpperCase() ?? answer.name.charAt(0)
              : formatRelease(releases.find((release) => release.id === answer.firstReleaseId)!)}</p>
              : <button type="button" disabled={remaining > 0 || status !== 'playing'}
                onClick={() => {
                  if (mode === 'daily' && dailyDate() !== dayKey) { onDateChange(); return }
                  setRound((previous) => revealHint(previous, hint.id))
                }} aria-label={`Reveal ${hint.title.toLowerCase()} hint`}>
                {remaining > 0 ? `${remaining} more incorrect ${remaining === 1 ? 'guess' : 'guesses'}` : status === 'won' ? 'Round complete' : 'Reveal hint'}
              </button>}
          </div>
        })}
      </section>}

      <div className="table-scroll" role="region" aria-label="Guess comparisons, scroll horizontally for all clues" tabIndex={0}>
        <table className="guess-table">
          <caption>Guess history · {round.guessIds.length} guesses · Newest first</caption>
          <thead><tr><th scope="col"><button className="category-heading" onClick={(event) => openCategory(event, 'character')} aria-haspopup="dialog">Character <span aria-hidden="true">ⓘ</span></button></th>{columns.map((column) => <th scope="col" key={column.id}><button className="category-heading" onClick={(event) => openCategory(event, column.id)} aria-haspopup="dialog">{column.label} <span aria-hidden="true">ⓘ</span></button></th>)}</tr></thead>
          <tbody>
            {[...round.guessIds].reverse().map((id, index) => {
              const character = characters.find((entry) => entry.id === id)!
              return (
                <tr key={id} className={id === revealingGuessId ? 'guess-reveal' : undefined}>
                  <th scope="row" className="weapon-image-cell">
                    <span className="weapon-portrait" tabIndex={0} aria-label={`Guess ${round.guessIds.length - index}: ${character.name}`}>
                      <img src={assetUrl(character.icon!)} alt={character.name} width="96" height="96" />
                      <span className="weapon-tooltip" aria-hidden="true">{character.name}</span>
                      <span className="guess-number" aria-hidden="true">{round.guessIds.length - index}</span>
                    </span>
                  </th>
                  {evaluateGuess(character, answer, releases).map((clue, columnIndex) => (
                    <td key={clue.column} className={`clue-${clue.match}`} style={{ animationDelay: `${(columnIndex + 1) * 220}ms` }}>
                      <ClueIcons column={clue.column} character={character} />
                      <span className="clue-value">{clue.value}</span>
                      <span className={clue.column === 'release' ? "clue-feedback" : "sr-only"}>
                        {clue.direction ? `${clue.direction === 'later' ? '↑' : '↓'} Answer is ${clue.direction}` : `${clue.match === 'exact' ? '✓' : clue.match === 'partial' ? '≈' : '×'} ${matchLabels[clue.match]}`}
                      </span>
                    </td>
                  ))}
                </tr>
              )
            })}
            {!round.guessIds.length && <tr><td colSpan={columns.length + 1} className="empty-history">Your first guess will reveal the first clues.</td></tr>}
          </tbody>
        </table>
      </div>
      {status === 'won' && <WinSummary key={round.answerId + round.guessIds.join(',')} round={round} pool={characters} releases={releases} context={shareContext} />}
      <details className="weapon-rules">
        <summary>How the clues work</summary>
        <p>Being type, gender, class and debut game compare directly. Affiliation and role can contain several values: green means identical sets, yellow means some overlap and red means no overlap.</p>
        <p>Unrecorded gender or affiliation values are gray when a comparison cannot be made. Unknown being type is an explicit category. The correct character always wins, even when another character shares all their clues.</p>
        <p>D2 introduction uses the agreed character introduction, including selected raid reprises. Yellow means a different release in the same year; arrows point toward the answer’s release. Optional hints unlock after 3 and 5 incorrect guesses and reveal only when clicked.</p>
        <p>Practice and daily progress are saved separately on this browser when storage is available. Daily challenges reset when the countdown reaches zero. After a dataset update, incompatible saved rounds start fresh.</p>
      </details>
      <a className="back-link" href="/">← All games</a>
      {helpCategory && <CategoryHelp key={helpCategory} category={helpCategory} onClose={() => setHelpCategory(null)} />}
    </>
  )
})
