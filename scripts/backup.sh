#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_CONTAINER="${DB_CONTAINER:-flowmind-postgres-1}"
DB_USER="${DB_USER:-flowmind}"
DB_NAME="${DB_NAME:-flowmind}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

echo "=== FlowMind Backup $TIMESTAMP ==="

# 1. PostgreSQL dump
echo "--- Dumping PostgreSQL ---"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" -F c -f "/tmp/flowmind_db_$TIMESTAMP.dump"
docker cp "$DB_CONTAINER:/tmp/flowmind_db_$TIMESTAMP.dump" "$BACKUP_DIR/flowmind_db_$TIMESTAMP.dump"
docker exec "$DB_CONTAINER" rm "/tmp/flowmind_db_$TIMESTAMP.dump"
echo "  -> $BACKUP_DIR/flowmind_db_$TIMESTAMP.dump"

# 2. Redis dump (RDB snapshot)
echo "--- Backing up Redis ---"
REDIS_CONTAINER="${REDIS_CONTAINER:-flowmind-redis-1}"
if docker ps --format '{{.Names}}' | grep -q "^$REDIS_CONTAINER$"; then
  docker exec "$REDIS_CONTAINER" redis-cli SAVE
  docker cp "$REDIS_CONTAINER:/data/dump.rdb" "$BACKUP_DIR/redis_$TIMESTAMP.rdb"
  echo "  -> $BACKUP_DIR/redis_$TIMESTAMP.rdb"
else
  echo "  (Redis container not running, skipping)"
fi

# 3. Environment files
echo "--- Archiving .env files ---"
tar czf "$BACKUP_DIR/env_$TIMESTAMP.tar.gz" \
  --ignore-failed-read \
  .env .env.example apps/api/.env packages/db/.env 2>/dev/null || true
echo "  -> $BACKUP_DIR/env_$TIMESTAMP.tar.gz"

# 4. Qdrant snapshot (if container running)
echo "--- Backing up Qdrant ---"
QDRANT_CONTAINER="${QDRANT_CONTAINER:-flowmind-qdrant-1}"
if docker ps --format '{{.Names}}' | grep -q "^$QDRANT_CONTAINER$"; then
  SNAPSHOT=$(docker exec "$QDRANT_CONTAINER" curl -s -X POST 'http://localhost:6333/snapshots' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('name',''))" 2>/dev/null || echo "")
  if [ -n "$SNAPSHOT" ]; then
    docker cp "$QDRANT_CONTAINER:/qdrant/snapshots/$SNAPSHOT" "$BACKUP_DIR/qdrant_$TIMESTAMP.snapshot"
    echo "  -> $BACKUP_DIR/qdrant_$TIMESTAMP.snapshot"
  else
    echo "  (Qdrant snapshot API failed, skipping)"
  fi
else
  echo "  (Qdrant container not running, skipping)"
fi

# 5. Retention cleanup
echo "--- Cleaning backups older than $RETENTION_DAYS days ---"
find "$BACKUP_DIR" -name "flowmind_db_*.dump" -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "redis_*.rdb" -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "env_*.tar.gz" -mtime "+$RETENTION_DAYS" -delete

echo "=== Backup complete: $BACKUP_DIR ==="
