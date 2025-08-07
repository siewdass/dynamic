import express from 'express'

export const Rest = async (req) => {
  console.log('envs', import.meta.env)

  return { 
    message: 'From product!',
    timestamp: new Date().toISOString()
  }
}