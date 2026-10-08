#!/bin/sh
set -e

echo "[entrypoint] применяем схему БД..."
./migrate

echo "[entrypoint] запускаем сервер..."
exec ./mindset
