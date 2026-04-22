import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import prisma from '../prisma/client.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// ── Схемы валидации ───────────────────────────────────────────
const LoginSchema = z.object({
  email:    z.string().email('Некорректный email'),
  password: z.string().min(1, 'Пароль обязателен'),
})

const RegisterSchema = z.object({
  token:    z.string().min(1),
  name:     z.string().min(2, 'Имя минимум 2 символа'),
  password: z.string().min(6, 'Пароль минимум 6 символов'),
  phone:    z.string().min(10, 'Укажи телефон'),
})

const InviteSchema = z.object({
  role: z.enum(['SUPER', 'WAREHOUSE', 'LOADER', 'RECEIVER', 'MANAGER', 'VIEWER']),
  expiresInDays: z.number().int().min(1).max(30).default(7),
})

// ── POST /auth/login ──────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = LoginSchema.parse(req.body)

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Неверный email или пароль' })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: 'Неверный email или пароль' })
  }

  // Сохраняем время последнего входа
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  })

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  })
})

// ── GET /auth/me ──────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// ── POST /auth/register — регистрация по инвайт-ссылке ────────
router.post('/register', async (req, res) => {
  const { token, name, password } = RegisterSchema.parse(req.body)

  const invite = await prisma.inviteLink.findUnique({ where: { token } })

  if (!invite) {
    return res.status(400).json({ error: 'Инвайт-ссылка не найдена' })
  }
  if (invite.usedAt) {
    return res.status(400).json({ error: 'Инвайт-ссылка уже использована' })
  }
  if (new Date() > invite.expiresAt) {
    return res.status(400).json({ error: 'Срок действия инвайт-ссылки истёк' })
  }

  // Нужно ввести email — берём его из запроса
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email обязателен' })

  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: invite.role,
        phone: req.body.phone || null,
        invitedById: invite.createdById,
      }
    })

    await tx.inviteLink.update({
      where: { token },
      data: { usedAt: new Date(), usedById: newUser.id }
    })

    return newUser
  })

  const jwtToken = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )

  res.status(201).json({
    token: jwtToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  })
})

// ── GET /auth/invite/:token — проверка токена инвайта ─────────
router.get('/invite/:token', async (req, res) => {
  const invite = await prisma.inviteLink.findUnique({
    where: { token: req.params.token }
  })

  if (!invite || invite.usedAt || new Date() > invite.expiresAt) {
    return res.status(400).json({ error: 'Ссылка недействительна или истекла' })
  }

  res.json({
    valid: true,
    role: invite.role,
    expiresAt: invite.expiresAt
  })
})

// ── POST /auth/invites — создать инвайт (только SUPER) ────────
router.post('/invites', requireAuth, requireRole('SUPER'), async (req, res) => {
  const { role, expiresInDays } = InviteSchema.parse(req.body)

  const token = randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  const invite = await prisma.inviteLink.create({
    data: {
      token,
      role,
      createdById: req.user.id,
      expiresAt,
    }
  })

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  res.status(201).json({
    token: invite.token,
    role: invite.role,
    expiresAt: invite.expiresAt,
    link: `${baseUrl}/register?token=${invite.token}`,
  })
})

// ── GET /auth/invites — список инвайтов (только SUPER) ───────
router.get('/invites', requireAuth, requireRole('SUPER'), async (req, res) => {
  const invites = await prisma.inviteLink.findMany({
    where: { createdById: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json(invites)
})

export default router
