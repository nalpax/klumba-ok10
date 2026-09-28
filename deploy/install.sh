#!/usr/bin/env bash
# Установка «Клумбы» на VPS с Ubuntu 22.04 / 24.04 (или Debian 12) одной командой, без домена.
# Запуск из папки проекта:   sudo bash deploy/install.sh
# Сайт будет открываться по адресу http://IP-СЕРВЕРА
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR=/var/lib/klumba
APP_USER=klumba
PORT=3000

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "запустите от имени root: sudo bash deploy/install.sh"
[ -f "$APP_DIR/package.json" ] || fail "не найден package.json — запускайте скрипт из папки проекта"

# ---------- пароль администратора ----------
if [ -f "$APP_DIR/.env" ] && grep -q '^ADMIN_PASSWORD=' "$APP_DIR/.env"; then
  say "Файл настроек .env уже есть — пароль администратора не меняю (чтобы сменить — удалите .env и запустите снова)"
else
  echo
  echo "Придумайте пароль администратора (от 8 знаков). Его вводят в окне «Вход» на сайте вместо кода."
  echo "Нельзя использовать кавычки и пробелы. При вводе символы не отображаются — это нормально."
  while true; do
    read -rs -p "Пароль: " PW1; echo
    read -rs -p "Ещё раз: " PW2; echo
    if [ "$PW1" != "$PW2" ]; then echo "Пароли не совпали, попробуйте снова."; continue; fi
    if [ "${#PW1}" -lt 8 ]; then echo "Слишком короткий, нужно от 8 знаков."; continue; fi
    case "$PW1" in *\'*|*\"*|*' '*|*'$'*|*'\'*) echo "Без кавычек, пробелов, \$ и \\, пожалуйста."; continue;; esac
    break
  done
fi

# ---------- адрес сервера ----------
IP="$(curl -4 -fsS --max-time 5 https://ipv4.icanhazip.com 2>/dev/null || true)"
[ -n "$IP" ] || IP="$(hostname -I | awk '{print $1}')"
IP="$(echo "$IP" | tr -d '[:space:]')"
SITE_URL="http://$IP"
say "Адрес сайта будет: $SITE_URL"

# ---------- пакеты ----------
say "Устанавливаю nginx и нужные программы"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx curl ca-certificates git

# ---------- подкачка (сборке сайта нужно ~1.5 ГБ памяти) ----------
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 2500 ] && ! swapon --show | grep -q .; then
  say "Памяти ${MEM_MB} МБ — добавляю файл подкачки 2 ГБ"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- Node.js 22 ----------
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || echo 0)
if [ "${NODE_MAJOR:-0}" -lt 22 ]; then
  say "Устанавливаю Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
say "Node.js $(node -v)"

# ---------- пользователь и папка данных ----------
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$DATA_DIR"
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"
chmod 750 "$DATA_DIR"

# ---------- настройки ----------
if [ -n "${PW1:-}" ]; then
  cat > "$APP_DIR/.env" <<ENV
ADMIN_PASSWORD='$PW1'
NEXT_PUBLIC_SITE_URL=$SITE_URL
DATA_DIR=$DATA_DIR
ENV
else
  # адрес мог поменяться — обновляем, пароль не трогаем
  sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=$SITE_URL|" "$APP_DIR/.env"
  grep -q '^DATA_DIR=' "$APP_DIR/.env" || echo "DATA_DIR=$DATA_DIR" >> "$APP_DIR/.env"
fi
chmod 600 "$APP_DIR/.env"

# ---------- сборка ----------
say "Собираю сайт (2–5 минут)"
cd "$APP_DIR"
npm ci --no-audit --no-fund
npm run build
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ---------- служба: сайт запускается сам и перезапускается при сбое ----------
say "Настраиваю автозапуск"
cat > /etc/systemd/system/klumba.service <<UNIT
[Unit]
Description=Клумба ОК № 10
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
Environment=NODE_ENV=production
ExecStart=$(command -v node) $APP_DIR/node_modules/next/dist/bin/next start -p $PORT -H 127.0.0.1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable klumba >/dev/null
systemctl restart klumba

# ---------- nginx: принимает посетителей на 80-м порту ----------
say "Настраиваю nginx"
cat > /etc/nginx/sites-available/klumba <<'NGINX'
server {
    listen 80 default_server;
    # LISTEN_V6
    server_name _;
    client_max_body_size 64k;

    gzip on;
    gzip_types application/json text/css application/javascript image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        # настоящий адрес посетителя — для защиты от подбора кодов (заголовок от посетителя не принимаем)
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
NGINX
# IPv6 — только если сервер его поддерживает (иначе nginx не запустится)
if [ -f /proc/net/if_inet6 ]; then
  sed -i 's|    # LISTEN_V6|    listen [::]:80 default_server;|' /etc/nginx/sites-available/klumba
else
  sed -i '/# LISTEN_V6/d' /etc/nginx/sites-available/klumba
fi
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/klumba /etc/nginx/sites-enabled/klumba
nginx -t
systemctl enable nginx >/dev/null
systemctl reload nginx || systemctl restart nginx

# ---------- брандмауэр ----------
if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 80/tcp >/dev/null
fi

# ---------- проверка ----------
say "Проверяю, что сайт отвечает"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1/api/health" >/dev/null 2>&1; then OK=1; break; fi
  sleep 1
done
[ "${OK:-0}" = 1 ] || fail "сайт не ответил. Посмотрите журнал: journalctl -u klumba -n 50"

cat <<DONE

$(printf '\033[1;32m')Готово! Сайт работает: $SITE_URL$(printf '\033[0m')

Дальше:
  1. Откройте $SITE_URL → «Вход» → введите пароль администратора.
  2. «Учителя» → добавьте учителей, 🔑 — коды для них.
  3. «Коды ученикам» → выпустите коды и распечатайте карточки с QR.
  4. «Мероприятие» → «Идёт посадка».

Полезные команды:
  Обновить сайт:        sudo bash $APP_DIR/deploy/update.sh
  Резервная копия:      sudo cp $DATA_DIR/klumba.json ~/klumba-\$(date +%F).json
  Журнал, если что-то не так: journalctl -u klumba -n 50
DONE
