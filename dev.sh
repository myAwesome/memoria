#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Load .env if present
if [ -f .env ]; then
  set -a && source .env && set +a
fi

# ── 1. Database ────────────────────────────────────────────────────────────────
echo "▸ Starting database..."
docker compose up -d mysql

echo -n "▸ Waiting for database to be ready..."
until docker compose exec -T mysql mysqladmin ping -h 127.0.0.1 -uroot -p"$DB_PASSWORD" >/dev/null 2>&1; do
  printf "."
  sleep 1
done
echo " ready"

# ── 2. Migrations ──────────────────────────────────────────────────────────────
echo "▸ Applying migrations..."
for f in migrations/*.up.sql; do
  echo "  applying $f..."
  docker compose exec -T mysql mysql -uroot -p"$DB_PASSWORD" "$DB_NAME" < "$f"
done
echo "  migrations applied"

# ── 3. Server ──────────────────────────────────────────────────────────────────
echo "▸ Downloading dependencies..."
GOTOOLCHAIN=local go get ./...

echo "▸ Starting server on port 8787 (background)..."
GOTOOLCHAIN=local go run . &
SERVER_PID=$!

# ── 4. Client ──────────────────────────────────────────────────────────────────
echo "▸ Installing client dependencies..."
(cd client && npm install)

echo "▸ Starting client dev server..."
(cd client && npm run dev) &
CLIENT_PID=$!

# Open browser after short delay for dev server to start
(sleep 5 && open "http://localhost:5173") &

trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT TERM
wait $SERVER_PID $CLIENT_PID
