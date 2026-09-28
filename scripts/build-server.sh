#!/usr/bin/env bash
# Собирает готовую сборку для сервера (без npm на сервере) в папку server-dist/.
# Её содержимое публикуется в ветку server-build; на сервере: sudo bash install.sh
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
rm -rf server-dist
mkdir -p server-dist/.next
cp -a .next/standalone/. server-dist/
cp -a .next/static server-dist/.next/static
cp -a public server-dist/public
cp deploy/install-prebuilt.sh server-dist/install.sh
# сайту не нужны: обработка картинок (next/image не используется) и TypeScript (конфиг уже собран).
# Без них сборка в два раза меньше и быстрее скачивается на сервер.
rm -rf server-dist/node_modules/@img server-dist/node_modules/sharp server-dist/node_modules/typescript \
  server-dist/node_modules/@emnapi server-dist/node_modules/detect-libc
rm -f server-dist/.env
echo "server-dist готов: $(du -sh server-dist | cut -f1)"
