import { defineConfig } from 'vite'
import { vitePluginFullStack } from './plugin'

export default defineConfig({
  plugins: [
    vitePluginFullStack({
      build: {
        crt: 'organization.crt',
        key: 'private.key',
        minify: false,
        port: 5173,
      }
    })
  ],
})