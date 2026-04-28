# Текущее состояние проекта (апрель 2026)

## Сервер
- VPS Beget: 217.114.12.58
- Домен: https://whmanage.ru
- SSH: root@217.114.12.58

## Что работает
- Все роли (SUPER, MANAGER, WAREHOUSE, LOADER, RECEIVER, VIEWER)
- Создание записей менеджером (все типы: П, Д, С, К1, К2, В)
- Автоперенос незавершённых записей в 00:01 (двигает карточку, не копирует)
- Ручной перенос записи на любую дату (неограниченное количество раз)
- История переносов в БД (таблица postpone_history)
- Статус "Отменён" (красный) — для SUPER и MANAGER
- Фото в S3 (сжатие до 1200px на фронтенде)
- Поддоны основные + добавка с суммой
- Телефон контрагента
- Этикетки отгрузки PDF → факс (fax@whmanage.ru)
- Этикетки поступления — поиск товара по штрихкоду, печать A4 landscape, лог печати
- База товаров (1240 товаров) — поиск по последним цифрам штрихкода
- Управление товарами в /settings (добавить, удалить, поиск)
- Сканирование документов в PDF (многостраничное) — для WAREHOUSE, LOADER, SUPER
- Документы хранятся в S3, привязаны к записи, доступны всем кроме VIEWER
- PWA — только Safari (iOS) и Chrome (Android)
- Журнал действий (/activity)
- Фильтры по статусу и типу (localStorage)
- Блокировка пользователей
- Смена пароля через /admin
- Инвайты на email (invite@whmanage.ru)
- Лог приглашений в /admin
- Итого поддонов за день в шапке
- Сборщик ошибок фронтенда → /errors (последние 20 + скачать лог)
- Лог ошибок бэкенда → /errors вкладка Бэкенд

## PWA установка
- **iPhone**: открыть whmanage.ru в Safari → поделиться → На экран домой
- **Android**: открыть whmanage.ru в Chrome → три точки → Добавить на главный экран
- Firefox на iOS НЕ поддерживает PWA

## В процессе
- IMAP email-worker не настроен — приём входящих писем с Excel-планами (функция не используется)

## Команды управления
```bash
pm2 restart warehouse-backend
cd /root/warehouse-plan/frontend && npm run build && chmod -R 755 dist && systemctl reload nginx
pm2 logs warehouse-backend --lines 20 --nostream
docker exec warehouse_db pg_dump -U warehouse warehouse_db > backup-$(date +%Y%m%d).sql
```

## Структура
- Backend: /root/warehouse-plan/backend/src/
- Frontend: /root/warehouse-plan/frontend/src/
- Логи: /root/warehouse-plan/logs/
- .env: /root/warehouse-plan/backend/.env

## БД
- PostgreSQL в Docker (контейнер warehouse_db)
- Prisma ORM
- Таблицы: users, plans, plan_rows, status_history, postpone_history, photos, invite_links, settings, products, documents, print_log
