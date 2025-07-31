export const Request = async (req, res) => {
  return { 
    message: 'Hola desde el backend!',
    timestamp: new Date().toISOString()
  }
}