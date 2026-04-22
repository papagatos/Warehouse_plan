import { Router } from 'express'
import { z } from 'zod'
import prisma from '../prisma/client.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { checkMailConnection, sendFaxPDF } from '../services/mailer.js'

const router = Router()

router.get('/', requireAuth, requireRole('SUPER'), async (req, res) => {
  const rows = await prisma.settings.findMany()
  const result = {}
  rows.forEach(r => result[r.key] = r.value)
  res.json(result)
})

router.patch('/', requireAuth, requireRole('SUPER'), async (req, res) => {
  const { key, value } = z.object({ key: z.string(), value: z.string() }).parse(req.body)
  await prisma.settings.upsert({
    where: { key }, update: { value }, create: { key, value }
  })
  res.json({ key, value })
})

router.post('/test-mail', requireAuth, requireRole('SUPER'), async (req, res) => {
  const result = await checkMailConnection()
  res.json(result)
})

router.post('/send-fax', requireAuth, requireRole('SUPER', 'WAREHOUSE'), async (req, res) => {
  const { rowId, subtype, main, extra } = req.body

  const setting = await prisma.settings.findUnique({ where: { key: 'fax_email' } })
  if (!setting?.value) {
    return res.status(400).json({ error: 'Email факса не настроен. Обратитесь к администратору.' })
  }

  const row = await prisma.planRow.findUnique({ where: { id: rowId } })
  if (!row) return res.status(404).json({ error: 'Запись не найдена' })

  // Получаем HTML этикеток
  const token = req.headers.authorization?.slice(7)
  const params = new URLSearchParams()
  if (subtype) params.set('subtype', subtype)
  if (main  !== undefined) params.set('main',  main)
  if (extra !== undefined) params.set('extra', extra)
  params.set('token', token)

  const labelUrl = `http://localhost:${process.env.PORT || 3000}/labels/${rowId}?${params.toString()}`
  const htmlRes  = await globalThis.fetch(labelUrl)
  const html     = await htmlRes.text()

  // Генерируем PDF через puppeteer
  const puppeteer = await import('puppeteer')
  const browser   = await puppeteer.default.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  })
  await browser.close()

  // Отправляем PDF
  await sendFaxPDF(
    setting.value,
    `Этикетки: ${row.counterparty} — ${new Date().toLocaleDateString('ru')}`,
    pdf,
    `labels_${row.counterparty}_${Date.now()}.pdf`
  )

  res.json({ message: `PDF отправлен на ${setting.value}` })
})

export default router
