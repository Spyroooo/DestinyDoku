import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/DestinyDoku/',
  plugins: [react(), {
    name: 'reset-weapons-during-development',
    apply: 'serve',
    handleHotUpdate({ server }) {
      server.ws.send({ type: 'custom', event: 'destinydoku:reset-weapons' })
    },
  }],
})
