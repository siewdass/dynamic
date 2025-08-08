import { Service } from './service.js'

export const Rest = async (req) => {
	console.log(req.params)
	return Service()
}