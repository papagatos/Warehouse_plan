import { randomUUID } from 'crypto'
import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import prisma from '../prisma/client.js'
import { requireAuth, requireRole, checkStatusPermission } from '../middleware/auth.js'
import { parseExcelPlan, savePlan } from '../services/excelParser.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const StatusSchema = z.object({
  status:        z.enum(['WAITING', 'POSTPONED', 'ACCEPTED', 'IN_PROGRESS', 'ASSEMBLED', 'SHIPPED', 'CANCELLED']),
  comment:       z.string().optional(),
  pallets:       z.string().nullable().optional(),
  postponedDate: z.string().nullable().optional(),
})

// ── GET /plans — список всех планов ──────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const plans = await prisma.plan.findMany({
    orderBy: { planDate: 'desc' },
    take: 30,
    select: {
      id: true, planDate: true, originalFilename: true, createdAt: true,
      importedBy: { select: { name: true } },
      _count: { select: { rows: true } }
    }
  })
  res.json(plans)
})

// ── GET /plans/:date — план на дату (YYYY-MM-DD) ──────────────
router.get('/:date', requireAuth, async (req, res) => {
  const date = new Date(req.params.date)
  if (isNaN(date)) return res.status(400).json({ error: 'Неверный формат даты. Используй YYYY-MM-DD' })

  date.setHours(0, 0, 0, 0)

  const plan = await prisma.plan.findUnique({
    where: { planDate: date },
    include: {
      rows: {
        orderBy: [{ rowType: 'asc' }, { sortOrder: 'asc' }],
        include: {
          photos: {
            select: { id: true, fileUrl: true, photoType: true, uploadedAt: true }
          },
          _count: { select: { photos: true } }
        }
      },
      importedBy: { select: { name: true } }
    }
  })

  if (!plan) return res.status(404).json({ error: 'План на эту дату не найден' })
  res.json(plan)
})

// ── POST /plans/upload — загрузить Excel вручную (SUPER) ──────
router.post('/upload', requireAuth, requireRole('SUPER'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' })

  const { planDate, rows, filename } = await parseExcelPlan(req.file.buffer, req.file.originalname)

  // TODO этап 6: загрузить файл в S3 и получить fileUrl
  const fileUrl = null

  const plan = await savePlan(prisma, {
    planDate, rows, filename,
    fileUrl,
    importedById: req.user.id,
  })

  res.status(201).json({
    message: `План на ${planDate.toLocaleDateString('ru')} создан. Строк: ${rows.length}`,
    planId: plan.id,
    planDate: plan.planDate,
    rowCount: rows.length,
  })
})

// ── PATCH /plans/rows/:id/status — сменить статус строки ──────
router.patch('/rows/:id/status', requireAuth, async (req, res) => {
  const data = StatusSchema.parse(req.body)
  const { status, comment } = data

  const planRow = await prisma.planRow.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { photos: true } } }
  })
  if (!planRow) return res.status(404).json({ error: 'Строка не найдена' })

  const perm = checkStatusPermission(req.user, planRow, status)
  if (!perm.allowed) return res.status(403).json({ error: perm.reason })

  const updated = await prisma.$transaction(async (tx) => {
    const updateData = { status }
    if (data.pallets !== undefined) updateData.pallets = data.pallets

    if (status === 'POSTPONED' && data.postponedDate) {
      const toDate = new Date(data.postponedDate)
      toDate.setHours(0, 0, 0, 0)

      // Найти или создать план на целевую дату
      let targetPlan = await tx.plan.findUnique({ where: { planDate: toDate } })
      if (!targetPlan) {
        targetPlan = await tx.plan.create({ data: { planDate: toDate } })
      }

      // Найти текущую дату плана
      const currentPlan = await tx.plan.findUnique({ where: { id: planRow.planId } })
      const fromDate = currentPlan?.planDate ?? new Date()

      // Найти последний sortOrder на целевом плане
      const lastRow = await tx.planRow.findFirst({
        where: { planId: targetPlan.id },
        orderBy: { sortOrder: 'desc' }
      })

      // Двигаем карточку на новый план
      updateData.planId = targetPlan.id
      updateData.sortOrder = (lastRow?.sortOrder ?? -1) + 1
      updateData.isPostponed = true
      updateData.originalDate = planRow.originalDate ?? fromDate
      updateData.postponedDate = toDate

      // Пишем в историю переносов
      await tx.postponeHistory.create({
        data: {
          id:        randomUUID(),
          planRowId: planRow.id,
          fromDate,
          toDate,
          byUserId:  req.user.id,
        }
      })
    } else {
      updateData.postponedDate = null
    }

    const row = await tx.planRow.update({
      where: { id: req.params.id },
      data: updateData
    })

    await tx.statusHistory.create({
      data: {
        planRowId:   row.id,
        changedById: req.user.id,
        oldStatus:   planRow.status,
        newStatus:   status,
        comment:     comment || null,
      }
    })

    return row
  })

  res.json(updated)
})

// ── GET /plans/rows/:id/history — история статусов ────────────
router.get('/rows/:id/history', requireAuth, async (req, res) => {
  const history = await prisma.statusHistory.findMany({
    where: { planRowId: req.params.id },
    orderBy: { changedAt: 'desc' },
    include: { changedBy: { select: { name: true, role: true } } }
  })
  res.json(history)
})

export default router
