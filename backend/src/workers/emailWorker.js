import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import prisma from '../prisma/client.js'
import { parseExcelPlan, savePlan } from '../services/excelParser.js'

// mailparser нужен отдельно: npm install mailparser
// добавь в package.json: "mailparser": "^3.7.1"

const POLL_INTERVAL_MS = (parseInt(process.env.IMAP_POLL_MINUTES) || 5) * 60 * 1000
const EXCEL_EXTENSIONS = ['.xls', '.xlsx']

let isRunning = false

// ── Подключение к IMAP ────────────────────────────────────────
function createClient() {
  return new ImapFlow({
    host:   process.env.IMAP_HOST,
    port:   parseInt(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASS,
    },
    logger: false, // выключаем шумные логи imapflow
  })
}

// ── Проверяем что файл — Excel ─────────────────────────────────
function isExcelAttachment(filename = '') {
  const lower = filename.toLowerCase()
  return EXCEL_EXTENSIONS.some(ext => lower.endsWith(ext))
}

// ── Обработка одного письма ────────────────────────────────────
async function processMessage(client, uid) {
  const raw = await client.download(String(uid))
  if (!raw) return null

  // Собираем буфер из стрима
  const chunks = []
  for await (const chunk of raw.content) chunks.push(chunk)
  const buffer = Buffer.concat(chunks)

  const parsed = await simpleParser(buffer)
  const attachment = parsed.attachments?.find(a => isExcelAttachment(a.filename))

  if (!attachment) {
    console.log(`[email-worker] Письмо uid=${uid}: нет Excel-вложения, пропускаем`)
    return null
  }

  console.log(`[email-worker] Обрабатываем: "${attachment.filename}"`)

  try {
    const { planDate, rows, filename } = await parseExcelPlan(
      attachment.content,
      attachment.filename
    )

    const plan = await savePlan(prisma, {
      planDate,
      rows,
      filename,
      fileUrl: null, // TODO: сохранить файл в S3 (этап 4)
      importedById: null,
    })

    console.log(`[email-worker] ✓ План на ${planDate.toLocaleDateString('ru')} обновлён. Строк: ${rows.length}`)
    return plan
  } catch (err) {
    console.error(`[email-worker] Ошибка обработки файла "${attachment.filename}":`, err.message)
    return null
  }
}

// ── Один цикл проверки почты ──────────────────────────────────
async function checkMail() {
  if (isRunning) {
    console.log('[email-worker] Предыдущий цикл ещё не завершён, пропускаем')
    return
  }
  isRunning = true

  const client = createClient()
  try {
    await client.connect()
    await client.mailboxOpen('INBOX')

    // Ищем непрочитанные письма с вложениями
    const uids = await client.search({ unseen: true, header: { 'X-Has-Attach': '' } })
      .catch(() => client.search({ unseen: true })) // fallback без фильтра вложений

    if (!uids || uids.length === 0) {
      console.log('[email-worker] Новых писем нет')
      return
    }

    console.log(`[email-worker] Найдено непрочитанных писем: ${uids.length}`)

    for (const uid of uids) {
      const result = await processMessage(client, uid)
      // Помечаем как прочитанное в любом случае — чтобы не обрабатывать повторно
      await client.messageFlagsAdd(String(uid), ['\\Seen'])
      if (result) {
        console.log(`[email-worker] Письмо uid=${uid} обработано успешно`)
      }
    }
  } catch (err) {
    console.error('[email-worker] Ошибка IMAP:', err.message)
  } finally {
    await client.logout().catch(() => {})
    isRunning = false
  }
}

// ── Запуск воркера ────────────────────────────────────────────
export function startEmailWorker() {
  const imapConfigured = process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS

  if (!imapConfigured) {
    console.log('[email-worker] IMAP не настроен (.env), воркер не запущен')
    console.log('[email-worker] Заполни IMAP_HOST, IMAP_USER, IMAP_PASS в .env')
    return
  }

  console.log(`[email-worker] Запуск. Интервал: ${process.env.IMAP_POLL_MINUTES || 5} мин`)
  console.log(`[email-worker] Почтовый ящик: ${process.env.IMAP_USER}`)

  // Первая проверка сразу при старте
  checkMail()

  // Затем по расписанию
  setInterval(checkMail, POLL_INTERVAL_MS)
}
