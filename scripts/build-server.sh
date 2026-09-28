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
rm -f server-dist/.env
echo "server-dist готов: $(du -sh server-dist | cut -f1)"
