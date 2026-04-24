# Текущее состояние проекта (апрель 2026)

## Сервер
- VPS Beget: 217.114.12.58
- Домен: https://whmanage.ru
- SSH: root@217.114.12.58

## Что работает
- Все роли (SUPER, MANAGER, WAREHOUSE, LOADER, RECEIVER, VIEWER)
- Создание записей менеджером (все типы: П, Д, С, К1, К2, В)
- Автоперенос незавершённых записей в 00:01
- Фото в S3
- Поддоны основные + добавка с суммой
- Телефон контрагента
- Этикетки PDF → факс (fax@whmanage.ru)
- PWA
- Журнал действий (/activity)
- Фильтры по статусу и типу (localStorage)
- Блокировка пользователей
- Смена пароля через /admin
- Инвайты на email (invite@whmanage.ru)
- Итого поддонов за день в шапке

## В процессе
- Отправка инвайтов на email — код написан, нужно проверить
- invite@whmanage.ru зарегистрирован но пароль не добавлен в .env

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
