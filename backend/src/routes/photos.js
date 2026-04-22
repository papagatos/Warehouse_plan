import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import prisma from '../prisma/client.js'
import { requireAuth } from '../middleware/auth.js'
import { PERMISSIONS } from '../middleware/auth.js'
import { uploadToS3, deleteFromS3 } from '../services/s3.js'

const router  = Router()
const upload  = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Только изображения'))
  }
})

const PhotoTypeSchema = z.object({
  photoType: z.enum(['ARRIVAL', 'ASSEMBLY', 'SHIPMENT'])
})

// ── POST /photos/:rowId — загрузить фото ─────────────────────
router.post('/:rowId', requireAuth, upload.array('photos', 10), async (req, res) => {
  const { photoType } = PhotoTypeSchema.parse(req.body)

  if (!req.files?.length) {
    return res.status(400).json({ error: 'Файлы не загружены' })
  }

  const allowed = PERMISSIONS.canUploadPhoto[photoType] || []
  if (req.user.role !== 'SUPER' && !allowed.includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет прав для загрузки этого типа фото' })
  }

  const planRow = await prisma.planRow.findUnique({ where: { id: req.params.rowId } })
  if (!planRow) return res.status(404).json({ error: 'Строка не найдена' })

  const s3Configured = process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY

  const saved = await Promise.all(req.files.map(async (file) => {
    let fileKey, fileUrl

    if (s3Configured) {
      const result = await uploadToS3(
        file.buffer,
        file.originalname,
        `photos/${planRow.planId}/${planRow.id}`
      )
      fileKey = result.fileKey
      fileUrl = result.fileUrl
    } else {
      // Заглушка пока S3 не настроен
      fileKey = `local/${planRow.id}/${Date.now()}-${file.originalname}`
      fileUrl = `/api/placeholder`
    }

    return prisma.photo.create({
      data: {
        planRowId:    planRow.id,
        uploadedById: req.user.id,
        fileUrl,
        fileKey,
        photoType,
      }
    })
  }))

  res.status(201).json(saved)
})

// ── GET /photos/:rowId — получить фото строки ─────────────────
router.get('/:rowId', requireAuth, async (req, res) => {
  const photos = await prisma.photo.findMany({
    where: { planRowId: req.params.rowId },
    orderBy: { uploadedAt: 'asc' },
    include: { uploadedBy: { select: { name: true } } }
  })
  res.json(photos)
})

// ── DELETE /photos/photo/:photoId — удалить фото ─────────────
router.delete('/photo/:photoId', requireAuth, async (req, res) => {
  const photo = await prisma.photo.findUnique({ where: { id: req.params.photoId } })
  if (!photo) return res.status(404).json({ error: 'Фото не найдено' })

  if (req.user.role !== 'SUPER' && photo.uploadedById !== req.user.id) {
    return res.status(403).json({ error: 'Нет прав для удаления' })
  }

  // Удаляем из S3 если настроен
  if (process.env.S3_ACCESS_KEY && !photo.fileKey.startsWith('local/')) {
    await deleteFromS3(photo.fileKey).catch(err =>
      console.error('[photos] Ошибка удаления из S3:', err.message)
    )
  }

  await prisma.photo.delete({ where: { id: req.params.photoId } })
  res.json({ message: 'Фото удалено' })
})

export default router
