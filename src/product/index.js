export const Rest = async (req, res) => {
  console.log('envs', import.meta.env)

  return { 
    message: 'From product!',
    timestamp: new Date().toISOString()
  }
}