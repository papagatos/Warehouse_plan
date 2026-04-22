import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.user.findFirst({ where: { role: 'SUPER' } })
  if (existing) {
    console.log('Суперпользователь уже существует:', existing.email)
    return
  }

  const hash = await bcrypt.hash('admin123', 10)
  const user = await prisma.user.create({
    data: {
      email: 'admin@warehouse.local',
      name: 'Администратор',
      passwordHash: hash,
      role: 'SUPER',
    }
  })
  console.log('✓ Суперпользователь создан:')
  console.log('  Email:', user.email)
  console.log('  Пароль: admin123')
  console.log('  ⚠ Смени пароль после первого входа!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
