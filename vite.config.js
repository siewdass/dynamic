import { defineConfig } from 'vite'
import WoveerRouting from 'woveer-routing'

export default defineConfig({
  plugins: [
    WoveerRouting({
      build: {
        crt: './organization.crt',
        key: './private.key',
        minify: false,
        port: 5173,
      }
    })
  ],
})