import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import prisma from '../prisma/client.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

const CreateRowSchema = z.object({
  planDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rowType:      z.enum(['ARRIVAL', 'CONTAINER', 'DELIVERY', 'PICKUP', 'RETURN']),
  rawType:      z.string().optional(),
  counterparty: z.string().min(1, 'Контрагент обязателен'),
  weight:       z.number().positive().optional().nullable(),
  vehicleNumber:z.string().optional().nullable(),
  phone:        z.string().optional().nullable(),
  palletsExtra: z.string().optional().nullable(),
  notes:        z.string().optional().nullable(),
})

const RAW_TYPE_DEFAULT = {
  DELIVERY: 'Д',
  PICKUP:   'С',
  RETURN:   'В',
  CONTAINER: 'К',
}

// ── POST /rows ────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('SUPER', 'MANAGER'), async (req, res) => {
  const data = CreateRowSchema.parse(req.body)

  const dateStart = new Date(data.planDate)
  dateStart.setHours(0, 0, 0, 0)

  // Проверка уникальности К1 и К2 на дату
  if (data.rowType === 'CONTAINER' && data.rawType) {
    const slot = data.rawType.toUpperCase() // К1 или К2
    if (slot === 'К1' || slot === 'К2') {
      const existing = await prisma.planRow.findFirst({
        where: {
          plan: { planDate: dateStart },
          rowType: 'CONTAINER',
          rawType: slot,
        }
      })
      if (existing) {
        return res.status(409).json({
          error: `${slot} на эту дату уже создан. Можно только один ${slot} в день.`
        })
      }
    }
  }

  // Найти или создать план на эту дату
  let plan = await prisma.plan.findUnique({ where: { planDate: dateStart } })
  if (!plan) {
    plan = await prisma.plan.create({
      data: { planDate: dateStart, importedById: req.user.id }
    })
  }

  const lastRow = await prisma.planRow.findFirst({
    where: { planId: plan.id },
    orderBy: { sortOrder: 'desc' },
  })

  const row = await prisma.planRow.create({
    data: {
      planId:        plan.id,
      rowType:       data.rowType,
      rawType:       data.rawType || RAW_TYPE_DEFAULT[data.rowType],
      counterparty:  data.counterparty,
      weight:        data.weight ?? null,
      manager:       data.manager ?? null,
      vehicleNumber: data.vehicleNumber ?? null,
        phone:         data.phone ?? null,
        palletsExtra:  data.palletsExtra ?? null,
      notes:         data.notes ?? null,
      sortOrder:     (lastRow?.sortOrder ?? -1) + 1,
      status:        'WAITING',
      createdById:   req.user.id,
    },
    include: {
      photos: true,
      _count: { select: { photos: true } }
    }
  })

  res.status(201).json(row)
})

// ── DELETE /rows/:id ──────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('SUPER', 'MANAGER'), async (req, res) => {
  const row = await prisma.planRow.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Запись не найдена' })
  if (req.user.role === 'MANAGER' && row.createdById !== req.user.id) {
    return res.status(403).json({ error: 'Можно удалять только свои записи' })
  }
  await prisma.planRow.delete({ where: { id: req.params.id } })
  res.json({ message: 'Запись удалена' })
})

// ── PATCH /rows/:id ───────────────────────────────────────────
router.patch('/:id', requireAuth, requireRole('SUPER', 'MANAGER'), async (req, res) => {
  const row = await prisma.planRow.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Запись не найдена' })
  if (req.user.role === 'MANAGER' && row.createdById !== req.user.id) {
    return res.status(403).json({ error: 'Можно редактировать только свои записи' })
  }
  const UpdateSchema = CreateRowSchema.omit({ planDate: true, rowType: true }).partial()
  const data = UpdateSchema.parse(req.body)
  const updated = await prisma.planRow.update({
    where: { id: req.params.id },
    data,
    include: { photos: true, _count: { select: { photos: true } } }
  })
  res.json(updated)
})

export default router

// POST /rows/:id/document — загрузить PDF документ
const uploadDoc = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

router.post('/:id/document', requireAuth, requireRole('SUPER', 'WAREHOUSE', 'LOADER'), uploadDoc.single('document'), async (req, res) => {
  const row = await prisma.planRow.findUnique({ where: { id: req.params.id } })
  if (!row) return res.status(404).json({ error: 'Запись не найдена' })
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' })

  const { uploadToS3 } = await import('../services/s3.js')
  const { randomUUID } = await import('crypto')

  const pages = parseInt(req.body.pages) || 1
  const tr = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'j',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ы:'y',э:'e',ю:'yu',я:'ya'}
  const translit = (s) => (s||'').toLowerCase().split('').map(c => tr[c] ?? c).join('')
  const base = translit(row.counterparty || 'doc').replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').slice(0, 40)
  const docName = `${base}_${new Date().toISOString().slice(0,10)}.pdf`
  const { fileKey, fileUrl } = await uploadToS3(req.file.buffer, docName, 'documents')

  const doc = await prisma.document.create({
    data: {
      id:           randomUUID(),
      planRow:      { connect: { id: req.params.id } },
      fileUrl,
      fileKey,
      pages,
      uploadedBy: { connect: { id: req.user.id } },
    }
  })

  res.status(201).json(doc)
})

// GET /rows/:id/documents — список документов
router.get('/:id/documents', requireAuth, async (req, res) => {
  if (req.user.role === 'VIEWER') return res.status(403).json({ error: 'Нет доступа' })

  const docs = await prisma.document.findMany({
    where: { planRowId: req.params.id },
    orderBy: { createdAt: 'asc' },
    include: { uploadedBy: { select: { name: true } } }
  })
  res.json(docs)
})
