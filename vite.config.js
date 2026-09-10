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

export default defineConfig({
  plugins: [react()],
  server,
  preview: server,
})
