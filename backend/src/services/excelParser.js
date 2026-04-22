import ExcelJS from 'exceljs'
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

const TYPE_MAP = {
  'П':  'ARRIVAL',
  'К1': 'CONTAINER',
  'К2': 'CONTAINER',
  'Д':  'DELIVERY',
  'С':  'PICKUP',
  'В':  'RETURN',
}

function cellVal(cell) {
  if (cell === null || cell === undefined) return null
  const s = String(cell).trim()
  return s === '' ? null : s
}

function parseDate(cell) {
  if (!cell) throw new Error('Ячейка E1 пуста — дата плана не найдена')
  if (cell instanceof Date) return cell
  const s = String(cell).trim()
  const match = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed
  throw new Error(`Не удалось распознать дату: "${s}"`)
}

export async function parseExcelPlan(buffer, filename) {
  const isXls = filename.toLowerCase().endsWith('.xls')
  let workingBuffer = buffer

  if (isXls) {
    const id     = randomUUID()
    const tmpXls = join(tmpdir(), `${id}.xls`)
    const tmpXlsx= join(tmpdir(), `${id}.xlsx`)
    try {
      writeFileSync(tmpXls, buffer)
      execSync(`soffice --headless --convert-to xlsx --outdir "${tmpdir()}" "${tmpXls}"`, { timeout: 30000 })
      if (existsSync(tmpXlsx)) {
        workingBuffer = readFileSync(tmpXlsx)
      } else {
        throw new Error('LibreOffice не создал xlsx файл')
      }
    } finally {
      try { unlinkSync(tmpXls) } catch {}
      try { unlinkSync(tmpXlsx) } catch {}
    }
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(workingBuffer)

  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('Файл пуст или не содержит листов')

  const dateCell = sheet.getRow(1).getCell(5).value
  const planDate = parseDate(dateCell)

  const rows = []
  let sortOrder = 0

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 2) return
    const rawType = cellVal(row.getCell(1).value)
    if (!rawType) return
    const normalizedType = rawType.toUpperCase().trim()
    const rowType = TYPE_MAP[normalizedType]
    if (!rowType) return

    const counterparty  = cellVal(row.getCell(2).value)
    const weight        = row.getCell(4).value
    const manager       = cellVal(row.getCell(5).value)
    const vehicleNumber = cellVal(row.getCell(6).value)
    const notes         = cellVal(row.getCell(7).value)

    if (!counterparty && !manager && !vehicleNumber && !notes) return

    rows.push({
      rowType,
      rawType: normalizedType,
      counterparty,
      weight: weight != null ? parseFloat(String(weight)) || null : null,
      manager,
      vehicleNumber,
      notes,
      sortOrder: sortOrder++,
      status: 'WAITING',
    })
  })

  if (rows.length === 0) throw new Error('В файле не найдено строк с данными')
  return { planDate, rows, filename }
}

export async function savePlan(prisma, { planDate, rows, filename, fileUrl, importedById }) {
  const dateStart = new Date(planDate)
  dateStart.setHours(0, 0, 0, 0)

  return prisma.$transaction(async (tx) => {
    await tx.plan.deleteMany({ where: { planDate: dateStart } })
    return tx.plan.create({
      data: {
        planDate: dateStart,
        sourceFileUrl: fileUrl || null,
        originalFilename: filename || null,
        importedById: importedById || null,
        rows: { create: rows }
      },
      include: { rows: true }
    })
  })
}
