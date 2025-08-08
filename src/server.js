import { ServerConfig } from 'woveer-vite-plugin/server'

export const config = ServerConfig(() => {
	return {
		prefix: '/api',
		middlewares: []
	}
})