#!/bin/bash
# =============================================================
# ЭТАП 3: Деплой на VPS (Beget Ubuntu 22.04)
# Запускай НА СЕРВЕРЕ из корня проекта:
#   bash scripts/03-deploy.sh
#
# Предварительно:
#   1. Залей проект на сервер (git clone / scp)
#   2. Заполни backend/.env (DATABASE_URL, JWT_SECRET, IMAP_*, S3_*)
#   3. Убедись что Docker и Node.js установлены
# =============================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
step() { echo -e "\n${YELLOW}▶ $1${NC}"; }

PROJECT_DIR=$(pwd)
DOMAIN=${1:-""}   # передай домен как аргумент: bash 03-deploy.sh mysite.ru

# ── Проверки ─────────────────────────────────────────────────
step "Проверяем окружение"
command -v node   >/dev/null 2>&1 || fail "Node.js не установлен"
command -v npm    >/dev/null 2>&1 || fail "npm не установлен"
command -v docker >/dev/null 2>&1 || fail "Docker не установлен"
[ -f backend/.env ] || fail "backend/.env не найден! Скопируй из .env.example и заполни"
ok "Всё готово"

# ── PM2 ───────────────────────────────────────────────────────
step "Устанавливаем PM2 (менеджер процессов)"
npm install -g pm2 2>/dev/null || warn "PM2 уже установлен"
ok "PM2 готов"

# ── База данных ───────────────────────────────────────────────
step "Запускаем PostgreSQL"
docker compose up -d postgres
sleep 5
ok "PostgreSQL запущен"

# ── Backend ───────────────────────────────────────────────────
step "Устанавливаем зависимости backend"
cd backend
npm install --production
npx prisma migrate deploy   # deploy (не dev) — для продакшена
npx prisma generate
ok "Backend зависимости установлены"
cd ..

# ── Frontend — сборка ─────────────────────────────────────────
step "Собираем frontend"
cd frontend
npm install
VITE_API_URL="" npm run build   # baseURL через vite proxy → nginx
ok "Frontend собран в frontend/dist"
cd ..

# ── PM2 ecosystem файл ────────────────────────────────────────
step "Создаём PM2 конфигурацию"
cat > ecosystem.config.cjs << PMCONF
module.exports = {
  apps: [{
    name: 'warehouse-backend',
    script: './backend/src/index.js',
    cwd: '${PROJECT_DIR}',
    interpreter: 'node',
    interpreter_args: '--experimental-vm-modules',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    // Автоперезапуск при крэше, макс 10 рестартов за 10 минут
    max_restarts: 10,
    min_uptime: '10s',
    // Логи
    out_file: './logs/backend-out.log',
    error_file: './logs/backend-err.log',
    time: true,
  }]
}
PMCONF

mkdir -p logs
ok "ecosystem.config.cjs создан"

# ── Запуск через PM2 ──────────────────────────────────────────
step "Запускаем backend через PM2"
pm2 delete warehouse-backend 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
ok "Backend запущен"

# ── Nginx ─────────────────────────────────────────────────────
step "Настраиваем Nginx"
command -v nginx >/dev/null 2>&1 || {
  warn "Nginx не найден, устанавливаем..."
  sudo apt-get update -q
  sudo apt-get install -y nginx
}

NGINX_CONF="/etc/nginx/sites-available/warehouse"

sudo tee "$NGINX_CONF" > /dev/null << NGINXCONF
server {
    listen 80;
    server_name ${DOMAIN:-_};

    # Frontend (статика из dist)
    root ${PROJECT_DIR}/frontend/dist;
    index index.html;

    # SPA — все неизвестные пути → index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API → backend :3000
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
        # Таймаут для загрузки больших файлов
        proxy_read_timeout 120s;
        client_max_body_size 50M;
    }

    # Логи
    access_log /var/log/nginx/warehouse-access.log;
    error_log  /var/log/nginx/warehouse-error.log;
}
NGINXCONF

# Активируем конфиг
sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/warehouse
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Проверяем и перезапускаем nginx
sudo nginx -t && sudo systemctl reload nginx
ok "Nginx настроен"

# ── PM2 автозапуск при перезагрузке сервера ───────────────────
step "Настраиваем автозапуск PM2"
pm2 startup | tail -1 | sudo bash 2>/dev/null || warn "Настрой автозапуск вручную: pm2 startup"
pm2 save
ok "Автозапуск настроен"

# ── Итог ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  ДЕПЛОЙ ЗАВЕРШЁН!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
if [ -n "$DOMAIN" ]; then
  echo "  Сайт доступен: http://${DOMAIN}"
else
  echo "  Сайт доступен: http://IP_СЕРВЕРА"
fi
echo ""
echo "Полезные команды:"
echo "  pm2 status                    # статус backend"
echo "  pm2 logs warehouse-backend    # логи в реальном времени"
echo "  pm2 restart warehouse-backend # перезапуск"
echo "  sudo nginx -t                 # проверить конфиг nginx"
echo "  sudo systemctl status nginx   # статус nginx"
echo ""
echo "Для HTTPS (после настройки DNS):"
echo "  sudo apt install certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d ${DOMAIN:-yourdomain.ru}"
