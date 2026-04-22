#!/bin/bash
# =============================================================
# ЭТАП 1: Инфраструктура — Node.js проект, Docker PostgreSQL,
#          Prisma ORM, первые миграции
# Запускай: bash scripts/01-setup.sh
# =============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
step() { echo -e "\n${YELLOW}▶ $1${NC}"; }

# ── Проверка зависимостей ────────────────────────────────────
step "Проверяем зависимости"
command -v node  >/dev/null 2>&1 || fail "Node.js не установлен. Установи: https://nodejs.org (v18+)"
command -v npm   >/dev/null 2>&1 || fail "npm не найден"
command -v docker>/dev/null 2>&1 || fail "Docker не установлен: https://docs.docker.com/engine/install/ubuntu/"
node_ver=$(node -e "process.stdout.write(process.version)")
ok "Node.js $node_ver"
ok "npm $(npm --version)"
ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

# ── Backend: инициализация ───────────────────────────────────
step "Инициализируем backend"
cd backend

cat > package.json << 'PKGJSON'
{
  "name": "warehouse-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js",
    "db:migrate": "npx prisma migrate dev",
    "db:generate": "npx prisma generate",
    "db:studio": "npx prisma studio",
    "db:seed": "node src/prisma/seed.js"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/s3-request-presigner": "^3.600.0",
    "@prisma/client": "^5.15.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-async-errors": "^3.1.1",
    "imapflow": "^1.0.162",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "exceljs": "^4.4.0",
    "uuid": "^10.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "prisma": "^5.15.0"
  }
}
PKGJSON
ok "package.json создан"

# ── .env.example ─────────────────────────────────────────────
cat > .env.example << 'ENVEX'
# База данных (Docker)
DATABASE_URL="postgresql://warehouse:warehouse_pass@localhost:5432/warehouse_db"

# JWT — замени на свою случайную строку (минимум 32 символа)
JWT_SECRET="change_this_to_random_string_min_32_chars"
JWT_EXPIRES_IN="7d"

# S3 Beget — заполнить после настройки хранилища
S3_ENDPOINT="https://s3.beget.com"
S3_BUCKET="your-bucket-name"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_REGION="ru-1"

# Email IMAP (почта для получения Excel)
IMAP_HOST="imap.example.com"
IMAP_PORT=993
IMAP_USER="warehouse@example.com"
IMAP_PASS="your-email-password"
IMAP_POLL_MINUTES=5

# Сервер
PORT=3000
NODE_ENV=development
ENVEX

if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env создан из .env.example — заполни переменные!"
else
  ok ".env уже существует"
fi

# ── Prisma схема ─────────────────────────────────────────────
mkdir -p prisma
cat > prisma/schema.prisma << 'SCHEMA'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── Роли ───────────────────────────────────────────────────
enum UserRole {
  SUPER        // Суперпользователь
  WAREHOUSE    // Кладовщик
  LOADER       // Грузчик
  RECEIVER     // Приёмщик
  VIEWER       // Только просмотр
}

// ── Типы строк плана ───────────────────────────────────────
enum RowType {
  ARRIVAL      // П — Поступление
  CONTAINER    // К1, К2 — Отгрузка контейнер
  DELIVERY     // Д — Отгрузка доставка
  PICKUP       // С — Отгрузка самовывоз
  RETURN       // В — Возврат
}

// ── Статусы ────────────────────────────────────────────────
enum RowStatus {
  // Общий начальный статус
  WAITING      // Ожидание

  // Поступление
  ACCEPTED     // Принят
  POSTPONED    // Перенос

  // Отгрузка
  IN_PROGRESS  // В работе
  ASSEMBLED    // Собран
  SHIPPED      // Отгружен
}

// ── Типы фото ──────────────────────────────────────────────
enum PhotoType {
  ARRIVAL      // Фото приёмки
  ASSEMBLY     // Фото сборки
  SHIPMENT     // Фото отгрузки
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String
  passwordHash  String    @map("password_hash")
  role          UserRole  @default(VIEWER)
  isActive      Boolean   @default(true) @map("is_active")
  createdAt     DateTime  @default(now()) @map("created_at")

  // Инвайт-система
  inviteToken   String?   @unique @map("invite_token")
  inviteUsedAt  DateTime? @map("invite_used_at")
  invitedById   String?   @map("invited_by_id")
  invitedBy     User?     @relation("Invites", fields: [invitedById], references: [id])
  invitedUsers  User[]    @relation("Invites")

  // Связи
  importedPlans    Plan[]          @relation("Importer")
  statusChanges    StatusHistory[]
  uploadedPhotos   Photo[]

  @@map("users")
}

model Plan {
  id               String    @id @default(uuid())
  planDate         DateTime  @map("plan_date") @db.Date
  sourceFileUrl    String?   @map("source_file_url")
  originalFilename String?   @map("original_filename")
  importedById     String?   @map("imported_by_id")
  importedBy       User?     @relation("Importer", fields: [importedById], references: [id])
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  rows             PlanRow[]

  @@unique([planDate])
  @@map("plans")
}

