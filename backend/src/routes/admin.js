import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import prisma from '../prisma/client.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

const RoleSchema = z.object({
  role: z.enum(['SUPER', 'WAREHOUSE', 'LOADER', 'RECEIVER', 'VIEWER', 'MANAGER'])
})

// ── GET /admin/users ──────────────────────────────────────────
router.get('/users', requireAuth, requireRole('SUPER'), async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, name: true, role: true,
      isActive: true, createdAt: true, lastLoginAt: true,
      invitedBy: { select: { name: true } }
    }
  })
  res.json(users)
})

// ── PATCH /admin/users/:id/role ───────────────────────────────
router.patch('/users/:id/role', requireAuth, requireRole('SUPER'), async (req, res) => {
  const { role } = RoleSchema.parse(req.body)

  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя менять свою роль' })
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: { id: true, email: true, name: true, role: true }
  })
  res.json(user)
})

// ── PATCH /admin/users/:id/deactivate ────────────────────────
router.patch('/users/:id/deactivate', requireAuth, requireRole('SUPER'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя изменить свой статус' })
  }
  const { isActive } = req.body
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: isActive ?? false },
    select: { id: true, name: true, isActive: true }
  })
  res.json(user)
})

// ── POST /admin/users/:id/reset-password ─────────────────────
router.post('/users/:id/reset-password', requireAuth, requireRole('SUPER'), async (req, res) => {
  const { password } = z.object({ password: z.string().min(6) }).parse(req.body)
  const hash = await bcrypt.hash(password, 10)
  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash: hash }
  })
  res.json({ message: 'Пароль обновлён' })
})

export default router

// ── GET /admin/activity — журнал действий ────────────────────
router.get('/activity', requireAuth, requireRole('SUPER'), async (req, res) => {
  const history = await prisma.statusHistory.findMany({
    orderBy: { changedAt: 'desc' },
    take: 200,
    include: {
      changedBy: { select: { name: true, role: true } },
      planRow: { select: { counterparty: true, rowType: true } }
    }
  })
  res.json(history)
})
