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

// ── POST /auth/forgot-password — сброс пароля суперпользователя ──
router.post('/forgot-password', async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body)

  const user = await prisma.user.findUnique({ where: { email } })
  // Не раскрываем существует ли пользователь
  if (!user || user.role !== 'SUPER') {
    return res.json({ message: 'Если email существует — письмо отправлено' })
  }

  const token = crypto.randomUUID()
  const expires = new Date(Date.now() + 1000 * 60 * 60) // 1 час

  await prisma.user.update({
    where: { id: user.id },
    data: { inviteToken: token }
  })

  const { sendFaxPDF } = await import('../services/mailer.js')
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`

  await import('nodemailer').then(async (nm) => {
    const t = nm.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
    await t.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Сброс пароля — whmanage.ru',
      html: `<p>Для сброса пароля перейдите по ссылке:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Ссылка действительна 1 час.</p>`
    })
  })

  res.json({ message: 'Если email существует — письмо отправлено' })
})

// ── POST /auth/reset-password — установить новый пароль ──────
router.post('/reset-password', async (req, res) => {
  const { token, password } = z.object({
    token:    z.string(),
    password: z.string().min(6)
  }).parse(req.body)

  const user = await prisma.user.findFirst({ where: { inviteToken: token } })
  if (!user) return res.status(400).json({ error: 'Неверная или устаревшая ссылка' })

  const bcrypt = await import('bcryptjs')
  const hash = await bcrypt.default.hash(password, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash, inviteToken: null }
  })

  res.json({ message: 'Пароль изменён' })
})

// ── POST /auth/send-invite — отправить инвайт на email ───────
router.post('/send-invite', requireAuth, requireRole('SUPER'), async (req, res) => {
  const { email, role } = z.object({
    email: z.string().email(),
    role:  z.enum(['SUPER', 'WAREHOUSE', 'LOADER', 'RECEIVER', 'MANAGER', 'VIEWER'])
  }).parse(req.body)

  // Создаём инвайт
  const token = crypto.randomUUID()
  await prisma.inviteLink.create({
    data: {
      token,
      role,
      createdById: req.user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 дней
    }
  })

  const inviteUrl = `${process.env.FRONTEND_URL}/register?token=${token}`

  const ROLE_NAMES = {
    SUPER: 'Суперпользователь',
    MANAGER: 'Менеджер',
    WAREHOUSE: 'Кладовщик',
    LOADER: 'Грузчик',
    RECEIVER: 'Приёмщик',
    VIEWER: 'Просмотр',
  }

  const nodemailer = await import('nodemailer')
  const t = nodemailer.default.createTransport({
    host: process.env.INVITE_SMTP_HOST || process.env.SMTP_HOST,
    port: parseInt(process.env.INVITE_SMTP_PORT || process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.INVITE_SMTP_USER || process.env.SMTP_USER,
      pass: process.env.INVITE_SMTP_PASS || process.env.SMTP_PASS
    }
  })

  await t.sendMail({
    from: process.env.INVITE_SMTP_FROM || process.env.SMTP_FROM,
    to: email,
    subject: 'Приглашение в систему управления складом',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
        <h2 style="color:#1d4ed8">Приглашение в whmanage.ru</h2>
        <p>Вас приглашают зарегистрироваться в системе управления складом.</p>
        <p><strong>Роль:</strong> ${ROLE_NAMES[role]}</p>
        <p style="margin:24px 0">
          <a href="${inviteUrl}"
            style="background:#1d4ed8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
            Зарегистрироваться
          </a>
        </p>
        <p style="color:#666;font-size:12px">Ссылка действительна 7 дней. Если вы не ожидали это письмо — просто проигнорируйте его.</p>
        <p style="color:#666;font-size:12px">Или скопируйте ссылку: ${inviteUrl}</p>
      </div>
    `
  })

  res.json({ message: `Приглашение отправлено на ${email}` })
})
