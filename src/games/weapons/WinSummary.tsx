import { useRef, useState } from 'react'
import type { Release, Weapon } from '../../types/weapon'
import { buildGuessGrid, buildShareText } from './logic'
import type { Round, ShareContext } from './logic'

export default function WinSummary({ round, pool, releases, context = { mode: 'practice' } }: { round: Round; pool: Weapon[]; releases: Release[]; context?: ShareContext }) {
  const [copyStatus, setCopyStatus] = useState('')
  const [manualCopy, setManualCopy] = useState(false)
  const textArea = useRef<HTMLTextAreaElement>(null)
  const rows = buildGuessGrid(round, pool, releases)
  const shareText = buildShareText(round, pool, releases, context)
  const modeLabel = context.mode === 'daily' ? `Daily ${context.dayKey}` : 'Practice'

  async function copyResults() {
    try {
      await navigator.clipboard.writeText(shareText)
      setManualCopy(false)
      setCopyStatus('Results copied. Ready to share!')
    } catch {
      setManualCopy(true)
      setCopyStatus('Select the text below to copy your results manually.')
    }
  }

  return (
    <section className="win-summary" aria-labelledby="win-summary-title">
      <p className="eyebrow">Challenge complete</p>
      <h2 id="win-summary-title">Share your run</h2>
      <p>{round.guessIds.length} {round.guessIds.length === 1 ? 'guess' : 'guesses'} · Destiny 2 Weapons · {modeLabel}</p>
      <p className="summary-help">Oldest first</p>
      <ol className="share-grid" aria-label="Color summary of all guesses">
        {rows.map((clues, index) => (
          <li key={round.guessIds[index]}>
            <span className="summary-guess-number" aria-hidden="true">{index + 1}</span>
            <span className="summary-squares" role="img" aria-label={`Guess ${index + 1}: ${clues.filter((clue) => clue.match === 'exact').length} exact, ${clues.filter((clue) => clue.match === 'partial').length} partial, ${clues.filter((clue) => clue.match === 'wrong').length} missed clues`}>
              {clues.map((clue) => <span key={clue.column} className={`summary-square square-${clue.match}`} aria-hidden="true" />)}
            </span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={copyResults}>Share result</button>
      <p className="copy-status" role="status">{copyStatus}</p>
      {manualCopy && <label className="manual-share">Share text
        <textarea ref={textArea} value={shareText} readOnly rows={Math.min(round.guessIds.length + 3, 12)} onFocus={() => textArea.current?.select()} />
      </label>}
    </section>
  )
}
