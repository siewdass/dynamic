import { Service } from "./service"

export const Rest = async (req) => {
  console.log(req.params)
  return Service()
}