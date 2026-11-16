import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import travelerBackground from './assets/traveler-earth.jpg'
import { legacyPath } from './routes'

const oldPath = legacyPath(window.location.hash)
if (oldPath) window.history.replaceState(null, '', `${oldPath}${window.location.search}`)

document.documentElement.style.setProperty('--traveler-background', `url("${travelerBackground}")`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
