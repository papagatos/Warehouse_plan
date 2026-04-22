import { PrismaClient } from '@prisma/client'

// Singleton — один экземпляр на всё приложение
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
})

export default prisma
