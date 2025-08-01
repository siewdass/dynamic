export const Request = async (req, res) => {
  return { 
    message: 'From homex!',
    timestamp: new Date().toISOString()
  }
}