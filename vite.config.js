import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true binds every interface so the server is reachable over Tailscale.
// A leading dot matches subdomains, so any MagicDNS name under ts.net is accepted.
const server = {
  port: 8090,
  strictPort: true,
  host: true,
  allowedHosts: ['.ts.net', 'localhost'],
}

export default defineConfig(({ command }) => ({
  // GitHub Pages serves project sites below /<repository>/. Keep local
  // development at /, while allowing CI to provide the deployed base path.
  base: command === 'build' ? (process.env.BASE_PATH || '/') : '/',
  plugins: [react()],
  server,
  preview: server,
}))