model PlanRow {
  id              String    @id @default(uuid())
  planId          String    @map("plan_id")
  plan            Plan      @relation(fields: [planId], references: [id], onDelete: Cascade)

  rowType         RowType   @map("row_type")
  // Исходный код из Excel (П, Д, С, К1, К2, В)
  rawType         String    @map("raw_type")
  counterparty    String?   // Контрагент (колонка B)
  weight          Decimal?  @db.Decimal(10, 2) // Вес (колонка D)
  manager         String?   // Менеджер (колонка E)
  vehicleNumber   String?   @map("vehicle_number") // № Машины (колонка F)
  notes           String?   // Дополнительно (колонка G)
  sortOrder       Int       @map("sort_order")
  status          RowStatus @default(WAITING)

  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  statusHistory   StatusHistory[]
  photos          Photo[]

  @@map("plan_rows")
}

model StatusHistory {
  id          String    @id @default(uuid())
  planRowId   String    @map("plan_row_id")
  planRow     PlanRow   @relation(fields: [planRowId], references: [id], onDelete: Cascade)
  changedById String?   @map("changed_by_id")
  changedBy   User?     @relation(fields: [changedById], references: [id])
  oldStatus   RowStatus @map("old_status")
  newStatus   RowStatus @map("new_status")
  comment     String?
  changedAt   DateTime  @default(now()) @map("changed_at")

  @@map("status_history")
}

model Photo {
  id          String    @id @default(uuid())
  planRowId   String    @map("plan_row_id")
  planRow     PlanRow   @relation(fields: [planRowId], references: [id], onDelete: Cascade)
  uploadedById String?  @map("uploaded_by_id")
  uploadedBy  User?     @relation(fields: [uploadedById], references: [id])
  fileUrl     String    @map("file_url")
  fileKey     String    @map("file_key")
  photoType   PhotoType @map("photo_type")
  uploadedAt  DateTime  @default(now()) @map("uploaded_at")

  @@map("photos")
}

// Инвайт-ссылки (хранятся отдельно для безопасности)
model InviteLink {
  id          String    @id @default(uuid())
  token       String    @unique
  role        UserRole
  createdById String    @map("created_by_id")
  usedAt      DateTime? @map("used_at")
  usedById    String?   @map("used_by_id")
  expiresAt   DateTime  @map("expires_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  @@map("invite_links")
}
SCHEMA
ok "prisma/schema.prisma создан"

cd ..

# ── Docker Compose ───────────────────────────────────────────
step "Создаём docker-compose.yml"
cat > docker-compose.yml << 'COMPOSE'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: warehouse_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: warehouse_db
      POSTGRES_USER: warehouse
      POSTGRES_PASSWORD: warehouse_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U warehouse -d warehouse_db"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
COMPOSE
ok "docker-compose.yml создан"

# ── Запуск PostgreSQL ─────────────────────────────────────────
step "Запускаем PostgreSQL в Docker"
docker compose up -d postgres
echo "Ждём готовности базы..."
sleep 5

# Проверяем что база поднялась
for i in {1..12}; do
  if docker exec warehouse_db pg_isready -U warehouse -d warehouse_db > /dev/null 2>&1; then
    ok "PostgreSQL готов!"
    break
  fi
  if [ $i -eq 12 ]; then
    fail "PostgreSQL не поднялся за 60 секунд. Проверь: docker logs warehouse_db"
  fi
  echo "  Ожидание... ($i/12)"
  sleep 5
done

# ── npm install + Prisma ──────────────────────────────────────
step "Устанавливаем npm зависимости backend"
cd backend
npm install
ok "npm install завершён"

step "Генерируем Prisma client и применяем миграцию"
npx prisma migrate dev --name init
npx prisma generate
ok "Prisma миграция применена"

# ── Seed: суперпользователь ───────────────────────────────────
step "Создаём начального суперпользователя"
mkdir -p src/prisma
cat > src/prisma/seed.js << 'SEED'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.user.findFirst({ where: { role: 'SUPER' } })
  if (existing) {
    console.log('Суперпользователь уже существует:', existing.email)
    return
  }

  const hash = await bcrypt.hash('admin123', 10)
  const user = await prisma.user.create({
    data: {
      email: 'admin@warehouse.local',
      name: 'Администратор',
      passwordHash: hash,
      role: 'SUPER',
    }
  })
  console.log('✓ Суперпользователь создан:')
  console.log('  Email:', user.email)
  console.log('  Пароль: admin123')
  console.log('  ⚠ Смени пароль после первого входа!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
SEED

node src/prisma/seed.js
ok "Seed выполнен"

cd ..

# ── Итог ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  ЭТАП 1 ЗАВЕРШЁН УСПЕШНО!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "Что сделано:"
echo "  ✓ Структура проекта создана"
echo "  ✓ PostgreSQL запущен в Docker"
echo "  ✓ Prisma схема и миграция применены"
echo "  ✓ Суперпользователь: admin@warehouse.local / admin123"
echo ""
echo "Следующий шаг:"
echo "  bash scripts/02-auth.sh"
echo ""
echo "Полезные команды:"
echo "  docker compose logs -f postgres   # логи БД"
echo "  cd backend && npm run db:studio   # UI для базы"
echo "  docker compose down               # остановить БД"
