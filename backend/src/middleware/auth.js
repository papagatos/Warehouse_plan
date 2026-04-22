import jwt from 'jsonwebtoken'
import prisma from '../prisma/client.js'

// ── Проверка JWT токена ────────────────────────────────────────
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Токен не предоставлен' })
  }

  const token = authHeader.slice(7)
  const payload = jwt.verify(token, process.env.JWT_SECRET)

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, isActive: true }
  })

  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Пользователь не найден или деактивирован' })
  }

  req.user = user
  next()
}

// ── Фабрика middleware для проверки ролей ──────────────────────
// Пример: requireRole('SUPER', 'WAREHOUSE')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизован' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Недостаточно прав',
        required: roles,
        current: req.user.role
      })
    }
    next()
  }
}

// ── Матрица разрешений по ролям ────────────────────────────────
export const PERMISSIONS = {
  // Кто может менять статус строки
  canChangeStatus: {
    ARRIVAL: ['SUPER', 'RECEIVER'],            // Поступление
    CONTAINER: ['SUPER', 'WAREHOUSE', 'LOADER'], // Контейнер
    DELIVERY: ['SUPER', 'WAREHOUSE', 'LOADER'],  // Доставка
    PICKUP: ['SUPER', 'WAREHOUSE', 'LOADER'],    // Самовывоз
    RETURN: ['SUPER'],
  },

  // Какие статусы доступны каждой роли
  allowedStatuses: {
    SUPER:     ['WAITING', 'POSTPONED', 'ACCEPTED', 'IN_PROGRESS', 'ASSEMBLED', 'SHIPPED'],
    RECEIVER:  ['WAITING', 'POSTPONED', 'ACCEPTED'],      // по приходу и возврату
    WAREHOUSE: ['IN_PROGRESS', 'ASSEMBLED'],
    LOADER:    ['SHIPPED'],
    VIEWER:    [],
    MANAGER:   [],
  },

  // Кто может загружать фото
  canUploadPhoto: {
    ARRIVAL:  ['SUPER', 'RECEIVER'],
    ASSEMBLY: ['SUPER', 'WAREHOUSE'],
    SHIPMENT: ['SUPER', 'LOADER'],
  }
}

// ── Проверка: может ли пользователь менять статус строки ──────
export function checkStatusPermission(user, planRow, newStatus) {
  const { role } = user
  if (role === 'SUPER') return { allowed: true }

  // Проверяем тип строки
  const allowed = PERMISSIONS.canChangeStatus[planRow.rowType] || []
  if (!allowed.includes(role)) {
    return { allowed: false, reason: 'Ваша роль не может менять статусы этого типа записи' }
  }

  // Проверяем конкретный статус
  const allowedStatuses = PERMISSIONS.allowedStatuses[role] || []
  if (!allowedStatuses.includes(newStatus)) {
    return { allowed: false, reason: `Ваша роль не может устанавливать статус "${newStatus}"` }
  }

  // Специальные правила: Грузчик может поставить SHIPPED только если есть фото
  if (role === 'LOADER' && newStatus === 'SHIPPED') {
    if (!planRow._count?.photos || planRow._count.photos === 0) {
      return { allowed: false, reason: 'Необходимо загрузить фото перед отгрузкой' }
    }
  }

  return { allowed: true }
}
