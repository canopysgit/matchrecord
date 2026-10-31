import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    // 本地开发：/api 转给 scripts/dev-api.ts
    proxy: { '/api': 'http://localhost:8787' },
  },
})
