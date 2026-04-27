import { Router } from 'express'
import { z } from 'zod'
import prisma from '../prisma/client.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// GET /api/products/search?q=1234 — поиск по последним 4 цифрам
router.get('/search', requireAuth, async (req, res) => {
  const q = (req.query.q || '').replace(/\D/g, '').slice(-4)
  if (q.length < 2) return res.json([])

  const products = await prisma.product.findMany({
    where: { barcode: { endsWith: q } },
    take: 10,
    orderBy: { name: 'asc' }
  })
  res.json(products)
})

// GET /api/products — список всех (только SUPER, для управления)
router.get('/', requireAuth, requireRole('SUPER'), async (req, res) => {
  const { search } = req.query
  const products = await prisma.product.findMany({
    where: search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } }
      ]
    } : undefined,
    orderBy: { name: 'asc' },
    take: 50,
  })
  res.json(products)
})

// POST /api/products — добавить товар (только SUPER)
router.post('/', requireAuth, requireRole('SUPER'), async (req, res) => {
  const { barcode, name } = z.object({
    barcode: z.string().min(4),
    name:    z.string().min(1),
  }).parse(req.body)

  const product = await prisma.product.create({
    data: { id: crypto.randomUUID(), barcode, name }
  })
  res.status(201).json(product)
})

// PATCH /api/products/:id — редактировать (только SUPER)
router.patch('/:id', requireAuth, requireRole('SUPER'), async (req, res) => {
  const { barcode, name } = z.object({
    barcode: z.string().min(4).optional(),
    name:    z.string().min(1).optional(),
  }).parse(req.body)

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { barcode, name }
  })
  res.json(product)
})

// DELETE /api/products/:id — удалить (только SUPER)
router.delete('/:id', requireAuth, requireRole('SUPER'), async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

export default router
