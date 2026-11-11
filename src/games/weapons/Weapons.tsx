import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playableWeapons, releases } from '../../data/destiny2'
import {
  canBeAnswer, catalogSignature, columns, createRound, evaluateGuess,
  normalize, restoreRound, roundStatus, searchWeapons, submitGuess,
} from './logic'
import './weapons.css'
import ClueIcons from './ClueIcons'
import { assetUrl } from './assets'
import CategoryHelp from './CategoryHelp'
import WinSummary from './WinSummary'
import type { HelpCategory } from './CategoryHelp'
import type { Round, ShareContext, WeaponMode } from './logic'
import { createDailyRound, createDevelopmentDailyRound, dailyDate, dailyStorageKey, DEVELOPMENT_DAILY_KEY, nextDailyReset, PRACTICE_STORAGE_KEY, resetCountdown, restoreDailyRound } from './daily'

const signature = catalogSignature(playableWeapons, releases)
const matchLabels = { exact: 'Match', partial: 'Partial match', wrong: 'No match' }

function loadRound(mode: WeaponMode, dayKey: string, developmentAnswerId?: string) {
  const fresh = () => mode === 'daily' ? createDailyRound(dayKey, playableWeapons) : createRound(playableWeapons)
  if (import.meta.env.DEV) return mode === 'daily' && developmentAnswerId ? { answerId: developmentAnswerId, guessIds: [] } : fresh()
  try {
    if (mode === 'daily') return restoreDailyRound(localStorage.getItem(dailyStorageKey(dayKey)), playableWeapons, signature, dayKey) ?? fresh()
    return restoreRound(localStorage.getItem(PRACTICE_STORAGE_KEY), playableWeapons, signature) ?? fresh()
  } catch { return fresh() }
}

