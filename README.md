# Warehouse Plan

Веб-приложение для управления ежедневным планом отгрузок и поступлений.

## Быстрый старт

```bash
# Этап 1: инфраструктура, БД, базовый backend
bash scripts/01-setup.sh

# Проверить парсер на реальном файле
bash scripts/test-parser.sh путь/к/файлу.xls

# Запустить backend в режиме разработки
cd backend && npm run dev

# Открыть UI базы данных
cd backend && npm run db:studio
```

## Этапы разработки

| Скрипт | Что делает |
|--------|-----------|
| `scripts/01-setup.sh` | Инфраструктура + БД + Prisma |
| `scripts/02-frontend.sh` | React + Vite frontend |
| `scripts/03-email.sh` | IMAP email worker |
| `scripts/04-s3.sh` | S3 фото загрузка |
| `scripts/05-deploy.sh` | Деплой на VPS (Nginx + PM2) |

## Стек

- **Backend**: Node.js + Express + Prisma + PostgreSQL
- **Frontend**: React + Vite + TailwindCSS
- **Auth**: JWT + инвайт-ссылки
- **Storage**: S3-совместимое (Beget)
- **Email**: imapflow (IMAP polling)

## Роли

| Роль | Что может |
|------|-----------|
| SUPER | Всё |
| WAREHOUSE (Кладовщик) | В работе, Собран + фото сборки |
| LOADER (Грузчик) | Фото отгрузки → Отгружен |
| RECEIVER (Приёмщик) | Статусы поступления + фото |
| VIEWER | Только просмотр |

## Структура Excel файла

- **E1** — дата плана (формат DD.MM.YYYY)
- **Строка 2** — заголовки (пропускается)
- **Строки 3+** — данные:
  - A = Тип (П/Д/С/К1/К2/В)
  - B = Контрагент
  - D = Вес
  - E = Менеджер
  - F = № Машины
  - G = Дополнительно
