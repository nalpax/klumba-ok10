#!/usr/bin/env bash
# Обновление «Клумбы» на сервере: новая версия кода, данные (цветы, коды) сохраняются.
# Запуск: sudo bash deploy/update.sh
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR=/var/lib/klumba
[ "$(id -u)" -eq 0 ] || { echo "Запустите через sudo"; exit 1; }

# на всякий случай — копия данных перед обновлением
if [ -f "$DATA_DIR/klumba.json" ]; then
  cp "$DATA_DIR/klumba.json" "$DATA_DIR/klumba.before-update-$(date +%F-%H%M).json"
fi

cd "$APP_DIR"
if [ -d .git ]; then
  git config --global --add safe.directory "$APP_DIR"
  git pull --ff-only
fi
npm ci --no-audit --no-fund
npm run build
chown -R klumba:klumba "$APP_DIR"
systemctl restart klumba
sleep 3
curl -fsS http://127.0.0.1/api/health >/dev/null && echo "Готово: сайт обновлён и работает." || echo "Сайт не ответил — смотрите: journalctl -u klumba -n 50"
