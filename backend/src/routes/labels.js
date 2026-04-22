import { Router } from 'express'
import prisma from '../prisma/client.js'

const router = Router()

function parsePallets(str) {
  if (!str) return []
  return str.split('+').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0)
}

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #eee; }
  .page {
    width: 210mm; min-height: 297mm;
    margin: 0 auto 10mm;
    padding: 8mm;
    background: white;
    display: flex; flex-direction: column;
    justify-content: space-evenly;
    page-break-after: always;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .label {
    border: 4px solid #000;
    padding: 14px;
    display: flex; flex-direction: column;
    height: 46%;
  }
  .label-body { display: flex; gap: 14px; flex: 1; min-height: 0; }
  .left { flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 0; }

  /* Клиент */
  .client {
    font-size: 64px; font-weight: 900; line-height: 1;
    padding-bottom: 8px;
    word-break: break-word;
  }
  .client-normal {
    border-bottom: 3px solid #000;
    color: #000; background: white;
  }
  .client-delivery {
    background: #000;
    color: white;
    padding: 4px 10px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Подтип */
  .subtype {
    font-size: 24px; font-weight: 700;
    border-left: 7px solid #000;
    padding-left: 8px;
  }

  /* Поддон */
  .pallet {
    display: inline-block;
    font-size: 40px; font-weight: 900;
    border: 4px solid #000;
    padding: 6px 14px;
  }
  .pallet.extra {
    background: repeating-linear-gradient(45deg,#000,#000 8px,#333 8px,#333 16px);
    color: white;
    border: 4px solid #000;
  }

  /* Тип заказа */
  .order-type { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .badge-main {
    display: inline-block;
    font-size: 24px; font-weight: 800;
    padding: 5px 14px;
    border: 3px solid #000;
    border-bottom: 6px solid #000;
  }
  .badge-extra {
    display: inline-block;
    font-size: 24px; font-weight: 800;
    padding: 5px 14px;
    background: repeating-linear-gradient(45deg,#000,#000 8px,#333 8px,#333 16px);
    color: white;
    border: 4px double #000;
  }
  .badge-delivery {
    display: inline-block;
    font-size: 24px; font-weight: 800;
    padding: 5px 14px;
    border: 4px solid #000;
    border-radius: 20px 0 20px 0;
    background: repeating-linear-gradient(45deg,#f0f0f0,#f0f0f0 5px,#ddd 5px,#ddd 10px);
  }
  .badge-pickup {
    display: inline-block;
    font-size: 24px; font-weight: 800;
    padding: 5px 14px;
    border: 3px dashed #000;
  }

  /* Менеджер */
  .meta {
    margin-top: auto;
    padding-top: 6px;
    border-top: 1px dotted #999;
    font-size: 13px; color: #333;
  }

  /* QR */
  .qr {
    display: flex; flex-direction: column;
    align-items: center; flex-shrink: 0;
    border: 2px solid #000;
    padding: 6px;
    align-self: flex-start;
  }
  .qr img { display: block; }
  .qr-label {
    margin-top: 5px;
    font-size: 13px; font-weight: bold;
    border: 1px solid #000;
    padding: 2px 8px;
    text-align: center;
    width: 100%;
  }

  /* Футер */
  .footer {
    border-top: 2px solid #000;
    padding-top: 5px;
    margin-top: 10px;
    display: flex; justify-content: space-between;
    font-size: 11px; font-weight: bold;
  }

  @media print {
    body { background: white; }
    .page { margin: 0; }
    .no-print { display: none !important; }
  }
`

function makeLabel(row, palletNum, palletTotal, isExtra, subtype, qrData) {
  const isDelivery = row.rawType === 'Д'
  const isPickup   = row.rawType === 'С'

  const deliveryBadge = isDelivery
    ? `<span class="badge-delivery">🚚 ДОСТАВКА</span>`
    : isPickup
      ? `<span class="badge-pickup">🚙 САМОВЫВОЗ</span>`
      : ''

  const typeBadge = isExtra
    ? `<span class="badge-extra">⚠️ ДОБАВКА</span>`
    : `<span class="badge-main">📋 ОСНОВНОЙ</span>`

  const palletClass = isExtra ? 'pallet extra' : 'pallet'

  // QR из телефона менеджера-создателя или из поля manager
  const qrBlock = qrData ? `
    <div class="qr">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrData)}" width="130" height="130">
      <div class="qr-label">Telegram</div>
    </div>` : ''

  const subtypeBlock = subtype
    ? `<div class="subtype">📍 ${subtype}</div>` : ''

  return `
    <div class="label">
      <div class="label-body">
        <div class="left">
          <div style="height:200px;min-height:200px;max-height:200px;overflow:hidden;border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact;${isDelivery ? 'background:#000;color:white;padding:8px 12px;' : 'color:#000;'}"><span style="font-size:56px;font-weight:900;line-height:1.1;word-break:break-word;overflow-wrap:break-word;display:block;">${(row.counterparty||'').slice(0,45)}</span></div>
          ${subtypeBlock}
          <div class="${palletClass}">📦 ПОДДОН ${palletNum} ИЗ ${palletTotal}</div>
          <div class="order-type">
            ${typeBadge}
            ${deliveryBadge}
          </div>
          <div class="meta">
            ${row.manager ? `<strong>👤 Менеджер:</strong> ${row.manager}` : ''}
            ${row.vehicleNumber ? ` &nbsp; 🚛 ${row.vehicleNumber}` : ''}
          </div>
        </div>
        ${qrBlock}
      </div>
      <div class="footer">
        <span>📅 ${new Date().toLocaleDateString('ru-RU')}</span>
        <span>${row.rawType || ''}</span>
      </div>
    </div>`
}

router.get('/:rowId', async (req, res) => {
  const token = req.query.token || req.headers.authorization?.slice(7)
  if (!token) return res.status(401).send('<h2>Токен не предоставлен</h2>')

  let user
  try {
    const jwt = await import('jsonwebtoken')
    const payload = jwt.default.verify(token, process.env.JWT_SECRET)
    user = await prisma.user.findUnique({ where: { id: payload.userId } })
  } catch {
    return res.status(401).send('<h2>Недействительный токен</h2>')
  }

  if (!user || !['SUPER', 'WAREHOUSE'].includes(user.role)) {
    return res.status(403).send('<h2>Нет доступа</h2>')
  }

  const { subtype, main, extra } = req.query
  const printMain  = main  !== '0'
  const printExtra = extra !== '0'
  const row = await prisma.planRow.findUnique({ where: { id: req.params.rowId } })
  if (!row) return res.status(404).send('<h2>Запись не найдена</h2>')

  row.labelSubtype = subtype || ''

  // Получаем телефон создателя записи для QR
  let creatorPhone = ''
  if (row.createdById) {
    const creator = await prisma.user.findUnique({
      where: { id: row.createdById },
      select: { phone: true }
    })
    creatorPhone = creator?.phone || ''
  }

  const mainGroups  = parsePallets(row.pallets)
  const extraGroups = parsePallets(row.palletsExtra)

  // Генерируем все этикетки
  const allLabels = []

  const qrData = creatorPhone ? `tel:${creatorPhone.replace(/\s/g,'')}` : ''

  if (printMain) {
    mainGroups.forEach((count, gi) => {
      const sub = subtype ? (subtype.split('/')[gi] || subtype).trim() : ''
      for (let i = 1; i <= count; i++) {
        allLabels.push(makeLabel(row, i, count, false, sub, qrData))
      }
    })
  }

  if (printExtra) {
    extraGroups.forEach((count, gi) => {
      const sub = subtype ? (subtype.split('/')[gi] || subtype).trim() : ''
      for (let i = 1; i <= count; i++) {
        allLabels.push(makeLabel(row, i, count, true, sub, qrData))
      }
    })
  }

  if (allLabels.length === 0) {
    return res.status(400).send('<h2>Поддоны не заполнены</h2>')
  }

  // 2 копии одной этикетки на странице А4
  const pages = []
  for (let i = 0; i < allLabels.length; i++) {
    pages.push(`<div class="page">${allLabels[i]}${allLabels[i]}</div>`)
  }

  const totalMain  = mainGroups.reduce((a,b)=>a+b,0)
  const totalExtra = extraGroups.reduce((a,b)=>a+b,0)

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Этикетки — ${row.counterparty}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="no-print" style="
    position:sticky;top:0;z-index:100;
    background:#1d4ed8;color:white;
    padding:10px 20px;
    display:flex;align-items:center;justify-content:space-between;
    font-family:Arial,sans-serif;
  ">
    <span style="font-size:15px;font-weight:600">
      ${row.counterparty}
      · Основных: ${totalMain}
      ${totalExtra ? `· Добавка: ${totalExtra}` : ''}
      · Страниц: ${pages.length}
    </span>
    <button onclick="window.print()" style="
      background:white;color:#1d4ed8;
      border:none;padding:8px 20px;
      font-size:14px;font-weight:700;
      border-radius:8px;cursor:pointer;
    ">🖨️ Печать / PDF</button>
  </div>
  ${pages.join('\n')}
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

export default router
