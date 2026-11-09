import { useEffect, useRef, useState } from 'react'
import { playableWeapons, releases } from '../../data/destiny2'
import {
  catalogSignature, columns, createRound, evaluateGuess,
  normalize, restoreRound, roundStatus, searchWeapons, submitGuess,
} from './logic'
import './weapons.css'
import ClueIcons, { assetUrl } from './ClueIcons'
import CategoryHelp from './CategoryHelp'
import type { HelpCategory } from './CategoryHelp'

const STORAGE_KEY = 'destinydoku:weapons:practice:v1'
const signature = catalogSignature(playableWeapons, releases)
const matchLabels = { exact: 'Match', partial: 'Partial match', wrong: 'No match' }

function loadRound() {
  try {
    return restoreRound(localStorage.getItem(STORAGE_KEY), playableWeapons, signature) ?? createRound(playableWeapons)
  } catch { return createRound(playableWeapons) }
}

export default function Weapons() {
  const [round, setRound] = useState(loadRound)
  const [query, setQuery] = useState('')
  const [helpCategory, setHelpCategory] = useState<HelpCategory | null>(null)
  const [error, setError] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const picker = useRef<HTMLFormElement>(null)
  const [storageUnavailable, setStorageUnavailable] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const status = roundStatus(round)
  const answer = playableWeapons.find((weapon) => weapon.id === round.answerId)!
  const candidates = searchWeapons(playableWeapons, query, round.guessIds)
  const hasSearch = normalize(query).length > 0

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, signature, round }))
    } catch {
      // The game remains playable when browser storage is blocked or full.
      setStorageUnavailable(true)
    }
  }, [round])

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
    const next = submitGuess(round, weaponId, playableWeapons)
    if (next === round) {
      setError('Choose a weapon you haven’t guessed yet.')
      return
    }
    setRound(next)
    setQuery('')
    setError('')
    input.current?.focus()
  }

  function playAgain() {
    setRound(createRound(playableWeapons))
    setQuery('')
    setError('')
  }

  return (
    <section className="weapons-page" aria-labelledby="weapons-title">
      <p className="eyebrow">Destiny 2 · Unlimited practice</p>
      <h1 id="weapons-title">Weapons</h1>
      <p className="weapons-description">One hidden weapon. Guess until you get it right. Use each comparison to narrow down the arsenal.</p>
      <div className="round-summary" role="status">
        <strong>{status === 'playing' ? `${round.guessIds.length} guesses · No guess limit` : 'Weapon identified'}</strong>
        <span>{playableWeapons.length} weapons in the starter pool</span>
      </div>
      {storageUnavailable && <p className="storage-note">Browser storage is unavailable. This round will not be saved on refresh.</p>}

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
          const exact = candidates.find((weapon) => [weapon.name, ...weapon.aliases].some((name) => normalize(name) === normalize(query)))
          const choice = exact ?? (candidates.length === 1 ? candidates[0] : undefined)
          if (choice) guess(choice.id)
          else setError('Select a weapon below or enter its full name.')
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
              <li key={weapon.id} className="weapon-suggestion">
                <img src={assetUrl(weapon.icon!)} alt="" width="64" height="64" />
                <span>{weapon.name}</span>
                <button type="button" aria-label={`Select ${weapon.name}`} onClick={() => guess(weapon.id)}>Select</button>
              </li>
            ))}
            {!candidates.length && <li className="no-suggestions">No unguessed weapons match your search.</li>}
          </ul>}
          {error && <p className="guess-error" role="alert">{error}</p>}
        </form>
      ) : (
        <div className={`round-result ${status}`} role="status">
          <p className="eyebrow">Arsenal mastered</p>
          <h2>{answer.name}</h2>
          <p>{`Identified in ${round.guessIds.length} ${round.guessIds.length === 1 ? 'guess' : 'guesses'}.`}</p>
          <button type="button" onClick={playAgain}>Play again</button>
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
                <tr key={id}>
                  <th scope="row" className="weapon-image-cell">
                    <span className="weapon-portrait" tabIndex={0} aria-label={`Guess ${round.guessIds.length - index}: ${weapon.name}`}>
                      <img src={assetUrl(weapon.icon!)} alt={weapon.name} width="96" height="96" />
                      <span className="weapon-tooltip" aria-hidden="true">{weapon.name}</span>
                      <span className="guess-number" aria-hidden="true">{round.guessIds.length - index}</span>
                    </span>
                  </th>
                  {evaluateGuess(weapon, answer, releases).map((clue) => (
                    <td key={clue.column} className={`clue-${clue.match}`}>
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
      <details className="weapon-rules">
        <summary>How the clues work</summary>
        <p>Attributes use the selected latest weapon version. “First introduced” uses the weapon’s original Destiny 2 release. Source compares categories such as Raid or Quest, rather than exact activities. Champion compares the complete set of built-in counters and excludes optional perks or external buffs.</p>
        <p>Damage types match regardless of their order: green means identical sets, yellow means some overlap, and red means no overlap. Release arrows point toward the answer’s release. Release tiles are yellow for different releases in the same calendar year. Matching every attribute does not guarantee the weapon name is correct.</p>
        <p>This is a curated starter pool. Progress is saved on this browser when storage is available. After a dataset update, incompatible saved rounds start fresh.</p>
      </details>
      <a className="back-link" href="#/">← All games</a>
      {helpCategory && <CategoryHelp key={helpCategory} category={helpCategory} onClose={() => setHelpCategory(null)} />}
    </section>
  )
}
