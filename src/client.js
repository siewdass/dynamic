import { ClientConfig } from 'woveer-vite-plugin/client'

import { Root } from './components/root'

export const config = ClientConfig(() => {
	return {
		Root,
		Layout: null,
		Loader: null,
		Error: null
	}
})