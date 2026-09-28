#!/usr/bin/env bash
# Установка ГОТОВОЙ сборки «Клумбы» (ветка server-build): без npm и без сборки на сервере.
# Подходит, если с сервера не открывается registry.npmjs.org или мало памяти.
#   git clone -b server-build --depth 1 https://github.com/nalpax/klumba-ok10 /opt/klumba-app
#   sudo bash /opt/klumba-app/install.sh
# Сайт будет открываться по адресу http://IP-СЕРВЕРА
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR=/var/lib/klumba
APP_USER=klumba
PORT=3000

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "запустите от имени root: sudo bash install.sh"
[ -f "$APP_DIR/server.js" ] || fail "не найден server.js — это не папка готовой сборки"

# пароль, сохранённый прошлой установкой, подхватываем
if [ ! -f "$APP_DIR/.env" ] && [ -f /opt/klumba/.env ]; then
  cp /opt/klumba/.env "$APP_DIR/.env"
  say "Нашёл настройки прошлой установки — пароль администратора прежний"
fi

if [ -f "$APP_DIR/.env" ] && grep -q '^ADMIN_PASSWORD=' "$APP_DIR/.env"; then
  say "Пароль администратора уже задан (чтобы сменить — удалите $APP_DIR/.env и запустите снова)"
else
  echo
  echo "Придумайте пароль администратора (от 8 знаков, латиница и цифры). Его вводят в окне «Вход» на сайте."
  echo "При вводе символы не отображаются — это нормально."
  while true; do
    read -rs -p "Пароль: " PW1; echo
    read -rs -p "Ещё раз: " PW2; echo
    if [ "$PW1" != "$PW2" ]; then echo "Пароли не совпали, попробуйте снова."; continue; fi
    if [ "${#PW1}" -lt 8 ]; then echo "Слишком короткий, нужно от 8 знаков."; continue; fi
    case "$PW1" in *\'*|*\"*|*' '*|*'$'*|*'\'*) echo "Без кавычек, пробелов, \$ и \\, пожалуйста."; continue;; esac
    break
  done
fi

IP="$(curl -4 -fsS --max-time 5 https://ipv4.icanhazip.com 2>/dev/null || true)"
[ -n "$IP" ] || IP="$(hostname -I | awk '{print $1}')"
IP="$(echo "$IP" | tr -d '[:space:]')"
SITE_URL="http://$IP"

say "Устанавливаю nginx"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx curl ca-certificates

NODE_MAJOR=$(node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || echo 0)
if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  say "Устанавливаю Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
say "Node.js $(node -v)"

id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$DATA_DIR"
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"
chmod 750 "$DATA_DIR"

if [ -n "${PW1:-}" ]; then
  printf "ADMIN_PASSWORD='%s'\nNEXT_PUBLIC_SITE_URL=%s\nDATA_DIR=%s\n" "$PW1" "$SITE_URL" "$DATA_DIR" > "$APP_DIR/.env"
else
  grep -q '^DATA_DIR=' "$APP_DIR/.env" || echo "DATA_DIR=$DATA_DIR" >> "$APP_DIR/.env"
fi
chmod 600 "$APP_DIR/.env"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# если раньше пытались ставить из исходников — старую службу заменяем
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
Environment=PORT=$PORT
Environment=HOSTNAME=127.0.0.1
ExecStart=$(command -v node) $APP_DIR/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable klumba >/dev/null
systemctl restart klumba

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
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
NGINX
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

if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 80/tcp >/dev/null
fi

say "Проверяю, что сайт отвечает"
OK=0
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1/api/health" >/dev/null 2>&1; then OK=1; break; fi
  sleep 1
done
[ "$OK" = 1 ] || fail "сайт не ответил. Посмотрите журнал: journalctl -u klumba -n 50"

cat <<DONE

$(printf '\033[1;32m')Готово! Сайт работает: $SITE_URL$(printf '\033[0m')

Откройте $SITE_URL → «Вход» → введите пароль администратора.

Полезные команды:
  Резервная копия:  cp $DATA_DIR/klumba.json ~/klumba-\$(date +%F).json
  Журнал:           journalctl -u klumba -n 50
  Перезапуск:       systemctl restart klumba
DONE
