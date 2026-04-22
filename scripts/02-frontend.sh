#!/bin/bash
# =============================================================
# ЭТАП 2: Frontend — React + Vite + TailwindCSS
# Запускай из корня проекта: bash scripts/02-frontend.sh
# =============================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
step() { echo -e "\n${YELLOW}▶ $1${NC}"; }

step "Устанавливаем зависимости frontend"
cd frontend
npm install
ok "npm install завершён"

step "Проверяем сборку"
npm run build
ok "Сборка прошла без ошибок"

cd ..

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  ЭТАП 2 ЗАВЕРШЁН!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "Как запустить в режиме разработки:"
echo ""
echo "  Терминал 1 — backend:"
echo "    cd backend && npm run dev"
echo ""
echo "  Терминал 2 — frontend:"
echo "    cd frontend && npm run dev"
echo ""
echo "  Затем открой: http://localhost:5173"
echo "  Логин: admin@warehouse.local / admin123"
echo ""
echo "Следующий шаг — настрой .env и запускай!"
echo "Когда будет нужен деплой на VPS: bash scripts/03-deploy.sh"
