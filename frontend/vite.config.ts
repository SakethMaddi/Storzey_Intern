import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { resolveApiBaseUrl } from './src/api-base.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Production must not bake a Railway URL into the browser bundle.
  resolveApiBaseUrl(mode === 'production', env.VITE_API_URL)

  return {
    plugins: [react()],
  }
})