export default function Weapons({ mode = 'practice' }: { mode?: WeaponMode }) {
  const [now, setNow] = useState(() => Date.now())
  const [developmentRevision, setDevelopmentRevision] = useState(0)
  const [developmentDaily, setDevelopmentDaily] = useState<Round | null>(() => {
    if (!import.meta.env.DEV) return null
    let previous: string | undefined
    try { previous = sessionStorage.getItem(DEVELOPMENT_DAILY_KEY) ?? undefined } catch { /* Optional test-session memory. */ }
    return createDevelopmentDailyRound(playableWeapons, previous)
  })
  const refreshClock = useCallback(() => setNow(Date.now()), [])
  const dayKey = dailyDate(now)
  const resetAt = useMemo(() => nextDailyReset(dayKey), [dayKey])
  useEffect(() => {
    const hot = import.meta.hot
    if (!hot) return
    const reset = () => {
      setDevelopmentDaily((previous) => createDevelopmentDailyRound(playableWeapons, previous?.answerId))
      setDevelopmentRevision((revision) => revision + 1)
    }
    hot.on('destinydoku:reset-weapons', reset)
    return () => hot.off('destinydoku:reset-weapons', reset)
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
    <section className="weapons-page" aria-labelledby="weapons-title">
      <p className="eyebrow">Destiny 2 · {mode === 'daily' ? 'Daily challenge' : 'Unlimited practice'}</p>
      <h1 id="weapons-title">Weapons</h1>
      <nav className="weapon-mode-tabs" aria-label="Weapons game modes">
        <a href="#/weapons/practice" aria-current={mode === 'practice' ? 'page' : undefined}>Unlimited practice</a>
        <a href="#/weapons/daily" aria-current={mode === 'daily' ? 'page' : undefined}>Daily challenge</a>
      </nav>
      <p className="weapons-description">{mode === 'daily' ? 'One weapon for everyone today. Guess until you get it right.' : 'One hidden weapon. Guess until you get it right. Use each comparison to narrow down the arsenal.'}</p>
      {mode === 'daily' && <p className="daily-schedule">Next daily in <span className="reset-countdown">{resetCountdown(resetAt - now)}</span></p>}
      <WeaponRound key={`${mode === 'daily' ? `daily:${dayKey}` : 'practice'}:${developmentRevision}`} mode={mode} dayKey={dayKey} onDateChange={refreshClock} developmentAnswerId={developmentDaily?.answerId} />
    </section>
  )
}

const WeaponRound = memo(function WeaponRound({ mode, dayKey, onDateChange, developmentAnswerId }: { mode: WeaponMode; dayKey: string; onDateChange: () => void; developmentAnswerId?: string }) {
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
  const answer = playableWeapons.find((weapon) => weapon.id === round.answerId)!
  const matches = searchWeapons(playableWeapons, query, round.guessIds)
  const candidates = matches.slice(0, 20)
  const hasSearch = normalize(query).length > 0
  const classifiedDiscovery = round.guessIds.some((id) => playableWeapons.some((weapon) => weapon.id === id && !canBeAnswer(weapon)))
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

  function guess(weaponId: string) {
    if (mode === 'daily' && dailyDate() !== dayKey) {
      onDateChange()
      return
    }
    const next = submitGuess(round, weaponId, playableWeapons)
    if (next === round) {
      setError('Choose a weapon you haven’t guessed yet.')
      return
    }
    setRevealingGuessId(weaponId)
    setRound(next)
    setQuery('')
    setSuggestionsOpen(false)
    setError('')
    input.current?.focus()
  }

  function playAgain() {
    if (mode !== 'practice') return
    setRound(createRound(playableWeapons))
    setRevealingGuessId(null)
    setQuery('')
    setError('')
  }

  return (
    <>
      <div className="round-summary" role="status">
        <strong>{status === 'playing' ? `${round.guessIds.length} guesses · No guess limit` : 'Weapon identified'}</strong>
      </div>
      {storageUnavailable && <p className="storage-note">Browser storage is unavailable. This round will not be saved on refresh.</p>}
      {classifiedDiscovery && <p className="classified-discovery" role="status"><strong>Classified discovery.</strong> Even the Cryptarchs couldn’t get this one.</p>}

      {status === 'playing' ? (
        <form ref={picker} className="weapon-picker"
          onKeyDown={(event) => { if (event.key === 'Escape') setSuggestionsOpen(false) }}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSuggestionsOpen(false) }}
          onSubmit={(event) => {
          event.preventDefault()
          if (!hasSearch) {
            setError('Start typing a weapon name to see matching options.')
            return
          }
          const exact = matches.find((weapon) => [weapon.name, ...weapon.aliases].some((name) => normalize(name) === normalize(query)))
          const choice = exact ?? matches[0]
          if (choice) guess(choice.id)
          else setError('No unguessed weapons match your search.')
        }}>
          <label className="sr-only" htmlFor="weapon-search">Search the arsenal</label>
          <div className="guess-controls">
            <input ref={input} id="weapon-search" type="search" autoComplete="off" value={query}
              placeholder="Weapon name or alias…"
              aria-expanded={hasSearch && suggestionsOpen} aria-controls={hasSearch && suggestionsOpen ? 'weapon-suggestions' : undefined}
              onFocus={() => setSuggestionsOpen(true)}
              onChange={(event) => { setQuery(event.target.value); setError(''); setSuggestionsOpen(true) }} />
            <button type="submit">Submit guess</button>
          </div>
          {hasSearch && suggestionsOpen && <ul id="weapon-suggestions" className="weapon-suggestions" aria-label="Matching weapons">
            {candidates.map((weapon) => (
              <li key={weapon.id}>
                <button type="button" className="weapon-suggestion" aria-label={`Guess ${weapon.name}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => guess(weapon.id)}>
                <img src={assetUrl(weapon.icon!)} alt="" width="64" height="64" loading="lazy" />
                <span className="suggestion-name">{weapon.name}</span>
                <span className="suggestion-select" aria-hidden="true">Select</span>
                </button>
              </li>
            ))}
            {matches.length > candidates.length && <li className="no-suggestions">Showing the first 20 of {matches.length} matches. Keep typing to narrow your search.</li>}
            {!candidates.length && <li className="no-suggestions">No unguessed weapons match your search.</li>}
          </ul>}
          {error && <p className="guess-error" role="alert">{error}</p>}
        </form>
      ) : (
        <div className={`round-result ${status}`} role="status">
          <p className="eyebrow">Weapon identified</p>
          <h2>Identified in {round.guessIds.length}</h2>
          <p>The answer was {answer.name}.</p>
          {mode === 'practice' ? <button type="button" onClick={playAgain}>Play again</button> : <>
            <p>Daily complete. A new weapon arrives when the countdown reaches zero.</p>
            <a className="daily-practice-link" href="#/weapons/practice">Keep playing in practice →</a>
          </>}
        </div>
      )}

      <div className="table-scroll" role="region" aria-label="Guess comparisons, scroll horizontally for all clues" tabIndex={0}>
        <table className="guess-table">
          <caption>Guess history · {round.guessIds.length} guesses · Newest first</caption>
          <thead><tr><th scope="col"><button className="category-heading" onClick={() => setHelpCategory('weapon')} aria-haspopup="dialog">Weapon <span aria-hidden="true">ⓘ</span></button></th>{columns.map((column) => <th scope="col" key={column.id}><button className="category-heading" onClick={() => setHelpCategory(column.id)} aria-haspopup="dialog">{column.label} <span aria-hidden="true">ⓘ</span></button></th>)}</tr></thead>
          <tbody>
            {[...round.guessIds].reverse().map((id, index) => {
              const weapon = playableWeapons.find((entry) => entry.id === id)!
              return (
                <tr key={id} className={id === revealingGuessId ? 'guess-reveal' : undefined}>
                  <th scope="row" className="weapon-image-cell">
                    <span className="weapon-portrait" tabIndex={0} aria-label={`Guess ${round.guessIds.length - index}: ${weapon.name}`}>
                      <img src={assetUrl(weapon.icon!)} alt={weapon.name} width="96" height="96" />
                      <span className="weapon-tooltip" aria-hidden="true">{weapon.name}</span>
                      <span className="guess-number" aria-hidden="true">{round.guessIds.length - index}</span>
                    </span>
                  </th>
                  {evaluateGuess(weapon, answer, releases).map((clue, columnIndex) => (
                    <td key={clue.column} className={`clue-${clue.match}`} style={{ animationDelay: `${(columnIndex + 1) * 220}ms` }}>
                      <ClueIcons column={clue.column} weapon={weapon} />
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
      {status === 'won' && <WinSummary key={round.answerId + round.guessIds.join(',')} round={round} pool={playableWeapons} releases={releases} context={shareContext} />}
      <details className="weapon-rules">
        <summary>How the clues work</summary>
        <p>Attributes use the selected latest weapon version. “First introduced” uses the weapon’s original Destiny 2 release. Source compares categories such as Raid or Quest, rather than exact activities. Champion compares the complete set of built-in counters and excludes optional perks or external buffs.</p>
        <p>Damage types match regardless of their order: green means identical sets, yellow means some overlap, and red means no overlap. Release arrows point toward the answer’s release. Release tiles are yellow for different releases in the same calendar year. Matching every attribute does not guarantee the weapon name is correct.</p>
        <p>Practice and daily progress are saved separately on this browser when storage is available. Daily challenges reset when the countdown reaches zero. After a dataset update, incompatible saved rounds start fresh.</p>
      </details>
      <a className="back-link" href="#/">← All games</a>
      {helpCategory && <CategoryHelp key={helpCategory} category={helpCategory} onClose={() => setHelpCategory(null)} />}
    </>
  )
})
