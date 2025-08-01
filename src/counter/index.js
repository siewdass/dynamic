import { Service } from "./service"
import fs from 'fs'

export const Request = async (req, res) => {
  const testFolder = '.';

  fs.readdir(testFolder, (err, files) => {
    files.forEach(file => {
      // will also include directory names
      //console.log(file);
    });
  });
  return Service()
}