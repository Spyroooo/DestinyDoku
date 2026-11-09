import { useEffect, useState } from 'react'
import './App.css'

const games = [
  {
    id: 'weapons',
    title: 'Weapons',
    description: 'Know your arsenal. Guess a Destiny 2 weapon from its clues.',
    symbol: '◎',
  },
  {
    id: 'characters',
    title: 'Characters',
    description: 'Meet the legends. Identify a character or vendor from the Destiny universe.',
    symbol: '◇',
  },
  {
    id: 'encounters',
    title: 'Encounters',
    description: 'Remember the mechanics. Guess a raid or dungeon encounter from its clues.',
    symbol: '⚔',
  },
  {
    id: 'locations',
    title: 'Locations',
    description: 'Explore familiar worlds. Identify a location as more of its image is revealed.',
    symbol: '⌖',
  },
  {
    id: 'music',
    title: 'Music',
    description: 'Listen closely. Name the track or the activity behind a Destiny audio clip.',
    symbol: '♫',
  },
  {
    id: 'who-said-it',
    title: 'Who Said It?',
    description: 'Recall their words. Match a dialogue line to the character who said it.',
    symbol: '“”',
  },
  {
    id: 'exotics',
    title: 'Exotics',
    description: 'Think beyond the ordinary. Identify exotic weapons and armour from their perks.',
    symbol: '✧',
  },
  {
    id: 'destiny-grid',
    title: 'Destiny Grid',
    description: 'Connect your knowledge. Find the right match for every cell in a 3×3 grid.',
    symbol: '▦',
  },
]

function App() {
  const [page, setPage] = useState(() => window.location.hash.slice(1))

  useEffect(() => {
    function updatePage() {
      setPage(window.location.hash.slice(1))
    }

    window.addEventListener('hashchange', updatePage)
    return () => window.removeEventListener('hashchange', updatePage)
  }, [])

  const currentGame = games.find((game) => page === `/${game.id}`)

  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href="#/" aria-label="DestinyDoku home">
          Destiny<span>Doku</span>
        </a>
        <nav aria-label="Games">
          {games.map((game) => (
            <a
              key={game.id}
              href={`#/${game.id}`}
              aria-current={currentGame?.id === game.id ? 'page' : undefined}
            >
              {game.title}
            </a>
          ))}
        </nav>
      </header>

      <main id="main-content">
        {currentGame ? (
          <section className="game-placeholder" key={currentGame.id}>
            <p className="eyebrow">Destiny 2 · Coming soon</p>
            <h1>{currentGame.title}</h1>
            <p>{currentGame.description}</p>
            <p className="placeholder-note">This challenge is under construction. Check back soon, Guardian.</p>
            <a className="back-link" href="#/">← All games</a>
          </section>
        ) : (
          <>
            <section className="intro">
              <p className="eyebrow">Destiny 2 · Knowledge challenges</p>
              <h1>Your next challenge,<br /><span>Guardian.</span></h1>
              <p>Put your knowledge of the Destiny universe to the test. Choose a game to get started.</p>
            </section>
            <section className="games" aria-label="Choose a game">
              {games.map((game) => (
                <a className="game-card" key={game.id} href={`#/${game.id}`}>
                  <span className="game-symbol" aria-hidden="true">{game.symbol}</span>
                  <h2>{game.title}</h2>
                  <p>{game.description}</p>
                  <span className="card-link">Explore challenge <span aria-hidden="true">↗</span></span>
                </a>
              ))}
            </section>
          </>
        )}
      </main>

      <footer>DestinyDoku · An unofficial Destiny fan project</footer>
    </div>
  )
}

export default App
