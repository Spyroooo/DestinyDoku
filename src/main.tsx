import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import travelerBackground from './assets/traveler-earth.jpg'

document.documentElement.style.setProperty('--traveler-background', `url("${travelerBackground}")`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
