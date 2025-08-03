import { Service } from "./service"

export const Rest = async (req, res) => {
  console.log(req.params)
  return Service()
}