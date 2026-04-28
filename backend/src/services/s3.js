import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import path from 'path'

// ── S3 клиент ─────────────────────────────────────────────────
function getClient() {
  return new S3Client({
    endpoint:        process.env.S3_ENDPOINT,    // https://s3.beget.com
    region:          process.env.S3_REGION || 'ru-1',
    credentials: {
      accessKeyId:     process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
    forcePathStyle: true, // обязательно для Beget S3
  })
}

const BUCKET = () => process.env.S3_BUCKET

// ── Загрузить файл в S3 ───────────────────────────────────────
export async function uploadToS3(buffer, originalName, folder = 'uploads') {
  const ext      = path.extname(originalName).toLowerCase()
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Zа-яёА-ЯЁ0-9_\-]/g, '_').slice(0, 60)
  const fileKey  = `${folder}/${baseName}_${randomUUID().slice(0,8)}${ext}`

  const client = getClient()
  await client.send(new PutObjectCommand({
    Bucket:             BUCKET(),
    Key:                fileKey,
    Body:               buffer,
    ContentType:        getMimeType(ext),
    ContentDisposition: `inline; filename="${encodeURIComponent(originalName)}"`,
    ACL:                'public-read',
  }))

  // Публичный URL файла
  const fileUrl = `${process.env.S3_ENDPOINT}/${BUCKET()}/${fileKey}`
  return { fileKey, fileUrl }
}

// ── Удалить файл из S3 ────────────────────────────────────────
export async function deleteFromS3(fileKey) {
  const client = getClient()
  await client.send(new DeleteObjectCommand({
    Bucket: BUCKET(),
    Key:    fileKey,
  }))
}

// ── MIME типы ─────────────────────────────────────────────────
function getMimeType(ext) {
  const map = {
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.xls':  'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return map[ext] || 'application/octet-stream'
}

// ── Проверка соединения с S3 ──────────────────────────────────
export async function checkS3Connection() {
  try {
    const client = getClient()
    // Пробуем загрузить тестовый файл и сразу удалить
    const testKey = `_test/${Date.now()}.txt`
    await client.send(new PutObjectCommand({
      Bucket: BUCKET(),
      Key:    testKey,
      Body:   Buffer.from('test'),
    }))
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: testKey }))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
