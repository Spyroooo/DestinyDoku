import { useEffect, useState } from 'react'
import { communityApiUrl } from '../../config/community'
import { completionClientId, markCompletionReported, pendingPracticeCompletions, queuePracticeCompletion, requestDailyCount, requestPracticeCount, submitPracticeCompletion } from './community'
import type { CommunityGame } from './community'
import type { WeaponMode } from './logic'

export default function DailyCounter({ game = 'weapons', mode = 'daily', dayKey, completed, runId, completedAt }: { game?: CommunityGame; mode?: WeaponMode; dayKey: string; completed: boolean; runId?: string; completedAt?: string }) {
  const [result, setResult] = useState<{ game: CommunityGame; mode: WeaponMode; dayKey: string; count: number } | null>(null)

  useEffect(() => {
    // Never send testing wins to the live counter, including localhost preview builds.
    if (import.meta.env.DEV || !communityApiUrl || !['destinydoku.com', 'www.destinydoku.com'].includes(window.location.hostname)) return
    if (mode === 'practice' && completed && runId && completedAt) queuePracticeCompletion({ runId, completedAt }, game)
    let active = true, inFlight = false
    let controller: AbortController | undefined
    async function refresh() {
      if (inFlight || document.hidden) return
      inFlight = true
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller?.abort(), 8000)
      try {
        const clientId = mode === 'daily' && completed ? completionClientId(dayKey, game) : undefined
        // A previous run's queued completion survives Play again, refreshes, and failed requests.
        for (const entry of pendingPracticeCompletions(game)) {
          await submitPracticeCompletion(communityApiUrl, entry, controller.signal, game)
        }
        const count = mode === 'daily'
          ? await requestDailyCount(communityApiUrl, dayKey, clientId, controller.signal, game)
          : await requestPracticeCount(communityApiUrl, dayKey, controller.signal, game)
        if (active) {
          if (clientId) markCompletionReported(dayKey, game)
          setResult({ game, mode, dayKey, count })
        }
      } catch {
        if (active) setResult(null)
      } finally {
        window.clearTimeout(timeout)
        inFlight = false
      }
    }
    function onVisible() { if (!document.hidden) void refresh() }
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 60000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      controller?.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [game, mode, dayKey, completed, runId, completedAt])

  if (import.meta.env.DEV || !result || result.game !== game || result.dayKey !== dayKey || result.mode !== mode) return null
  return <p className="daily-community-count" role="status">
    <strong>{result.count.toLocaleString()}</strong> {mode === 'daily'
      ? `${result.count === 1 ? 'Guardian has' : 'Guardians have'} identified today’s ${game === 'characters' ? 'character' : 'weapon'}`
      : `Unlimited ${result.count === 1 ? 'run' : 'runs'} completed today`}
  </p>
}
