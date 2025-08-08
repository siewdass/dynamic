import { defineConfig } from 'vite'
import WoveerVitePlugin from 'woveer-vite-plugin'

export default defineConfig({
	plugins: [
		WoveerVitePlugin({
			entry: {
				client: './src/client.js',
				server: './src/server.js'
			},
			prod: { port: 5173 },
			dev: { port: 5173 }
		})
	],
})