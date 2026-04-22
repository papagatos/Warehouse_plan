import nodemailer from 'nodemailer'

export function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    }
  })
}

export async function sendFaxPDF(toEmail, subject, pdfBuffer, filename) {
  const transporter = createTransport()
  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to:      toEmail,
    subject,
    text:    subject,
    attachments: [{
      filename,
      content:     pdfBuffer,
      contentType: 'application/pdf',
    }]
  })
}

export async function checkMailConnection() {
  try {
    const t = createTransport()
    await t.verify()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
